import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: 'c:\\Users\\Tolmas\\service-tracker\\.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  // Login as manager to test what they see!
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'testmanager@example.com', // wait I don't know the email. I'll just use their token if possible?
  });
}
run();
