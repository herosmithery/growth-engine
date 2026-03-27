'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createBrowserClient } from '@supabase/ssr';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertCircle, Sparkles } from 'lucide-react';
import { hexToHsl, lightenHsl, darkenHsl } from '@/lib/color-utils';

interface Branding {
  name: string;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  slug: string;
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const slugParam = searchParams.get('b');
  const redirect = searchParams.get('redirect') || '/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [branding, setBranding] = useState<Branding | null>(null);
  const [brandingLoading, setBrandingLoading] = useState(!!slugParam);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Load client branding if slug provided
  useEffect(() => {
    if (!slugParam) return;
    setBrandingLoading(true);
    fetch(`/api/branding?b=${slugParam}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) setBranding(data);
      })
      .finally(() => setBrandingLoading(false));
  }, [slugParam]);

  // Inject brand colors as CSS variables on the page
  useEffect(() => {
    if (!branding) return;
    const primaryHsl = hexToHsl(branding.primaryColor);
    const primaryLight = lightenHsl(primaryHsl, 50);
    const primaryDark = darkenHsl(primaryHsl, 10);

    const style = document.getElementById('login-branding') || document.createElement('style');
    style.id = 'login-branding';
    style.textContent = `
      :root {
        --primary: ${primaryHsl};
        --primary-dark: ${primaryDark};
        --primary-light: ${primaryLight};
        --ring: ${primaryHsl};
      }
    `;
    if (!document.getElementById('login-branding')) document.head.appendChild(style);
    return () => document.getElementById('login-branding')?.remove();
  }, [branding]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        setError(error.message);
        return;
      }

      if (data.user) {
        const role = data.user.app_metadata?.role || data.user.user_metadata?.role;
        if (role === 'admin' || role === 'super_admin') {
          router.push('/admin');
        } else {
          router.push(redirect);
        }
        router.refresh();
      }
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (brandingLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const displayName = branding?.name || 'Growth Engine';
  const primaryColor = branding?.primaryColor || '#7c3aed';

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-gradient-to-br from-background to-muted/30">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center pb-4">
          {/* Logo / Avatar */}
          <div className="mx-auto mb-4 flex items-center justify-center">
            {branding?.logoUrl ? (
              <img
                src={branding.logoUrl}
                alt={displayName}
                className="h-14 w-auto max-w-[160px] object-contain"
              />
            ) : (
              <div
                className="w-14 h-14 rounded-xl flex items-center justify-center shadow-md"
                style={{ backgroundColor: primaryColor }}
              >
                {branding ? (
                  <span className="text-white font-bold text-xl">
                    {displayName.slice(0, 2).toUpperCase()}
                  </span>
                ) : (
                  <Sparkles className="w-7 h-7 text-white" />
                )}
              </div>
            )}
          </div>

          <CardTitle className="text-2xl font-bold">Welcome back</CardTitle>
          <CardDescription>
            Sign in to your {displayName} dashboard
          </CardDescription>

          {/* Powered-by badge — subtle, white-label friendly */}
          {branding && (
            <p className="text-xs text-muted-foreground/50 mt-1">
              Powered by Scale with Jak
            </p>
          )}
        </CardHeader>

        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={loading}
              style={branding ? { backgroundColor: primaryColor, borderColor: primaryColor } : undefined}
            >
              {loading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Signing in...</>
              ) : (
                'Sign in'
              )}
            </Button>

            {process.env.NEXT_PUBLIC_DEMO_MODE === 'true' && (
              <div className="pt-4 border-t mt-4">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => { setEmail('demo@growthengine.com'); setPassword('Client123!'); }}
                >
                  Log in as Demo User
                </Button>
              </div>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
