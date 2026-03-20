const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pzhmnsgfhvhcwdrmiyju.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6aG1uc2dmaHZoY3dkcm1peWp1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzUzNDI0OSwiZXhwIjoyMDg5MTEwMjQ5fQ.2obeByr_MIAnnuM-83xGAaCtsy4vCk49n_h4aVFG2vo';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkUserBusiness() {
  console.log('Checking user and business data...\n');

  // List all users
  const { data: users, error: usersError } = await supabase.auth.admin.listUsers();

  if (usersError) {
    console.error('Error listing users:', usersError);
    return;
  }

  console.log(`Found ${users.users.length} users:\n`);

  for (const user of users.users) {
    console.log(`✅ User: ${user.email}`);
    console.log(`   ID: ${user.id}`);
    console.log(`   User metadata:`, JSON.stringify(user.user_metadata, null, 2));
    console.log(`   App metadata:`, JSON.stringify(user.app_metadata, null, 2));
    console.log('');
  }

  // Check businesses table
  console.log('\n📊 Checking businesses table...\n');
  const { data: businesses, error: bizError } = await supabase
    .from('businesses')
    .select('*');

  if (bizError) {
    console.error('Error fetching businesses:', bizError);
  } else {
    console.log(`Found ${businesses?.length || 0} businesses:`);
    businesses?.forEach(biz => {
      console.log(`   - ${biz.name} (ID: ${biz.id})`);
    });
  }

  // Check user_businesses junction table
  console.log('\n🔗 Checking user_businesses junction table...\n');
  const { data: junctions, error: junctionError } = await supabase
    .from('user_businesses')
    .select('*');

  if (junctionError) {
    console.error('Error fetching user_businesses:', junctionError);
  } else {
    console.log(`Found ${junctions?.length || 0} user-business links:`);
    junctions?.forEach(j => {
      console.log(`   - User ${j.user_id} → Business ${j.business_id}`);
    });
  }
}

checkUserBusiness().catch(console.error);
