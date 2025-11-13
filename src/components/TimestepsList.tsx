import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Play, Clock } from "lucide-react";

interface Timestep {
  timestamp: number;
  frame: number;
}

interface TimestepsListProps {
  timesteps: Timestep[];
  videoId?: string;
  objectName?: string;
  onTimestepClick: (timestamp: number) => void;
}

export const TimestepsList = ({ 
  timesteps, 
  videoId, 
  objectName,
  onTimestepClick 
}: TimestepsListProps) => {
  if (!timesteps || timesteps.length === 0) {
    return (
      <Card className="w-full">
        <CardContent className="py-8">
          <p className="text-center text-muted-foreground">
            No timesteps found. {objectName && `Try searching for "${objectName}" in video ${videoId}.`}
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
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Timesteps
        </CardTitle>
        <CardDescription>
          Found {timesteps.length} timestep{timesteps.length !== 1 ? 's' : ''} for{" "}
          <Badge variant="secondary">{objectName}</Badge> in video {videoId}.
          Click on a timestep to jump to that moment in the video.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {timesteps.map((timestep, index) => (
            <Button
              key={index}
              variant="outline"
              className="h-auto py-3 px-4 flex flex-col items-start gap-1 hover:bg-primary hover:text-primary-foreground transition-colors"
              onClick={() => onTimestepClick(timestep.timestamp)}
            >
              <div className="flex items-center gap-2 w-full">
                <Play className="h-4 w-4" />
                <span className="font-mono text-sm font-semibold">
                  {formatTimestamp(timestep.timestamp)}
                </span>
              </div>
              <span className="text-xs text-muted-foreground">
                Frame {timestep.frame}
              </span>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

