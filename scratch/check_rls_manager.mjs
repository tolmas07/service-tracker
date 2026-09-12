import pg from 'pg';
const { Client } = pg;

async function run() {
  const url = `postgresql://postgres.cdjnuvdxcmyyatocrkzq:Tolmas2003!!@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres`;
  const client = new Client({ connectionString: url });
  await client.connect();
  
  // Set role to authenticated and simulate manager
  await client.query("SET role authenticated;");
  await client.query(`SET request.jwt.claims = '{"sub": "4fa3b88c-23bb-45ca-b860-11e9001e50e8", "role": "authenticated"}';`);
  
  const res = await client.query("SELECT * FROM profiles WHERE role = 'worker'");
  console.log('Workers as manager:', res.rows.length);

  const res2 = await client.query("SELECT * FROM trips");
  console.log('Trips as manager:', res2.rows.length);

  await client.end();
}
run();
