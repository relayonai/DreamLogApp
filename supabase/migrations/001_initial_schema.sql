CREATE TABLE users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  created_at timestamptz DEFAULT now(),
  preferences jsonb DEFAULT '{
    "wake_window_start": null,
    "wake_window_end": null,
    "wake_word_enabled": false,
    "watch_paired": false,
    "default_comic_style": "classic"
  }'::jsonb
);

CREATE TABLE dreams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recorded_at timestamptz NOT NULL,
  audio_url text,
  transcription_raw text,
  transcription_enhanced text,
  comic_style text CHECK (comic_style IN ('classic','graphic_novel','manga','surreal')),
  mood_genre text,
  status text NOT NULL DEFAULT 'processing'
    CHECK (status IN ('processing','ready','failed','pending_sync')),
  low_confidence boolean DEFAULT false,
  export_url text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE scenes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dream_id uuid NOT NULL REFERENCES dreams(id) ON DELETE CASCADE,
  order_index integer NOT NULL,
  text_content text NOT NULL,
  image_url text,
  gap_filled boolean DEFAULT false,
  tone_applied text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE gap_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scene_id uuid NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
  original_text text NOT NULL,
  suggested_text text NOT NULL,
  tone text NOT NULL,
  accepted boolean DEFAULT false
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE dreams ENABLE ROW LEVEL SECURITY;
ALTER TABLE scenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE gap_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users: own row" ON users FOR ALL USING (auth.uid() = id);
CREATE POLICY "dreams: own rows" ON dreams FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "scenes: via dreams" ON scenes FOR ALL USING (
  EXISTS (SELECT 1 FROM dreams WHERE dreams.id = scenes.dream_id AND dreams.user_id = auth.uid())
);
CREATE POLICY "gap_suggestions: via scenes" ON gap_suggestions FOR ALL USING (
  EXISTS (
    SELECT 1 FROM scenes
    JOIN dreams ON dreams.id = scenes.dream_id
    WHERE scenes.id = gap_suggestions.scene_id AND dreams.user_id = auth.uid()
  )
);

-- Storage bucket policies (create buckets audio, images, exports in Supabase dashboard first)
CREATE POLICY "audio: user owns" ON storage.objects FOR ALL
  USING (bucket_id = 'audio' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "images: user owns" ON storage.objects FOR ALL
  USING (bucket_id = 'images' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "exports: user owns" ON storage.objects FOR ALL
  USING (bucket_id = 'exports' AND (storage.foldername(name))[1] = auth.uid()::text);
