import pg from 'pg';
const { Client } = pg;

async function run() {
  const url = `postgresql://postgres.cdjnuvdxcmyyatocrkzq:Tolmas2003!!@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres`;
  const client = new Client({ connectionString: url });
  await client.connect();
  
  const res = await client.query("SELECT id, name, worker_id FROM points");
  console.log('Points sample:', res.rows.slice(0, 10));
  
  const resWorkers = await client.query("SELECT id, full_name FROM profiles WHERE role='worker'");
  console.log('Workers:', resWorkers.rows);

  await client.end();
}
run();
