import psycopg2
from psycopg2.extras import execute_values, Json
from datetime import datetime
import json
import os
import re
from urllib.parse import urlparse

# Try to load environment variables from .env file
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    # If python-dotenv is not installed, just use system environment variables
    pass

def parse_jsonl_filename(filepath):
    """
    Parse filename like: test_05DY96RM6YQ_13000_31000.jsonl
    Returns: (folder, video_id, start_ms, end_ms)
    """
    filename = os.path.basename(filepath)
    # Remove .jsonl extension
    name_without_ext = filename.replace('.jsonl', '')
    
    # Pattern: folder_videoId_start_end
    pattern = r'^([^_]+)_([^_]+)_(\d+)_(\d+)$'
    match = re.match(pattern, name_without_ext)
    
    if not match:
        raise ValueError(f"Invalid filename format: {filename}")
    
    folder = match.group(1)
    video_id = match.group(2)
    start_ms = int(match.group(3))
    end_ms = int(match.group(4))
    
    return folder, video_id, start_ms, end_ms

def read_jsonl_file(filepath, max_lines=None):
    """
    Read JSONL file and return list of frames with detections.
    Each line is a JSON array of detections.
    
    Args:
        filepath: Path to JSONL file
        max_lines: Maximum number of lines to read (None for all lines)
    """
    frames_data = []
    with open(filepath, 'r', encoding='utf-8') as f:
        for line_num, line in enumerate(f, 1):
            # Stop if we've reached max_lines
            if max_lines is not None and line_num > max_lines:
                break
                
            line = line.strip()
            if not line:
                continue
            try:
                detections = json.loads(line)
                # Skip empty arrays
                if isinstance(detections, list) and len(detections) == 0:
                    continue
                    
                frames_data.append({
                    'line_num': line_num,
                    'detections': detections if isinstance(detections, list) else []
                })
            except json.JSONDecodeError as e:
                print(f"Warning: Failed to parse line {line_num}: {e}")
                continue
    return frames_data

def process_detections(frames_data, duration):
    """
    Process detections from JSONL and convert to database format.
    Groups consecutive frame appearances into intervals.
    Each interval is recorded as one record with the start_timestamp of that interval.
    Returns: (objects_list, detected_object_types)
    """
    objects_list = []
    detected_object_types_set = set()
    
    # Track last timestamp for each object_name to detect intervals
    # Format: {object_name: last_timestamp}
    object_last_timestamp = {}
    
    # Track the start frame and timestamp for the current interval of each object
    # Format: {object_name: {'start_frame': frame_id, 'start_timestamp': timestamp, 'confidence': score, 'bbox': bbox}}
    object_current_interval = {}
    
    # Collect all frame_ids to determine range
    frame_ids = []
    for frame_data in frames_data:
        detections = frame_data['detections']
        for detection in detections:
            frame_id = detection.get('frame_id')
            if frame_id is not None:
                frame_ids.append(frame_id)
    
    # Calculate timestamp based on frame_id range
    if frame_ids and duration > 0:
        min_frame_id = min(frame_ids)
        max_frame_id = max(frame_ids)
        frame_range = max_frame_id - min_frame_id
        # If all frames are the same, use line number as fallback
        if frame_range == 0:
            frame_range = len(frames_data) - 1 if len(frames_data) > 1 else 1
    else:
        min_frame_id = 0
        frame_range = len(frames_data) - 1 if len(frames_data) > 1 else 1
    
    # Process each frame - group consecutive appearances into intervals
    for frame_data in frames_data:
        detections = frame_data['detections']
        line_num = frame_data['line_num']
        
        for detection in detections:
            frame_id = detection.get('frame_id', line_num - 1)  # Use frame_id from JSON, or line number - 1
            class_name = detection.get('class_name')
            score = detection.get('score', 0.0)
            bbox = detection.get('bbox', [])
            
            if not class_name:
                continue
            
            # Add to detected object types
            detected_object_types_set.add(class_name)
            
            # Calculate current frame timestamp
            if frame_range > 0:
                relative_frame = frame_id - min_frame_id
                current_timestamp = (relative_frame / frame_range) * duration
            else:
                current_timestamp = 0.0
            
            # Check if this is a new interval (disconnected from last appearance)
            # Use timestamp difference: if gap > 1.0 second, it's a new interval
            is_new_interval = False
            
            if class_name not in object_last_timestamp:
                # First time seeing this object - start new interval
                is_new_interval = True
            elif current_timestamp - object_last_timestamp[class_name] > 1.0:
                # Time gap > 1.0 second means disconnected - start new interval
                # First, save the previous interval
                prev_interval = object_current_interval[class_name]
                objects_list.append({
                    'object_name': class_name,
                    'confidence': prev_interval['confidence'],
                    'bbox': prev_interval['bbox'],
                    'frame': prev_interval['start_frame'],
                    'start_timestamp': prev_interval['start_timestamp'],
                    'end_timestamp': None
                })
                is_new_interval = True
            
            if is_new_interval:
                # Start a new interval
                object_current_interval[class_name] = {
                    'start_frame': frame_id,
                    'start_timestamp': current_timestamp,
                    'confidence': score,
                    'bbox': bbox if bbox else None
                }
            
            # Update last timestamp for this object
            object_last_timestamp[class_name] = current_timestamp
    
    # After processing all frames, save any remaining intervals
    for class_name, interval_info in object_current_interval.items():
        objects_list.append({
            'object_name': class_name,
            'confidence': interval_info['confidence'],
            'bbox': interval_info['bbox'],
            'frame': interval_info['start_frame'],
            'start_timestamp': interval_info['start_timestamp'],
            'end_timestamp': None
        })
    
    detected_object_types = sorted(list(detected_object_types_set))
    return objects_list, detected_object_types

