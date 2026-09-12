import pg from 'pg';
const { Client } = pg;

async function run() {
  const url = `postgresql://postgres.cdjnuvdxcmyyatocrkzq:Tolmas2003!!@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres`;
  const client = new Client({ connectionString: url });
  await client.connect();
  
  const res = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'trips'");
  console.log('Columns in trips:', res.rows.map(r => r.column_name));

  await client.end();
}
run();
