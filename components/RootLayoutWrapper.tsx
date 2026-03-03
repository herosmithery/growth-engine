'use client';

import { usePathname } from 'next/navigation';
import { Layout } from '@/components/layout';
import { ReactNode } from 'react';

export function RootLayoutWrapper({ children }: { children: ReactNode }) {
    const pathname = usePathname();

    // Define public routes that shouldn't have the dashboard layout
    const isPublicRoute =
        pathname === '/' ||
        pathname === '/login' ||
        pathname === '/signup' ||
        pathname.startsWith('/pricing') ||
        pathname.startsWith('/seo');

    if (isPublicRoute) {
        return <>{children}</>;
    }

    return (
        <Layout>
            {children}
        </Layout>
    );
}
