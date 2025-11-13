import express from 'express';
import cors from 'cors';
import pg from 'pg';
import dotenv from 'dotenv';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

dotenv.config();

const app = express();
const { Pool } = pg;

// Middleware
app.use(cors());
app.use(express.json());

// Database connection pool
// Parse connection string and configure SSL properly
const connectionString = process.env.AWS_RDS_CONNECTION_STRING;
const needsSSL = connectionString?.includes('sslmode=require');

const pool = new Pool({
  connectionString: connectionString,
  ssl: needsSSL ? {
    rejectUnauthorized: false
  } : undefined
});

// Initialize S3 client
const s3Client = new S3Client({
  region: process.env.S3_REGION || 'us-east-1',
  credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY ? {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  } : undefined, // Will use default AWS credentials if not provided
});

// Helper function to convert video_path to S3 URL (with presigned URL)
const getS3Url = async (path) => {
  if (!path) return null;
  
  // Check if path already contains bucket name or is a full URL
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  
  // Remove leading slash if present
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  
  // Get S3 bucket from environment
  const s3Bucket = process.env.S3_BUCKET_NAME || 'tfmc-youtube-data';
  
  // Option 1: Use CloudFront or CDN if configured
  const cloudfrontUrl = process.env.CLOUDFRONT_URL;
  if (cloudfrontUrl) {
    return `${cloudfrontUrl}/${cleanPath}`;
  }
  
  // Option 2: Generate presigned URL (secure, temporary access)
  try {
    const command = new GetObjectCommand({
      Bucket: s3Bucket,
      Key: cleanPath,
    });
    
    // Generate presigned URL valid for 1 hour
    const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
    return presignedUrl;
  } catch (error) {
    console.error('Error generating presigned URL:', error);
    // Fallback to direct URL (will fail if bucket is private)
    return `https://${s3Bucket}.s3.${process.env.S3_REGION || 'us-east-1'}.amazonaws.com/${cleanPath}`;
  }
};

// Test connection endpoint
app.post('/api/query-aws-rds', async (req, res) => {
  let client = null;
  
  try {
    const { videoId, objectName, test } = req.body;
    
    // Connection test mode
    if (test === true || test === 'true') {
      client = await pool.connect();
      
      // Test query - get PostgreSQL version and current database
      const testResult = await client.query(`
        SELECT 
          version() as postgres_version,
          current_database() as database_name,
          current_user as current_user,
          now() as server_time
      `);
      
      // Check if objects table exists
      const tableCheck = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'objects'
        ) as objects_table_exists
      `);
      
      const connectionInfo = {
        ...testResult.rows[0],
        ...tableCheck.rows[0],
        connection_status: 'success',
        timestamp: new Date().toISOString()
      };

      return res.json({
        data: connectionInfo,
        error: null,
        message: 'Connection test successful'
      });
    }

    // Normal query mode
    if (!videoId) {
      return res.status(400).json({
        data: null,
        error: 'videoId is required for query'
      });
    }

    console.log('Querying AWS RDS for videoId:', videoId, 'objectName:', objectName);
    
    client = await pool.connect();
    
    // First, get video info including video_path
    const videoQuery = `
      SELECT v.video_path, v.video_name, v.duration
      FROM videos v
      WHERE v.video_id = $1
    `;
    const videoResult = await client.query(videoQuery, [videoId]);
    
    if (videoResult.rows.length === 0) {
      return res.status(404).json({
        data: null,
        error: `Video with ID ${videoId} not found`
      });
    }
    
    const videoInfo = videoResult.rows[0];
    const videoPath = videoInfo.video_path;

    // If objectName is provided, return list of timesteps for that object
    if (objectName && objectName.trim() !== '') {
      const query = `
        SELECT o.start_timestamp, o.end_timestamp, o.frame
        FROM objects o
        WHERE o.video_id = $1 AND o.object_name ILIKE $2
        ORDER BY o.start_timestamp ASC
      `;
      const params = [videoId, `%${objectName.trim()}%`];
      
      console.log('Executing query:', query, 'with params:', params);
      const result = await client.query(query, params);
      console.log(`Found ${result.rows.length} timesteps for object "${objectName}"`);

      // Return list of timesteps
      const timesteps = result.rows.map((row) => ({
        timestamp: parseFloat(row.start_timestamp || 0),
        endTimestamp: row.end_timestamp ? parseFloat(row.end_timestamp) : null,
        frame: row.frame ? parseInt(row.frame) : null
      }));

      const videoUrl = await getS3Url(videoPath);
      
      return res.json({
        data: timesteps,
        videoUrl: videoUrl,
        videoInfo: {
          videoName: videoInfo.video_name,
          duration: videoInfo.duration
        },
        error: null
      });
    }

    // If only videoId is provided, return grouped by object_name with timesteps
    const query = `
      SELECT 
        o.object_name,
        ARRAY_AGG(
          json_build_object(
            'start_timestamp', o.start_timestamp,
            'end_timestamp', o.end_timestamp,
            'frame', o.frame
          ) ORDER BY o.start_timestamp ASC
        ) as timesteps
      FROM objects o
      WHERE o.video_id = $1
      GROUP BY o.object_name
      ORDER BY o.object_name ASC
    `;
    const params = [videoId];
    
    console.log('Executing query:', query, 'with params:', params);
    const result = await client.query(query, params);
    console.log(`Found ${result.rows.length} unique objects`);

    // Transform the data
    const groupedData = result.rows.map((row) => ({
      object: row.object_name,
      timesteps: row.timesteps.map((ts) => ({
        timestamp: parseFloat(ts.start_timestamp || 0),
        endTimestamp: ts.end_timestamp ? parseFloat(ts.end_timestamp) : null,
        frame: ts.frame ? parseInt(ts.frame) : null
      }))
    }));

    const videoUrl = await getS3Url(videoPath);
    
    return res.json({
      data: groupedData,
      videoUrl: videoUrl,
      videoInfo: {
        videoName: videoInfo.video_name,
        duration: videoInfo.duration
      },
      error: null
    });

  } catch (error) {
    console.error('Error querying AWS RDS:', error);
    return res.status(500).json({
      data: null,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  } finally {
    if (client) {
      client.release();
    }
  }
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`API endpoint: http://localhost:${PORT}/api/query-aws-rds`);
});

