'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { User, Session } from '@supabase/supabase-js';

interface AuthContextType {
    user: User | null;
    session: Session | null;
    businessId: string | null;
    businessName: string | null;
    niche: string | null;
    isAdmin: boolean;
    loading: boolean;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [businessId, setBusinessId] = useState<string | null>(null);
    const [businessName, setBusinessName] = useState<string | null>(null);
    const [niche, setNiche] = useState<string | null>(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [loading, setLoading] = useState(true);

    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    useEffect(() => {
        // Get initial session
        async function getInitialSession() {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                handleSessionChange(session);
            } catch (error) {
                console.error('Error getting session:', error);
            } finally {
                setLoading(false);
            }
        }

        getInitialSession();

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (_event, session) => {
                handleSessionChange(session);
            }
        );

        return () => subscription.unsubscribe();
    }, []);

    async function handleSessionChange(session: Session | null) {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
            // Get role from metadata
            const role = session.user.app_metadata?.role || session.user.user_metadata?.role;
            setIsAdmin(role === 'admin' || role === 'super_admin');

            // Get business info from user metadata or fetch from database
            const userBusinessId = session.user.user_metadata?.business_id;
            const userBusinessName = session.user.user_metadata?.business_name;
            const userNiche = session.user.user_metadata?.niche_type;

            if (userBusinessId) {
                setBusinessId(userBusinessId);
                setBusinessName(userBusinessName || null);
                setNiche(userNiche || 'general');
            } else {
                // Try to fetch business_id from the business table linked to this user
                await fetchUserBusiness(session.user.id);
            }
        } else {
            // Not authenticated - clear business context
            // Users must log in to access the dashboard
            setBusinessId(null);
            setBusinessName(null);
            setNiche(null);
            setIsAdmin(false);
        }
    }

    async function fetchUserBusiness(userId: string) {
        try {
            // First check if user has a business linked via user_businesses junction table
            const { data: userBusiness, error: junctionError } = await supabase
                .from('user_businesses')
                .select('business_id, businesses(id, name, niche_type)')
                .eq('user_id', userId)
                .single();

            if (!junctionError && userBusiness) {
                setBusinessId(userBusiness.business_id);
                setBusinessName((userBusiness.businesses as any)?.name || null);
                setNiche((userBusiness.businesses as any)?.niche_type || 'general');
                return;
            }

            // Fallback: check businesses table directly if owner_id matches
            const { data: ownedBusiness, error: ownerError } = await supabase
                .from('businesses')
                .select('id, name, niche_type')
                .eq('owner_id', userId)
                .single();

            if (!ownerError && ownedBusiness) {
                setBusinessId(ownedBusiness.id);
                setBusinessName(ownedBusiness.name);
                setNiche(ownedBusiness.niche_type || 'general');
                return;
            }

            // If no business found, user might need to create one or be assigned
            console.log('No business found for user');
        } catch (error) {
            console.error('Error fetching user business:', error);
        }
    }

    async function signOut() {
        await supabase.auth.signOut();
        setUser(null);
        setSession(null);
        setBusinessId(null);
        setBusinessName(null);
        setNiche(null);
        setIsAdmin(false);
    }

    return (
        <AuthContext.Provider
            value={{
                user,
                session,
                businessId,
                businessName,
                niche,
                isAdmin,
                loading,
                signOut,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
