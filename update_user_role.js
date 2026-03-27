const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pzhmnsgfhvhcwdrmiyju.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6aG1uc2dmaHZoY3dkcm1peWp1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MjMwNTQ1NSwiZXhwIjoyMDU3ODgxNDU1fQ.YlrBNwA3ii7EjJvH6rs3tJM9y4JY7cXy8h5cYEHT2t4';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function updateUserRole() {
  console.log('Fetching all users...');

  // List all users
  const { data: users, error: listError } = await supabase.auth.admin.listUsers();

  if (listError) {
    console.error('Error listing users:', listError);
    return;
  }

  console.log(`Found ${users.users.length} users:`);
  users.users.forEach(user => {
    console.log(`- ${user.email} (ID: ${user.id})`);
  });

  // Find jak@scalewithjak.com
  const jakUser = users.users.find(u => u.email === 'jak@scalewithjak.com');

  if (!jakUser) {
    console.log('\n❌ User jak@scalewithjak.com not found. Please create the account first via signup.');
    return;
  }

  console.log(`\n✅ Found jak@scalewithjak.com (ID: ${jakUser.id})`);
  console.log('Updating user role to super_admin...');

  // Update user metadata to add super_admin role
  const { data: updatedUser, error: updateError } = await supabase.auth.admin.updateUserById(
    jakUser.id,
    {
      user_metadata: {
        ...jakUser.user_metadata,
        role: 'super_admin',
        name: 'JAK',
        business_name: 'Scale With JAK Agency'
      },
      app_metadata: {
        ...jakUser.app_metadata,
        role: 'super_admin'
      }
    }
  );

  if (updateError) {
    console.error('❌ Error updating user:', updateError);
    return;
  }

  console.log('✅ Successfully updated user role to super_admin!');
  console.log('\nUser details:');
  console.log(JSON.stringify(updatedUser.user, null, 2));
}

updateUserRole();
