import { useState } from "react";
import { api } from "@/lib/api";
import { VideoQueryForm } from "@/components/VideoQueryForm";
import { ObjectsWithTimestepsList } from "@/components/ObjectsWithTimestepsList";
import { TimestepsList } from "@/components/TimestepsList";
import { VideoPlayer } from "@/components/VideoPlayer";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle2, XCircle, Loader2, Database } from "lucide-react";

interface Timestep {
  timestamp: number;
  frame: number;
}

interface ObjectWithTimesteps {
  object: string;
  timesteps: Timestep[];
}

const Index = () => {
  const [objectsWithTimesteps, setObjectsWithTimesteps] = useState<ObjectWithTimesteps[]>([]);
  const [timesteps, setTimesteps] = useState<Timestep[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<{
    status: 'success' | 'error' | null;
    message: string;
    details?: any;
  } | null>(null);
  const [queriedVideoId, setQueriedVideoId] = useState<string>();
  const [queriedObjectName, setQueriedObjectName] = useState<string>();
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [currentVideoTimestamp, setCurrentVideoTimestamp] = useState<number | undefined>(undefined);
  const { toast } = useToast();

  const handleTestConnection = async () => {
    setIsTestingConnection(true);
    setConnectionStatus(null);

    try {
      const response = await api.queryRDS({ test: true });

      if (response.error) throw new Error(response.error);

      setConnectionStatus({
        status: 'success',
        message: response.message || 'Connection test successful',
        details: response.data
      });

      toast({
        title: "Connection Test Successful",
        description: `Connected to AWS RDS: ${response.data?.database_name || 'Unknown database'}`,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setConnectionStatus({
        status: 'error',
        message: errorMessage
      });
      toast({
        title: "Connection Test Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleQuery = async (videoId: string, objectName?: string) => {
    setIsLoading(true);
    setQueriedVideoId(videoId);
    setQueriedObjectName(objectName);
    setObjectsWithTimesteps([]);
    setTimesteps([]);

    try {
      const response = await api.queryRDS({ 
        videoId: parseInt(videoId), 
        objectName 
      });

      if (response.error) throw new Error(response.error);

      // Update video URL if provided
      if (response.videoUrl) {
        setVideoUrl(response.videoUrl);
      }

      // If objectName is provided, we get a list of timesteps
      if (objectName && objectName.trim() !== '') {
        setTimesteps(response.data || []);
        toast({
          title: "Query successful",
          description: `Found ${response.data?.length || 0} timestep(s) for "${objectName}"`,
        });
      } else {
        // If only videoId, we get list of (object, timesteps)
        setObjectsWithTimesteps(response.data || []);
        const totalObjects = response.data?.length || 0;
        const totalTimesteps = response.data?.reduce((sum: number, obj: ObjectWithTimesteps) => sum + obj.timesteps.length, 0) || 0;
        toast({
          title: "Query successful",
          description: `Found ${totalObjects} object(s) with ${totalTimesteps} total timestep(s)`,
        });
      }
    } catch (error) {
      console.error("Error querying objects:", error);
      toast({
        title: "Query failed",
        description: error instanceof Error ? error.message : "Failed to retrieve objects. Please try again.",
        variant: "destructive",
      });
      setObjectsWithTimesteps([]);
      setTimesteps([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTimestepClick = (timestamp: number) => {
    setCurrentVideoTimestamp(timestamp);
    toast({
      title: "Jumping to timestamp",
      description: `Seeking to ${timestamp.toFixed(2)}s`,
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <header className="mb-8 text-center">
          <h1 className="mb-2 text-4xl font-bold">TechnipFMC Video Processing</h1>
          <p className="text-lg text-muted-foreground">Query detected objects from video analysis</p>
        </header>

        <main className="flex flex-col items-center gap-8">
          {/* Connection Test Card */}
          <Card className="w-full max-w-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                AWS RDS Connection Status
              </CardTitle>
              <CardDescription>
                Test the connection to AWS RDS PostgreSQL database
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                onClick={handleTestConnection}
                disabled={isTestingConnection}
                variant="outline"
                className="w-full"
              >
                {isTestingConnection ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Testing Connection...
                  </>
                ) : (
                  <>
                    <Database className="mr-2 h-4 w-4" />
                    Test Connection
                  </>
                )}
              </Button>

              {connectionStatus && (
                <Alert
                  variant={connectionStatus.status === 'success' ? 'default' : 'destructive'}
                >
                  {connectionStatus.status === 'success' ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <XCircle className="h-4 w-4" />
                  )}
                  <AlertTitle>
                    {connectionStatus.status === 'success' ? 'Connection Successful' : 'Connection Failed'}
                  </AlertTitle>
                  <AlertDescription className="space-y-2">
                    <p>{connectionStatus.message}</p>
                    {connectionStatus.details && connectionStatus.status === 'success' && (
                      <div className="mt-2 space-y-1 text-sm">
                        <p><strong>Database:</strong> {connectionStatus.details.database_name}</p>
                        <p><strong>User:</strong> {connectionStatus.details.current_user}</p>
                        <p><strong>PostgreSQL Version:</strong> {connectionStatus.details.postgres_version?.split(' ')[0]} {connectionStatus.details.postgres_version?.split(' ')[1]}</p>
                        <p><strong>Objects Table Exists:</strong> {connectionStatus.details.objects_table_exists ? 'Yes' : 'No'}</p>
                        <p><strong>Server Time:</strong> {new Date(connectionStatus.details.server_time).toLocaleString()}</p>
                      </div>
                    )}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          <VideoQueryForm onQuery={handleQuery} isLoading={isLoading} />
          
          {/* Video Player */}
          {(objectsWithTimesteps.length > 0 || timesteps.length > 0) && (
            <VideoPlayer 
              videoUrl={videoUrl}
              currentTimestamp={currentVideoTimestamp}
              onTimestampChange={(timestamp) => {
                // Optional: update current timestamp display
                console.log('Video time:', timestamp);
              }}
            />
          )}
          
          {/* Show objects with timesteps when only videoId is provided */}
          {objectsWithTimesteps.length > 0 && (
            <ObjectsWithTimestepsList 
              objects={objectsWithTimesteps}
              videoId={queriedVideoId}
              onObjectClick={(objectName) => {
                // Re-query with object name
                if (queriedVideoId) {
                  handleQuery(queriedVideoId, objectName);
                }
              }}
            />
          )}

          {/* Show timesteps list when videoId + objectName is provided */}
          {timesteps.length > 0 && (
            <TimestepsList 
              timesteps={timesteps}
              videoId={queriedVideoId}
              objectName={queriedObjectName}
              onTimestepClick={handleTimestepClick}
            />
          )}
        </main>
      </div>
    </div>
  );
};

export default Index;
