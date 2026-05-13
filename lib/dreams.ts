import { supabase } from './supabase';
import type { Database } from '../types/database';

type Dream = Database['public']['Tables']['dreams']['Row'];
type DreamInsert = Database['public']['Tables']['dreams']['Insert'];

export async function createDream(data: Omit<DreamInsert, 'user_id'>): Promise<Dream> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const { data: dream, error } = await supabase
    .from('dreams').insert({ ...data, user_id: user.id }).select().single();
  if (error) throw error;
  return dream;
}

export async function listDreams(): Promise<Dream[]> {
  const { data, error } = await supabase
    .from('dreams')
    .select('*, scenes(image_url)')
    .order('recorded_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}
