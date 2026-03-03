'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createBrowserClient } from '@supabase/ssr';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import type { NicheType } from '@/types';

export default function SignupPage() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [businessName, setBusinessName] = useState('');
    const [nicheType, setNicheType] = useState<NicheType>('general');
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [loading, setLoading] = useState(false);

    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    async function handleSignup(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        setLoading(true);

        // Validate passwords match
        if (password !== confirmPassword) {
            setError('Passwords do not match');
            setLoading(false);
            return;
        }

        // Validate password strength
        if (password.length < 8) {
            setError('Password must be at least 8 characters long');
            setLoading(false);
            return;
        }

        try {
            // Step 1: Create the user account
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        business_name: businessName,
                        niche_type: nicheType,
                        role: 'owner',
                    },
                },
            });

            if (authError) {
                setError(authError.message);
                setLoading(false);
                return;
            }

            if (authData.user) {
                // Check if email confirmation is required
                if (authData.user.identities?.length === 0) {
                    setError('An account with this email already exists');
                    setLoading(false);
                    return;
                }

                // Step 2: Create the business and link to user
                // First, check if we have a session (auto-confirm) or will confirm via email
                const { data: { session } } = await supabase.auth.getSession();

                if (session || authData.session) {
                    // Auto-confirmed - create business immediately
                    // Create business - note: owner_id column may not exist, so we store owner in user_metadata
                    const { data: businessData, error: businessError } = await supabase
                        .from('businesses')
                        .insert({
                            name: businessName,
                            niche_type: nicheType,
                            crm_type: 'custom',
                        })
                        .select()
                        .single();

                    if (businessError) {
                        console.error('Error creating business:', businessError);
                        // Continue anyway - user can set up business later
                    }

                    // Update user metadata with business_id
                    await supabase.auth.updateUser({
                        data: {
                            business_id: businessData?.id || 'pending',
                            business_name: businessName,
                            niche_type: nicheType,
                            role: 'owner',
                        },
                    });

                    // Redirect to dashboard
                    router.push('/dashboard');
                    router.refresh();
                } else {
                    // Email confirmation required
                    // Store business name in localStorage for after confirmation
                    localStorage.setItem('pending_business_name', businessName);
                    setSuccess(true);
                }
            }
        } catch (err) {
            console.error('Signup error:', err);
            setError('An unexpected error occurred. Please try again.');
        } finally {
            setLoading(false);
        }
    }

    if (success) {
        return (
            <div className="flex min-h-screen items-center justify-center p-4">
                <Card className="w-full max-w-md">
                    <CardHeader className="text-center">
                        <div className="mx-auto mb-4 w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                            <CheckCircle className="w-6 h-6 text-green-600" />
                        </div>
                        <CardTitle className="text-2xl">Check your email</CardTitle>
                        <CardDescription>
                            We've sent a confirmation link to <strong>{email}</strong>.
                            Click the link to verify your account.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="text-center">
                        <Link href="/login">
                            <Button variant="outline" className="mt-4">
                                Back to login
                            </Button>
                        </Link>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen items-center justify-center p-4">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <div className="mx-auto mb-4 w-12 h-12 bg-gradient-to-br from-primary to-blue-600 rounded-lg flex items-center justify-center">
                        <span className="text-white font-bold text-lg">MS</span>
                    </div>
                    <CardTitle className="text-2xl">Create your account</CardTitle>
                    <CardDescription>
                        Start your Growth Engine - it's free!
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSignup} className="space-y-4">
                        {error && (
                            <Alert variant="destructive">
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="businessName">Business Name</Label>
                            <Input
                                id="businessName"
                                type="text"
                                placeholder="Your Company Name"
                                value={businessName}
                                onChange={(e) => setBusinessName(e.target.value)}
                                required
                                disabled={loading}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="nicheType">Industry / Niche</Label>
                            <Select value={nicheType} onValueChange={(val: NicheType) => setNicheType(val)} disabled={loading}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select your industry" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="general">General Business</SelectItem>
                                    <SelectItem value="medspa">MedSpa & Aesthetics</SelectItem>
                                    <SelectItem value="dental">Dental Practice</SelectItem>
                                    <SelectItem value="law">Law Firm</SelectItem>
                                    <SelectItem value="real_estate">Real Estate</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

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
                                placeholder="At least 8 characters"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                disabled={loading}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="confirmPassword">Confirm Password</Label>
                            <Input
                                id="confirmPassword"
                                type="password"
                                placeholder="Confirm your password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                                disabled={loading}
                            />
                        </div>

                        <Button type="submit" className="w-full" disabled={loading}>
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Creating account...
                                </>
                            ) : (
                                'Create account'
                            )}
                        </Button>

                        <div className="text-center text-sm text-gray-600">
                            Already have an account?{' '}
                            <Link href="/login" className="text-primary hover:underline">
                                Sign in
                            </Link>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
