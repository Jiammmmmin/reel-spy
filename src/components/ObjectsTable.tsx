import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface DetectedObject {
  id: number;
  video_id: number;
  object_name: string;
  timestamp: number;
  confidence: number;
  bbox: any;
  frame: number;
}

interface ObjectsTableProps {
  objects: DetectedObject[];
  videoId?: string;
  objectName?: string;
}

export const ObjectsTable = ({ objects, videoId, objectName }: ObjectsTableProps) => {
  if (!objects || objects.length === 0) {
    return (
      <Card className="w-full">
        <CardContent className="py-8">
          <p className="text-center text-muted-foreground">
            No objects found. {videoId && `Try searching for video ID ${videoId} with different filters.`}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Detection Results</CardTitle>
        <CardDescription>
          {objectName
            ? `Showing ${objects.length} "${objectName}" object(s) detected in video ${videoId}`
            : `Showing ${objects.length} object(s) detected in video ${videoId}`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Object Name</TableHead>
                <TableHead>Frame</TableHead>
                <TableHead>Timestamp</TableHead>
                <TableHead>Confidence</TableHead>
                <TableHead>Bounding Box</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {objects.map((obj) => (
                <TableRow key={obj.id}>
                  <TableCell className="font-medium">{obj.id}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{obj.object_name}</Badge>
                  </TableCell>
                  <TableCell>{obj.frame}</TableCell>
                  <TableCell>{obj.timestamp.toFixed(2)}s</TableCell>
                  <TableCell>
                    <span className={obj.confidence >= 0.8 ? "text-green-600 font-medium" : ""}>
                      {(obj.confidence * 100).toFixed(1)}%
                    </span>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {JSON.stringify(obj.bbox)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};
