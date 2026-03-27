const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pzhmnsgfhvhcwdrmiyju.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6aG1uc2dmaHZoY3dkcm1peWp1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzUzNDI0OSwiZXhwIjoyMDg5MTEwMjQ5fQ.2obeByr_MIAnnuM-83xGAaCtsy4vCk49n_h4aVFG2vo';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createUserBusiness() {
  console.log('Setting up business for jak@scalewithjak.com...\n');

  // Get the user
  const { data: users } = await supabase.auth.admin.listUsers();
  const user = users.users.find(u => u.email === 'jak@scalewithjak.com');

  if (!user) {
    console.error('❌ User not found');
    return;
  }

  console.log(`✅ Found user: ${user.email} (${user.id})\n`);

  // Create business
  console.log('Creating business...');
  const { data: business, error: bizError } = await supabase
    .from('businesses')
    .insert({
      name: 'Scale With JAK Agency',
      niche_type: 'general',
      crm_type: 'custom',
      owner_id: user.id
    })
    .select()
    .single();

  if (bizError) {
    console.error('❌ Error creating business:', bizError);
    return;
  }

  console.log(`✅ Business created: ${business.name} (${business.id})\n`);

  // Update user metadata with business_id
  console.log('Updating user metadata...');
  const { error: updateError } = await supabase.auth.admin.updateUserById(
    user.id,
    {
      user_metadata: {
        business_id: business.id,
        business_name: business.name,
        niche_type: 'general',
        role: 'super_admin'
      },
      app_metadata: {
        role: 'super_admin'
      }
    }
  );

  if (updateError) {
    console.error('❌ Error updating user:', updateError);
    return;
  }

  console.log('✅ User metadata updated!\n');
  console.log('🎉 Setup complete! Refresh your dashboard to see all pages.\n');
  console.log('Business Details:');
  console.log(`   Name: ${business.name}`);
  console.log(`   ID: ${business.id}`);
  console.log(`   Owner: ${user.email}`);
}

createUserBusiness().catch(console.error);
