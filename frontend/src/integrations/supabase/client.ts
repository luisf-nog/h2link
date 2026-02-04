import { createClient } from '@supabase/supabase-js';

// Supabase configuration with fallbacks
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://dalarhopratsgzmmzhxx.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRhbGFyaG9wcmF0c2d6bW16aHh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwODM5NDksImV4cCI6MjA4NDY1OTk0OX0.CIV7u2pMSudse-Zpfqf8OHLkm_exZn0EaYXVEFwoXTQ";

// Validate configuration
if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  console.error('Supabase configuration is missing. Please check your environment variables.');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
