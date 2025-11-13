-- Voice Preferences and Cache System Migration
-- Supports multilingual TTS with Azure/Google providers

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Voice preferences table
CREATE TABLE IF NOT EXISTS public.voice_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  preschool_id UUID NOT NULL REFERENCES public.preschools(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('superadmin', 'principal', 'teacher', 'parent', 'student')),
  language_code TEXT NOT NULL CHECK (language_code IN ('en', 'af', 'zu', 'xh', 'st', 'nso')),
  provider_preference JSONB NOT NULL DEFAULT '{"tts": ["azure", "google", "device"], "stt": ["azure", "google", "whisper", "device"]}',
  tts_voice_id TEXT,
  tts_rate INTEGER DEFAULT 0 CHECK (tts_rate BETWEEN -50 AND 50),
  tts_pitch INTEGER DEFAULT 0 CHECK (tts_pitch BETWEEN -50 AND 50),
  tts_style TEXT CHECK (tts_style IN ('friendly', 'empathetic', 'professional', 'cheerful')),
  last_good_tts_provider TEXT,
  last_good_stt_provider TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (preschool_id, user_id)
);

CREATE INDEX idx_voice_prefs_preschool_lang ON public.voice_preferences(preschool_id, language_code);

-- TTS audio cache table
CREATE TABLE IF NOT EXISTS public.tts_audio_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  preschool_id UUID NOT NULL REFERENCES public.preschools(id) ON DELETE CASCADE,
  hash TEXT NOT NULL UNIQUE,
  text TEXT NOT NULL,
  language_code TEXT NOT NULL,
  voice_id TEXT,
  provider TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  size_bytes INTEGER,
  hit_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_tts_cache_preschool_lang ON public.tts_audio_cache(preschool_id, language_code);
CREATE INDEX idx_tts_cache_provider ON public.tts_audio_cache(provider);
CREATE INDEX idx_tts_cache_last_used ON public.tts_audio_cache(last_used_at);

-- Voice usage logs table
CREATE TABLE IF NOT EXISTS public.voice_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  preschool_id UUID NOT NULL REFERENCES public.preschools(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  service TEXT NOT NULL CHECK (service IN ('tts', 'stt')),
  provider TEXT NOT NULL,
  language_code TEXT NOT NULL,
  units NUMERIC NOT NULL,
  cost_estimate_usd NUMERIC,
  latency_ms INTEGER,
  success BOOLEAN DEFAULT true,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_voice_usage_preschool_date ON public.voice_usage_logs(preschool_id, created_at);
CREATE INDEX idx_voice_usage_lang ON public.voice_usage_logs(language_code);
CREATE INDEX idx_voice_usage_provider ON public.voice_usage_logs(provider);

-- Add language_code to voice_notes if table exists and column missing
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'voice_notes'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'voice_notes' 
      AND column_name = 'language_code'
  ) THEN
    ALTER TABLE public.voice_notes ADD COLUMN language_code TEXT DEFAULT 'en';
    
    -- Only create index if preschool_id column exists
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'voice_notes' 
        AND column_name = 'preschool_id'
    ) THEN
      CREATE INDEX idx_voice_notes_lang ON public.voice_notes(preschool_id, language_code);
    END IF;
  END IF;
END $$;

-- Enable RLS
ALTER TABLE public.voice_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tts_audio_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_usage_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for voice_preferences
CREATE POLICY "Users can view their own voice preferences"
  ON public.voice_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own voice preferences"
  ON public.voice_preferences FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own voice preferences"
  ON public.voice_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for tts_audio_cache (tenant-scoped)
CREATE POLICY "Preschool can view their TTS cache"
  ON public.tts_audio_cache FOR SELECT
  USING (preschool_id = (auth.jwt()->>'preschool_id')::uuid);

CREATE POLICY "Preschool can insert TTS cache"
  ON public.tts_audio_cache FOR INSERT
  WITH CHECK (preschool_id = (auth.jwt()->>'preschool_id')::uuid);

-- RLS Policies for voice_usage_logs (write-only for clients)
CREATE POLICY "Users can insert their own usage logs"
  ON public.voice_usage_logs FOR INSERT
  WITH CHECK (true);

-- Create storage bucket for TTS cache
INSERT INTO storage.buckets (id, name, public)
VALUES ('tts-cache', 'tts-cache', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
DO $$ 
BEGIN
  -- Check if policy exists before creating
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
      AND tablename = 'objects' 
      AND policyname = 'Authenticated users can upload TTS cache'
  ) THEN
    CREATE POLICY "Authenticated users can upload TTS cache"
      ON storage.objects FOR INSERT
      WITH CHECK (bucket_id = 'tts-cache' AND auth.role() = 'authenticated');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
      AND tablename = 'objects' 
      AND policyname = 'Users can read TTS cache'
  ) THEN
    CREATE POLICY "Users can read TTS cache"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'tts-cache' AND auth.role() = 'authenticated');
  END IF;
END $$;

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = now();
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_voice_preferences_updated_at
  BEFORE UPDATE ON public.voice_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();