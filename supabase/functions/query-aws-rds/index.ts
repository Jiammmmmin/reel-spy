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
    const { videoId, objectName } = await req.json();
    console.log('Querying AWS RDS for videoId:', videoId, 'objectName:', objectName);

    // Connect to AWS RDS PostgreSQL
    const connectionString = Deno.env.get('AWS_RDS_CONNECTION_STRING');
    if (!connectionString) {
      throw new Error('AWS_RDS_CONNECTION_STRING not configured');
    }

    client = new Client(connectionString);
    await client.connect();
    console.log('Connected to AWS RDS successfully');

    // Build the query
    let query = `
      SELECT o.* 
      FROM objects o
      WHERE o.video_id = $1
    `;
    const params: any[] = [videoId];

    if (objectName && objectName.trim() !== '') {
      query += ` AND o.object_name ILIKE $2`;
      params.push(`%${objectName}%`);
    }

    query += ` ORDER BY o.frame ASC`;

    console.log('Executing query:', query, 'with params:', params);

    // Execute query
    const result = await client.queryObject(query, params);
    console.log(`Found ${result.rows.length} objects`);

    return new Response(
      JSON.stringify({ data: result.rows, error: null }),
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
