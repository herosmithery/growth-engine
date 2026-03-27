'use client';

import { useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { hexToHsl, lightenHsl, darkenHsl } from '@/lib/color-utils';

/**
 * BrandingInjector — reads the logged-in client's brand colors from auth context
 * and injects them as CSS variable overrides on <html> so the entire UI reflects
 * the client's brand. No re-render needed — pure CSS variable injection.
 */
export function BrandingInjector() {
  const { branding, isAdmin } = useAuth();

  useEffect(() => {
    // Admins see the default platform branding
    if (isAdmin) return;

    const primary = branding?.primaryColor;
    const secondary = branding?.secondaryColor;

    if (!primary || primary === '#7c3aed') return; // default — no override needed

    const primaryHsl = hexToHsl(primary);
    const primaryLight = lightenHsl(primaryHsl, 50);
    const primaryDark = darkenHsl(primaryHsl, 10);

    const secondaryHsl = secondary ? hexToHsl(secondary) : lightenHsl(primaryHsl, 35);

    const style = document.getElementById('tenant-branding') || document.createElement('style');
    style.id = 'tenant-branding';
    style.textContent = `
      :root {
        --primary: ${primaryHsl};
        --primary-dark: ${primaryDark};
        --primary-light: ${primaryLight};
        --sidebar-primary: ${primaryHsl};
        --ring: ${primaryHsl};
      }
      :root .dark {
        --primary: ${primaryHsl};
        --sidebar-primary: ${primaryHsl};
        --ring: ${primaryHsl};
      }
    `;

    if (!document.getElementById('tenant-branding')) {
      document.head.appendChild(style);
    }

    return () => {
      document.getElementById('tenant-branding')?.remove();
    };
  }, [branding?.primaryColor, branding?.secondaryColor, isAdmin]);

  return null;
}
