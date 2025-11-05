-- Create videos table
CREATE TABLE public.videos (
  video_id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create objects table to store detection results
CREATE TABLE public.objects (
  id SERIAL PRIMARY KEY,
  video_id INTEGER NOT NULL REFERENCES public.videos(video_id) ON DELETE CASCADE,
  object_name TEXT NOT NULL,
  timestamp FLOAT NOT NULL,
  confidence FLOAT NOT NULL,
  bbox JSONB NOT NULL,
  frame INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.objects ENABLE ROW LEVEL SECURITY;

-- Create policies for public read access (adjust as needed for your security requirements)
CREATE POLICY "Allow public read access to videos"
  ON public.videos
  FOR SELECT
  USING (true);

CREATE POLICY "Allow public read access to objects"
  ON public.objects
  FOR SELECT
  USING (true);

-- Create indexes for better query performance
CREATE INDEX idx_objects_video_id ON public.objects(video_id);
CREATE INDEX idx_objects_object_name ON public.objects(object_name);
CREATE INDEX idx_objects_video_id_object_name ON public.objects(video_id, object_name);