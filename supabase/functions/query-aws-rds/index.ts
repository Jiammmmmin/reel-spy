import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let client: Client | null = null;

  try {
    const body = await req.json().catch(() => ({}));
    const { videoId, objectName, test } = body;
    
    // Connection test mode
    if (test === true || test === 'true') {
      const connectionString = Deno.env.get('AWS_RDS_CONNECTION_STRING');
      if (!connectionString) {
        throw new Error('AWS_RDS_CONNECTION_STRING not configured');
      }

      // Ensure SSL is enabled for AWS RDS connections
      let finalConnectionString = connectionString;
      if (!connectionString.includes('sslmode=')) {
        const separator = connectionString.includes('?') ? '&' : '?';
        finalConnectionString = `${connectionString}${separator}sslmode=require`;
      }

      client = new Client(finalConnectionString);
      await client.connect();
      console.log('Connected to AWS RDS successfully');

      // Test query - get PostgreSQL version and current database
      const testResult = await client.queryObject(`
        SELECT 
          version() as postgres_version,
          current_database() as database_name,
          current_user as current_user,
          now() as server_time
      `);
      
      // Check if objects table exists
      const tableCheck = await client.queryObject(`
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

      return new Response(
        JSON.stringify({ 
          data: connectionInfo, 
          error: null,
          message: 'Connection test successful'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
    }

    // Normal query mode
    if (!videoId) {
      throw new Error('videoId is required for query');
    }

    console.log('Querying AWS RDS for videoId:', videoId, 'objectName:', objectName);

    // Connect to AWS RDS PostgreSQL
    const connectionString = Deno.env.get('AWS_RDS_CONNECTION_STRING');
    if (!connectionString) {
      throw new Error('AWS_RDS_CONNECTION_STRING not configured');
    }

    // Ensure SSL is enabled for AWS RDS connections
    let finalConnectionString = connectionString;
    if (!connectionString.includes('sslmode=')) {
      const separator = connectionString.includes('?') ? '&' : '?';
      finalConnectionString = `${connectionString}${separator}sslmode=require`;
    }

    client = new Client(finalConnectionString);
    await client.connect();
    console.log('Connected to AWS RDS successfully');

    // First, get video info including video_path
    const videoQuery = `
      SELECT v.video_path, v.video_name, v.duration
      FROM videos v
      WHERE v.video_id = $1
    `;
    const videoResult = await client.queryObject(videoQuery, [videoId]);
    
    if (videoResult.rows.length === 0) {
      throw new Error(`Video with ID ${videoId} not found`);
    }
    
    const videoInfo = videoResult.rows[0] as any;
    const videoPath = videoInfo.video_path;
    
    // Helper function to convert video_path to S3 URL
    const getS3Url = (path: string | null): string | null => {
      if (!path) return null;
      
      // Remove leading slash if present
      const cleanPath = path.startsWith('/') ? path.slice(1) : path;
      
      // Get S3 bucket from environment or use default
      const s3Bucket = Deno.env.get('S3_BUCKET_NAME') || 'tfmc-youtube-data';
      const s3Region = Deno.env.get('S3_REGION') || 'us-east-1';
      
      // Check if path already contains bucket name or is a full URL
      if (path.startsWith('http://') || path.startsWith('https://')) {
        return path;
      }
      
      // Construct S3 URL
      // Format: https://{bucket}.s3.{region}.amazonaws.com/{path}
      // Or: https://s3.{region}.amazonaws.com/{bucket}/{path}
      return `https://${s3Bucket}.s3.${s3Region}.amazonaws.com/${cleanPath}`;
    };

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
      const result = await client.queryObject(query, params);
      console.log(`Found ${result.rows.length} timesteps for object "${objectName}"`);

      // Return list of timesteps (using start_timestamp as the main timestamp)
      const timesteps = result.rows.map((row: any) => ({
        timestamp: parseFloat(row.start_timestamp || 0),
        endTimestamp: row.end_timestamp ? parseFloat(row.end_timestamp) : null,
        frame: row.frame ? parseInt(row.frame) : null
      }));

      return new Response(
        JSON.stringify({ 
          data: timesteps, 
          videoUrl: getS3Url(videoPath),
          videoInfo: {
            videoName: videoInfo.video_name,
            duration: videoInfo.duration
          },
          error: null 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
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
    const result = await client.queryObject(query, params);
    console.log(`Found ${result.rows.length} unique objects`);

    // Transform the data
    const groupedData = result.rows.map((row: any) => ({
      object: row.object_name,
      timesteps: row.timesteps.map((ts: any) => ({
        timestamp: parseFloat(ts.start_timestamp || 0),
        endTimestamp: ts.end_timestamp ? parseFloat(ts.end_timestamp) : null,
        frame: ts.frame ? parseInt(ts.frame) : null
      }))
    }));

    return new Response(
      JSON.stringify({ 
        data: groupedData, 
        videoUrl: getS3Url(videoPath),
        videoInfo: {
          videoName: videoInfo.video_name,
          duration: videoInfo.duration
        },
        error: null 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error querying AWS RDS:', error);
    return new Response(
      JSON.stringify({ 
        data: null, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  } finally {
    if (client) {
      try {
        await client.end();
        console.log('Database connection closed');
      } catch (error) {
        console.error('Error closing connection:', error);
      }
    }
  }
});
