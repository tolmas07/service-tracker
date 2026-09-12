import pg from 'pg';
const { Client } = pg;

async function run() {
  const url = `postgresql://postgres.cdjnuvdxcmyyatocrkzq:Tolmas2003!!@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres`;
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
