const { createClient } = require('@supabase/supabase-js');

// Production Supabase credentials
const supabaseUrl = 'https://pzhmnsgfhvhcwdrmiyju.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6aG1uc2dmaHZoY3dkcm1peWp1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MjMwNTQ1NSwiZXhwIjoyMDU3ODgxNDU1fQ.FvQcOJuaL2mqLMYm75kSXW1rIZx_buwIxdSDOPUEtjY';

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createAccounts() {
  console.log('🚀 Creating production accounts in Supabase...\n');

  // 1. Create Super Admin Account
  console.log('Creating Super Admin: jak@scalewithjak.com');
  const { data: admin, error: adminError } = await supabase.auth.admin.createUser({
    email: 'jak@scalewithjak.com',
    password: 'Admin123!',
    email_confirm: true,
    user_metadata: {
      role: 'super_admin',
      name: 'JAK',
      business_name: 'Scale With JAK Agency'
    },
    app_metadata: {
      role: 'super_admin'
    }
  });

  if (adminError) {
    console.error('❌ Admin Error:', adminError.message);
  } else {
    console.log('✅ Admin created:', admin.user.email);
  }

  // 2. Create Demo Client Account
  console.log('\nCreating Demo Client: demo@glowmedspa.com');
  const { data: client, error: clientError } = await supabase.auth.admin.createUser({
    email: 'demo@glowmedspa.com',
    password: 'Client123!',
    email_confirm: true,
    user_metadata: {
      role: 'client',
      name: 'Glow MedSpa',
      business_name: 'Glow MedSpa'
    },
    app_metadata: {
      role: 'client'
    }
  });

  if (clientError) {
    console.error('❌ Client Error:', clientError.message);
  } else {
    console.log('✅ Client created:', client.user.email);
  }

  console.log('\n✅ Done! Accounts created in production Supabase.');
  console.log('\n📋 Login Credentials:');
  console.log('Admin: jak@scalewithjak.com / Admin123!');
  console.log('Client: demo@glowmedspa.com / Client123!');
}

createAccounts();
