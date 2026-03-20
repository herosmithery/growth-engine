const { createClient } = require('@supabase/supabase-js');

// Test connection with NEW ANON key
const supabaseUrl = 'https://pzhmnsgfhvhcwdrmiyju.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6aG1uc2dmaHZoY3dkcm1peWp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1MzQyNDksImV4cCI6MjA4OTExMDI0OX0.awPbAUyKn68q4phYpGIX5vJx7HUMg6UXJwEsRk0GNCo';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testConnection() {
  console.log('✅ Testing NEW Supabase API keys...\n');

  // Try to sign up a test account to verify the keys work
  console.log('Attempting to create a test account to verify API keys...');
  const testEmail = 'test-' + Date.now() + '@test.com';
  const { data: signupData, error: signupError } = await supabase.auth.signUp({
    email: testEmail,
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
    console.log('✅ API keys are working! Signup successful!');
    console.log('Test user created:', testEmail);
    console.log('Now you can create your real admin account via the signup page.\n');
  }
}

testConnection().catch(console.error);