def upload_video_from_jsonl(jsonl_filepath, s3_bucket_name=None, max_lines=None):
    """
    Upload video data from JSONL file to database.
    
    Args:
        jsonl_filepath: Path to JSONL file (e.g., test_05DY96RM6YQ_13000_31000.jsonl)
        s3_bucket_name: S3 bucket name (defaults to S3_BUCKET_NAME from .env)
        max_lines: Maximum number of lines to process (None for all lines, useful for testing)
    """
    # Parse filename
    folder, video_id, start_ms, end_ms = parse_jsonl_filename(jsonl_filepath)
    
    # Calculate duration in seconds
    duration = (end_ms - start_ms) / 1000.0
    
    # Construct video path
    if s3_bucket_name is None:
        s3_bucket_name = os.getenv('S3_BUCKET_NAME', 'tfmc-youtube-data')
    video_path = f"s3://{s3_bucket_name}/{folder}/{video_id}_{start_ms}_{end_ms}.mp4"
    
    # Video name (filename without extension)
    video_name = os.path.basename(jsonl_filepath).replace('.jsonl', '')
    
    # Read JSONL file
    if max_lines:
        print(f"Reading JSONL file (first {max_lines} lines): {jsonl_filepath}")
    else:
        print(f"Reading JSONL file: {jsonl_filepath}")
    frames_data = read_jsonl_file(jsonl_filepath, max_lines=max_lines)
    
    # Process detections
    print(f"Processing {len(frames_data)} frames...")
    objects_list, detected_object_types = process_detections(frames_data, duration)
    
    print(f"Found {len(objects_list)} object detections")
    print(f"Detected object types: {detected_object_types}")
    
    # Get database connection from environment
    connection_string = os.getenv('AWS_RDS_CONNECTION_STRING')
    if not connection_string:
        raise ValueError("AWS_RDS_CONNECTION_STRING not found in environment variables")
    
    # Parse connection string
    parsed = urlparse(connection_string)
    pg_host = parsed.hostname
    pg_port = parsed.port or 5432
    pg_db = parsed.path.lstrip('/').split('?')[0] or 'postgres'
    pg_user = parsed.username
    pg_password = parsed.password
    
    # Connect to database
    print(f"Connecting to database: {pg_host}:{pg_port}/{pg_db}")
    conn = psycopg2.connect(
        host=pg_host,
        port=pg_port,
        database=pg_db,
        user=pg_user,
        password=pg_password,
        sslmode='require'
    )
    cursor = conn.cursor()
    
    try:
        # Check if video already exists (by video_name or video_path)
        check_sql = """
            SELECT video_id FROM videos 
            WHERE video_name = %s OR video_path = %s
            LIMIT 1;
        """
        cursor.execute(check_sql, (video_name, video_path))
        existing = cursor.fetchone()
        
        if existing:
            video_id = existing[0]
            print(f"Video already exists with ID: {video_id}")
            print(f"  Video name: {video_name}")
            print(f"  Video path: {video_path}")
            print("Deleting existing objects and inserting new ones...")
            # Delete existing objects for this video
            delete_objects_sql = "DELETE FROM objects WHERE video_id = %s;"
            cursor.execute(delete_objects_sql, (video_id,))
            deleted_count = cursor.rowcount
            print(f"Deleted {deleted_count} existing object detections")
        else:
            # Insert video
            upload_time = datetime.now()
            processed = True
            detected_object_types_str = ','.join(detected_object_types) if detected_object_types else None
            
            insert_video_sql = """
                INSERT INTO videos (video_name, video_path, duration, upload_time, processed, detected_object_types)
                VALUES (%s, %s, %s, %s, %s, %s)
                RETURNING video_id;
            """
            
            cursor.execute(
                insert_video_sql,
                (
                    video_name,
                    video_path,
                    duration,
                    upload_time,
                    processed,
                    detected_object_types_str,
                )
            )
            
            video_id = cursor.fetchone()[0]
            print(f"Inserted video with ID: {video_id}")
        
        # Insert objects
        if objects_list:
            insert_objects_sql = """
                INSERT INTO objects
                (video_id, object_name, confidence, bbox, frame, start_timestamp, end_timestamp)
                VALUES %s;
            """
            
            objects_values = [
                (
                    video_id,
                    obj['object_name'],
                    obj['confidence'],
                    Json(obj['bbox']) if obj['bbox'] else None,  # Convert list to JSONB
                    obj['frame'],
                    obj['start_timestamp'],
                    obj['end_timestamp']
                )
                for obj in objects_list
            ]
            
            execute_values(cursor, insert_objects_sql, objects_values)
            print(f"Inserted {len(objects_list)} object detections")
        
        conn.commit()
        print("Upload completed successfully!")
        return video_id
        
    except Exception as e:
        conn.rollback()
        print(f"Error during upload: {e}")
        raise
    finally:
        cursor.close()
        conn.close()

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python uploader.py <jsonl_filepath> [--test]")
        print("  --test: Only process first 100 lines (for testing)")
        sys.exit(1)
    
    jsonl_filepath = sys.argv[1]
    test_mode = '--test' in sys.argv
    
    if not os.path.exists(jsonl_filepath):
        print(f"Error: File not found: {jsonl_filepath}")
        sys.exit(1)
    
    try:
        max_lines = 100 if test_mode else None
        upload_video_from_jsonl(jsonl_filepath, max_lines=max_lines)
    except Exception as e:
        print(f"Upload failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
