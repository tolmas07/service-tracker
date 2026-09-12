import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://cdjnuvdxcmyyatocrkzq.supabase.co';
const supabaseKey = 'sb_publishable_aQlWtQ2x5DMJ75ZBNOJiCA_zrWG4Tz1';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.from('trips').select('*, worker:profiles(full_name)').order('started_at', { ascending: false }).limit(10);
  if (error) console.error('Error fetching trips:', error);
  else console.log('Trips fetched:', data?.length);

  const { data: workers, error: error2 } = await supabase.from('profiles').select('*').eq('role', 'worker').order('full_name');
  if (error2) console.error('Error fetching workers:', error2);
  else console.log('Workers fetched:', workers?.length);
}
run();
