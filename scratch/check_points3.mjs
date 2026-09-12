import pg from 'pg';
const { Client } = pg;

async function run() {
  const url = `postgresql://postgres.cdjnuvdxcmyyatocrkzq:Tolmas2003!!@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres`;
  const client = new Client({ connectionString: url });
  await client.connect();
  
  const res = await client.query("SELECT id, name, worker_id FROM points WHERE name ILIKE '%Самарканд%' AND worker_id = '3ac23bfe-f210-46c8-82dc-0c0ffca679f9'");
  console.log('Samarkand points for Navoi worker:', res.rows);
  
  const res2 = await client.query("SELECT id, name, worker_id FROM points WHERE worker_id = '3ac23bfe-f210-46c8-82dc-0c0ffca679f9'");
  console.log('ALL points for Navoi worker:', res2.rows);

  await client.end();
}
run();
