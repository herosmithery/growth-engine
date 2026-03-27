'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { createBrowserClient } from '@supabase/ssr';
import { AlertCircle, CreditCard, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * SubscriptionGate — wraps any page/section that requires an active subscription.
 * If the subscription is past_due or cancelled, renders a paywall overlay instead.
 * Admins bypass the gate entirely.
 */
export function SubscriptionGate({ children }: { children: React.ReactNode }) {
  const { businessId, isAdmin, loading: authLoading } = useAuth();
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (isAdmin || !businessId) { setLoading(false); return; }

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    (async () => {
      try {
        const { data } = await supabase
          .from('businesses')
          .select('subscription_status')
          .eq('id', businessId)
          .single();
        setStatus((data as any)?.subscription_status ?? 'active');
      } catch {
        // default to active on error so we don't lock users out
      } finally {
        setLoading(false);
      }
    })();
  }, [businessId, isAdmin, authLoading]);

  if (authLoading || loading) return <>{children}</>;

  // Admins always pass through
  if (isAdmin) return <>{children}</>;

  // Active / trial subscriptions pass through
  if (!status || status === 'active' || status === 'trial') return <>{children}</>;

  // Lapsed — show paywall
  const isPastDue = status === 'past_due';

  const openPortal = async () => {
    if (!businessId) return;
    setPortalLoading(true);
    try {
      const res = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } finally {
      setPortalLoading(false);
    }
  };

  return (
    <div className="relative min-h-[60vh]">
      {/* Blurred background content */}
      <div className="pointer-events-none select-none blur-sm opacity-30" aria-hidden>
        {children}
      </div>

      {/* Paywall overlay */}
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border max-w-md w-full p-8 text-center space-y-4">
          <div className="mx-auto w-14 h-14 rounded-full bg-red-100 flex items-center justify-center">
            <AlertCircle className="w-7 h-7 text-red-600" />
          </div>

          <div>
            <h2 className="text-xl font-bold">
              {isPastDue ? 'Payment Past Due' : 'Subscription Cancelled'}
            </h2>
            <p className="text-muted-foreground text-sm mt-2">
              {isPastDue
                ? 'Your last payment failed. Update your billing info to restore access to your dashboard.'
                : 'Your subscription has ended. Reactivate to continue using the Growth Engine.'}
            </p>
          </div>

          <Button
            onClick={openPortal}
            disabled={portalLoading}
            className="w-full gap-2"
          >
            {portalLoading
              ? <><Loader2 className="h-4 w-4 animate-spin" />Loading...</>
              : <><CreditCard className="h-4 w-4" />{isPastDue ? 'Update Payment Method' : 'Reactivate Subscription'}</>
            }
          </Button>

          <p className="text-xs text-muted-foreground">
            Questions? Email <a href="mailto:support@scalewithjak.com" className="underline">support@scalewithjak.com</a>
          </p>
        </div>
      </div>
    </div>
  );
}
