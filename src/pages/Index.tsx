import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { VideoQueryForm } from "@/components/VideoQueryForm";
import { ObjectsTable } from "@/components/ObjectsTable";
import { useToast } from "@/hooks/use-toast";

interface DetectedObject {
  id: number;
  video_id: number;
  object_name: string;
  timestamp: number;
  confidence: number;
  bbox: any;
  frame: number;
}

const Index = () => {
  const [objects, setObjects] = useState<DetectedObject[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [queriedVideoId, setQueriedVideoId] = useState<string>();
  const [queriedObjectName, setQueriedObjectName] = useState<string>();
  const { toast } = useToast();

  const handleQuery = async (videoId: string, objectName?: string) => {
    setIsLoading(true);
    setQueriedVideoId(videoId);
    setQueriedObjectName(objectName);

    try {
      let query = supabase
        .from("objects")
        .select("*")
        .eq("video_id", parseInt(videoId))
        .order("timestamp", { ascending: true });

      if (objectName) {
        query = query.eq("object_name", objectName);
      }

      const { data, error } = await query;

      if (error) throw error;

      setObjects(data || []);

      toast({
        title: "Query successful",
        description: `Found ${data?.length || 0} object(s)`,
      });
    } catch (error) {
      console.error("Error querying objects:", error);
      toast({
        title: "Query failed",
        description: "Failed to retrieve objects. Please try again.",
        variant: "destructive",
      });
      setObjects([]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <header className="mb-8 text-center">
          <h1 className="mb-2 text-4xl font-bold">TechnipFMC Video Processing</h1>
          <p className="text-lg text-muted-foreground">Query detected objects from video analysis</p>
        </header>

        <main className="flex flex-col items-center gap-8">
          <VideoQueryForm onQuery={handleQuery} isLoading={isLoading} />
          {objects.length > 0 && (
            <ObjectsTable 
              objects={objects} 
              videoId={queriedVideoId}
              objectName={queriedObjectName}
            />
          )}
        </main>
      </div>
    </div>
  );
};

export default Index;
