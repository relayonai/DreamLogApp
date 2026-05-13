export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          created_at: string;
          preferences: {
            wake_window_start: string | null;
            wake_window_end: string | null;
            wake_word_enabled: boolean;
            watch_paired: boolean;
            default_comic_style: string;
          } | null;
        };
        Insert: {
          id: string;
          email: string;
          created_at?: string;
          preferences?: Json | null;
        };
        Update: {
          id?: string;
          email?: string;
          created_at?: string;
          preferences?: Json | null;
        };
      };
      dreams: {
        Row: {
          id: string;
          user_id: string;
          recorded_at: string;
          audio_url: string | null;
          transcription_raw: string | null;
          transcription_enhanced: string | null;
          comic_style: 'classic' | 'graphic_novel' | 'manga' | 'surreal' | null;
          mood_genre: string | null;
          status: 'processing' | 'ready' | 'failed' | 'pending_sync';
          low_confidence: boolean | null;
          export_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          recorded_at: string;
          audio_url?: string | null;
          transcription_raw?: string | null;
          transcription_enhanced?: string | null;
          comic_style?: 'classic' | 'graphic_novel' | 'manga' | 'surreal' | null;
          mood_genre?: string | null;
          status?: 'processing' | 'ready' | 'failed' | 'pending_sync';
          low_confidence?: boolean | null;
          export_url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          recorded_at?: string;
          audio_url?: string | null;
          transcription_raw?: string | null;
          transcription_enhanced?: string | null;
          comic_style?: 'classic' | 'graphic_novel' | 'manga' | 'surreal' | null;
          mood_genre?: string | null;
          status?: 'processing' | 'ready' | 'failed' | 'pending_sync';
          low_confidence?: boolean | null;
          export_url?: string | null;
          created_at?: string;
        };
      };
      scenes: {
        Row: {
          id: string;
          dream_id: string;
          order_index: number;
          text_content: string;
          image_url: string | null;
          gap_filled: boolean | null;
          tone_applied: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          dream_id: string;
          order_index: number;
          text_content: string;
          image_url?: string | null;
          gap_filled?: boolean | null;
          tone_applied?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          dream_id?: string;
          order_index?: number;
          text_content?: string;
          image_url?: string | null;
          gap_filled?: boolean | null;
          tone_applied?: string | null;
          created_at?: string;
        };
      };
      gap_suggestions: {
        Row: {
          id: string;
          scene_id: string;
          original_text: string;
          suggested_text: string;
          tone: string;
          accepted: boolean | null;
        };
        Insert: {
          id?: string;
          scene_id: string;
          original_text: string;
          suggested_text: string;
          tone: string;
          accepted?: boolean | null;
        };
        Update: {
          id?: string;
          scene_id?: string;
          original_text?: string;
          suggested_text?: string;
          tone?: string;
          accepted?: boolean | null;
        };
      };
    };
  };
}
