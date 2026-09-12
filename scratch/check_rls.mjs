import pg from 'pg';
const { Client } = pg;

async function run() {
  const url = `postgresql://postgres.cdjnuvdxcmyyatocrkzq:Tolmas2003!!@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres`;
  const client = new Client({ connectionString: url });
  await client.connect();
  
  // Check RLS policies on profiles, trips, visits
  const res = await client.query(`
    SELECT tablename, policyname, permissive, roles, cmd, qual
    FROM pg_policies
    WHERE tablename IN ('profiles', 'trips', 'visits')
  `);
  console.log(res.rows);

  await client.end();
}
run();
