import pg from 'pg';
const { Client } = pg;
async function run() {
  const url = 'postgresql://postgres.cdjnuvdxcmyyatocrkzq:Tolmas2003!!@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres';
  const client = new Client({ connectionString: url });
  await client.connect();
  const res = await client.query("SELECT id, full_name, role FROM profiles");
  console.log('ALL PROFILES:', res.rows);
  await client.end();
}
run();
