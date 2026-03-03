'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Check, Zap, Star, Crown, ArrowLeft, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

const plans = [
  {
    id: 'starter',
    name: 'Starter',
    price: 997,
    description: 'Perfect for small med spas getting started with AI',
    icon: Zap,
    features: [
      '50 AI phone calls/month',
      '200 SMS messages/month',
      '2 active campaigns',
      '200 client records',
      '2 team members',
      'Email support',
      'Basic analytics',
    ],
    highlight: false,
  },
  {
    id: 'growth',
    name: 'Growth',
    price: 1497,
    description: 'For growing practices ready to scale',
    icon: Star,
    features: [
      '150 AI phone calls/month',
      '500 SMS messages/month',
      '5 active campaigns',
      '500 client records',
      '5 team members',
      'Priority support',
      'Advanced analytics',
      'Google Calendar sync',
      'Custom integrations',
    ],
    highlight: true,
    popular: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 2497,
    description: 'For established practices with high volume',
    icon: Crown,
    features: [
      'Unlimited AI phone calls',
      'Unlimited SMS messages',
      'Unlimited campaigns',
      'Unlimited clients',
      'Unlimited team members',
      'Dedicated account manager',
      'Custom development',
      'White-label options',
      'SLA guarantee',
      'API access',
    ],
    highlight: false,
  },
];

export default function PricingPage() {
  const router = useRouter();
  const { businessId } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubscribe = async (planId: string) => {
    if (!businessId) {
      router.push('/login?redirect=/pricing');
      return;
    }

    setLoading(planId);
    setError(null);

    try {
      const response = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: planId,
          businessId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create checkout session');
      }

      // Redirect to Stripe Checkout
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setLoading(null);
    }
  };

  const handleManageBilling = async () => {
    if (!businessId) return;

    setLoading('manage');
    try {
      const response = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to open billing portal');
      }

      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFBF9] dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Simple, Transparent Pricing
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Choose the plan that fits your practice. All plans include our AI-powered
            booking agent, reactivation campaigns, and review management.
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-8 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-center">
            <p className="text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-8 mb-12">
          {plans.map((plan) => {
            const Icon = plan.icon;

            return (
              <div
                key={plan.id}
                className={`relative rounded-2xl p-8 ${
                  plan.highlight
                    ? 'bg-[#9B7E6B] text-white ring-4 ring-[#9B7E6B]/30'
                    : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="px-4 py-1 bg-[#C9A962] text-white text-sm font-semibold rounded-full">
                      Most Popular
                    </span>
                  </div>
                )}

                <div className="mb-6">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${
                    plan.highlight ? 'bg-white/20' : 'bg-[#9B7E6B]/10'
                  }`}>
                    <Icon className={`w-6 h-6 ${plan.highlight ? 'text-white' : 'text-[#9B7E6B]'}`} />
                  </div>
                  <h2 className={`text-2xl font-bold mb-2 ${
                    plan.highlight ? 'text-white' : 'text-gray-900 dark:text-white'
                  }`}>
                    {plan.name}
                  </h2>
                  <p className={`text-sm ${
                    plan.highlight ? 'text-white/80' : 'text-gray-600 dark:text-gray-400'
                  }`}>
                    {plan.description}
                  </p>
                </div>

                <div className="mb-6">
                  <span className={`text-4xl font-bold ${
                    plan.highlight ? 'text-white' : 'text-gray-900 dark:text-white'
                  }`}>
                    ${plan.price}
                  </span>
                  <span className={`text-sm ${
                    plan.highlight ? 'text-white/80' : 'text-gray-600 dark:text-gray-400'
                  }`}>
                    /month
                  </span>
                </div>

                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <Check className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                        plan.highlight ? 'text-white' : 'text-[#9B7E6B]'
                      }`} />
                      <span className={`text-sm ${
                        plan.highlight ? 'text-white/90' : 'text-gray-700 dark:text-gray-300'
                      }`}>
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleSubscribe(plan.id)}
                  disabled={loading !== null}
                  className={`w-full py-3 px-4 rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                    plan.highlight
                      ? 'bg-white text-[#9B7E6B] hover:bg-gray-100'
                      : 'bg-[#9B7E6B] text-white hover:bg-[#8A6E5B]'
                  }`}
                >
                  {loading === plan.id ? (
                    <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                  ) : (
                    'Get Started'
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {/* FAQ or Additional Info */}
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-400">
            Questions? Contact us at{' '}
            <a href="mailto:support@example.com" className="text-[#9B7E6B] hover:underline">
              support@example.com
            </a>
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
            All plans include a 30-day money-back guarantee
          </p>
        </div>
      </div>
    </div>
  );
}
