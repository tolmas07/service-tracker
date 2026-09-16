import pg from 'pg';
const { Client } = pg;

async function run() {
  // Use encoded password
  const url = `postgresql://postgres.cdjnuvdxcmyyatocrkzq:Tolmas2003%21%21@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres`;
  const client = new Client({ connectionString: url });
  await client.connect();
  
  try {
    console.log("Adding DELETE policies...");
    await client.query(`
      CREATE POLICY "Visits: workers delete own" ON visits FOR DELETE
      USING (worker_id = auth.uid());
      
      CREATE POLICY "Photos: delete own" ON photos FOR DELETE
      USING (EXISTS (
        SELECT 1 FROM visits WHERE visits.id = photos.visit_id
        AND visits.worker_id = auth.uid()
      ));
    `);
    console.log("Done");
  } catch(e) {
    console.error(e);
  }

  await client.end();
}
run();
