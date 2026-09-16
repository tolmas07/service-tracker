import pg from 'pg';
const { Client } = pg;

async function run() {
  const url = `postgresql://postgres.cdjnuvdxcmyyatocrkzq:Tolmas2003%21%21@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres`;
  const client = new Client({ connectionString: url });
  await client.connect();
  
  try {
    console.log("Fixing DELETE policies...");
    await client.query(`
      DROP POLICY IF EXISTS "Visits: workers delete own" ON visits;
      DROP POLICY IF EXISTS "Photos: delete own" ON photos;
      
      CREATE POLICY "Visits: workers delete own" ON visits FOR DELETE
      USING (worker_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager'));
      
      CREATE POLICY "Photos: delete own" ON photos FOR DELETE
      USING (EXISTS (
        SELECT 1 FROM visits WHERE visits.id = photos.visit_id
        AND (visits.worker_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager'))
      ));
    `);
    console.log("Done");
  } catch(e) {
    console.error(e);
  }

  await client.end();
}
run();
