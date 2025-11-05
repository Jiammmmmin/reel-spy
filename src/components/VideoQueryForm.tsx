import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface VideoQueryFormProps {
  onQuery: (videoId: string, objectName?: string) => void;
  isLoading: boolean;
}

export const VideoQueryForm = ({ onQuery, isLoading }: VideoQueryFormProps) => {
  const [videoId, setVideoId] = useState("");
  const [objectName, setObjectName] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (videoId.trim()) {
      onQuery(videoId.trim(), objectName.trim() || undefined);
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>Query Video Objects</CardTitle>
        <CardDescription>
          Enter a video ID to view all detected objects, or add an object name to filter results
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="videoId">Video ID *</Label>
            <Input
              id="videoId"
              type="number"
              placeholder="Enter video ID"
              value={videoId}
              onChange={(e) => setVideoId(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="objectName">Object Name (optional)</Label>
            <Input
              id="objectName"
              type="text"
              placeholder="Enter object name to filter"
              value={objectName}
              onChange={(e) => setObjectName(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={isLoading || !videoId} className="w-full">
            {isLoading ? "Loading..." : "Search Objects"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
