import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: 'c:\\Users\\Tolmas\\service-tracker\\.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const url = `postgresql://postgres.cdjnuvdxcmyyatocrkzq:Tolmas2003!!@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres`;
  const { Client } = require('pg');
  const client = new Client({ connectionString: url });
  await client.connect();
  
  const res = await client.query("SELECT * FROM profiles WHERE role = 'manager'");
  console.log('Managers:', res.rows);
  
  const res2 = await client.query("SELECT count(*) FROM trips");
  console.log('Total trips:', res2.rows[0]);
  
  const res3 = await client.query("SELECT count(*) FROM points");
  console.log('Total points:', res3.rows[0]);

  await client.end();
}
run();
