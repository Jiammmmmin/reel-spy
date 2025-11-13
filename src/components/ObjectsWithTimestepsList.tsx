import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronRight } from "lucide-react";

interface Timestep {
  timestamp: number;
  frame: number;
}

interface ObjectWithTimesteps {
  object: string;
  timesteps: Timestep[];
}

interface ObjectsWithTimestepsListProps {
  objects: ObjectWithTimesteps[];
  videoId?: string;
  onObjectClick: (objectName: string) => void;
}

export const ObjectsWithTimestepsList = ({ 
  objects, 
  videoId, 
  onObjectClick 
}: ObjectsWithTimestepsListProps) => {
  if (!objects || objects.length === 0) {
    return (
      <Card className="w-full">
        <CardContent className="py-8">
          <p className="text-center text-muted-foreground">
            No objects found. {videoId && `Try searching for video ID ${videoId}.`}
          </p>
        </CardContent>
      </Card>
    );
  }

  const formatTimestamp = (timestamp: number) => {
    const minutes = Math.floor(timestamp / 60);
    const seconds = Math.floor(timestamp % 60);
    const milliseconds = Math.floor((timestamp % 1) * 1000);
    if (minutes > 0) {
      return `${minutes}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
    }
    return `${seconds}.${milliseconds.toString().padStart(3, '0')}s`;
  };

  return (
    <Card className="w-full max-w-4xl">
      <CardHeader>
        <CardTitle>Detected Objects</CardTitle>
        <CardDescription>
          Found {objects.length} object(s) in video {videoId}. Click on an object to view all timesteps.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {objects.map((item, index) => (
            <Card key={index} className="border-2 hover:border-primary/50 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <Badge variant="secondary" className="text-base px-3 py-1">
                        {item.object}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {item.timesteps.length} timestep{item.timesteps.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {item.timesteps.slice(0, 5).map((ts, tsIndex) => (
                        <span 
                          key={tsIndex}
                          className="text-xs bg-muted px-2 py-1 rounded"
                        >
                          {formatTimestamp(ts.timestamp)}
                        </span>
                      ))}
                      {item.timesteps.length > 5 && (
                        <span className="text-xs text-muted-foreground px-2 py-1">
                          +{item.timesteps.length - 5} more
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onObjectClick(item.object)}
                    className="ml-4"
                  >
                    View All
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

