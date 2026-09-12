import pg from 'pg';
const { Client } = pg;
async function run() {
  const url = 'postgresql://postgres.cdjnuvdxcmyyatocrkzq:Tolmas2003!!@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres';
  const client = new Client({ connectionString: url });
  await client.connect();
  const res = await client.query("SELECT name FROM points WHERE worker_id = '2037a0a6-c1c7-436a-8892-83165fa3215c' AND (name ILIKE '%Бухар%' OR name ILIKE '%Навои%')");
  console.log('Tolmasbek has Bukhara/Navoi points:', res.rows);
  await client.end();
}
run();
