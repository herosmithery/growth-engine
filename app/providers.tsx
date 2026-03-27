'use client';

import { ReactNode } from 'react';
import { AuthProvider } from '@/lib/auth-context';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Toaster } from 'sonner';

import { SettingsProvider } from "@/contexts/settings-context"
import { SidebarProvider } from "@/components/ui/sidebar"
import { ModeProvider } from "@/providers/mode-provider"
import { ThemeProvider } from "@/providers/theme-provider"
import { RootLayoutWrapper } from "@/components/RootLayoutWrapper"
import { BrandingInjector } from "@/components/BrandingInjector"

export function Providers({ children, locale = "en-US" }: { children: ReactNode, locale?: any }) {
    return (
        <ErrorBoundary>
            <SettingsProvider locale={locale}>
                <ModeProvider>
                    <ThemeProvider>
                        <SidebarProvider>
                            <AuthProvider>
                                <BrandingInjector />
                                <RootLayoutWrapper>
                                    {children}
                                </RootLayoutWrapper>
                                <Toaster
                                    position="top-right"
                                    richColors
                                    toastOptions={{
                                        style: {
                                            borderRadius: '12px',
                                            fontFamily: 'var(--font-body)',
                                        },
                                    }}
                                />
                            </AuthProvider>
                        </SidebarProvider>
                    </ThemeProvider>
                </ModeProvider>
            </SettingsProvider>
        </ErrorBoundary>
    );
}
