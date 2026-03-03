const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://tsvuzkdrtquzuseaezjk.supabase.co',
  'sb_secret_YF6q558n3XJpGpkk3Gkl-w_hsupc-d8',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

async function createAccounts() {
  console.log('Creating admin and client accounts...\n');

  // 1. Create Admin Account (you)
  console.log('1. Creating admin account...');
  const { data: adminAuth, error: adminAuthError } = await supabase.auth.admin.createUser({
    email: 'jak@scalewithjak.com',
    password: 'Admin123!',
    email_confirm: true,
    user_metadata: {
      role: 'super_admin',
      full_name: 'Jak (Admin)'
    },
    app_metadata: {
      role: 'super_admin'
    }
  });

  if (adminAuthError) {
    if (adminAuthError.message.includes('already been registered')) {
      console.log('   Admin account already exists');
      // Update existing user to have admin role
      const { data: users } = await supabase.auth.admin.listUsers();
      const adminUser = users?.users?.find(u => u.email === 'jak@scalewithjak.com');
      if (adminUser) {
        await supabase.auth.admin.updateUserById(adminUser.id, {
          app_metadata: { role: 'super_admin' },
          user_metadata: { role: 'super_admin', full_name: 'Jak (Admin)' }
        });
        console.log('   ✓ Updated admin role');
      }
    } else {
      console.log('   Error:', adminAuthError.message);
    }
  } else {
    console.log('   ✓ Admin account created');
    console.log(`   Email: jak@scalewithjak.com`);
    console.log(`   Password: Admin123!`);
  }

  // 2. Create Demo Client Account
  console.log('\n2. Creating demo client account...');
  const { data: clientAuth, error: clientAuthError } = await supabase.auth.admin.createUser({
    email: 'demo@glowmedspa.com',
    password: 'Client123!',
    email_confirm: true,
    user_metadata: {
      role: 'owner',
      full_name: 'Demo Owner',
      business_name: 'Glow Med Spa',
      business_id: 'ab445992-80fd-46d0-bec0-138a86e1d607'
    }
  });

  if (clientAuthError) {
    if (clientAuthError.message.includes('already been registered')) {
      console.log('   Demo client account already exists');
      // Update existing user
      const { data: users } = await supabase.auth.admin.listUsers();
      const clientUser = users?.users?.find(u => u.email === 'demo@glowmedspa.com');
      if (clientUser) {
        await supabase.auth.admin.updateUserById(clientUser.id, {
          user_metadata: {
            role: 'owner',
            full_name: 'Demo Owner',
            business_name: 'Glow Med Spa',
            business_id: 'ab445992-80fd-46d0-bec0-138a86e1d607'
          }
        });
        console.log('   ✓ Updated client metadata');
      }
    } else {
      console.log('   Error:', clientAuthError.message);
    }
  } else {
    console.log('   ✓ Client account created');
    console.log(`   Email: demo@glowmedspa.com`);
    console.log(`   Password: Client123!`);
  }

  // 3. List all users to verify
  console.log('\n3. Verifying accounts...');
  const { data: allUsers, error: listError } = await supabase.auth.admin.listUsers();

  if (listError) {
    console.log('   Error listing users:', listError.message);
  } else {
    console.log(`   Total users: ${allUsers.users.length}`);
    allUsers.users.forEach(u => {
      const role = u.app_metadata?.role || u.user_metadata?.role || 'user';
      console.log(`   - ${u.email} (${role})`);
    });
  }

  console.log('\n✅ Account setup complete!');
  console.log('\n📋 Login Credentials:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('ADMIN (You):');
  console.log('  Email: jak@scalewithjak.com');
  console.log('  Password: Admin123!');
  console.log('  → Redirects to /admin');
  console.log('');
  console.log('DEMO CLIENT:');
  console.log('  Email: demo@glowmedspa.com');
  console.log('  Password: Client123!');
  console.log('  → Redirects to / (client dashboard)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

createAccounts().catch(console.error);
