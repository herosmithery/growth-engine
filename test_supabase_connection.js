const { createClient } = require('@supabase/supabase-js');

// Test connection with ANON key (what the login page uses)
const supabaseUrl = 'https://pzhmnsgfhvhcwdrmiyju.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6aG1uc2dmaHZoY3dkcm1peWp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDIzMDU0NTUsImV4cCI6MjA1Nzg4MTQ1NX0.rEWYZ0iiONqyCkMAHHWv-DZOQxD8pZPXONuQc_k3pMU';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testConnection() {
  console.log('Testing Supabase connection with ANON key...\n');

  // Try to sign in with the credentials
  console.log('Attempting to sign in with jak@scalewithjak.com...');
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'jak@scalewithjak.com',
    password: 'Admin123!'
  });

  if (error) {
    console.log('❌ Login failed:', error.message);
    console.log('Error details:', error);
  } else {
    console.log('✅ Login successful!');
    console.log('User ID:', data.user.id);
    console.log('User email:', data.user.email);
    console.log('User metadata:', data.user.user_metadata);
    console.log('App metadata:', data.user.app_metadata);
  }

  // Try to sign up a new test account
  console.log('\n\nAttempting to create a new test account...');
  const { data: signupData, error: signupError } = await supabase.auth.signUp({
    email: 'test-' + Date.now() + '@test.com',
    password: 'Test123!',
    options: {
      data: {
        business_name: 'Test Business',
        role: 'owner'
      }
    }
  });

  if (signupError) {
    console.log('❌ Signup failed:', signupError.message);
    console.log('Error details:', signupError);
  } else {
    console.log('✅ Signup successful! API keys are working correctly.');
    console.log('New user ID:', signupData.user?.id);
    console.log('Email confirmation required:', !signupData.session);
  }
}

testConnection().catch(console.error);
