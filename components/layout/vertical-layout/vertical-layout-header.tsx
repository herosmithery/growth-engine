"use client"

import { usePathname } from "next/navigation"
import { Bell } from "lucide-react"

import { SidebarTrigger } from "@/components/ui/sidebar"
import { FullscreenToggle } from "@/components/layout/full-screen-toggle"
import { ModeDropdown } from "@/components/layout/mode-dropdown"
import { UserDropdown } from "@/components/layout/user-dropdown"
import { ToggleMobileSidebar } from "../toggle-mobile-sidebar"
import { useAuth } from "@/lib/auth-context"

const getPageTitle = (pathname: string) => {
  const titles: Record<string, string> = {
    '/dashboard': 'Dashboard',
    '/clients': 'Clients',
    '/leads': 'Leads',
    '/appointments': 'Appointments',
    '/calls': 'AI Calls',
    '/messages': 'Messages',
    '/followups': 'Follow-Ups',
    '/campaigns': 'Campaigns',
    '/reviews': 'Reviews',
    '/webhooks': 'Webhooks',
    '/settings': 'Settings',
    '/admin': 'Admin Panel',
  };
  return titles[pathname] || 'Dashboard';
};

export function VerticalLayoutHeader() {
  const pathname = usePathname();
  const { businessName } = useAuth();

  return (
    <header className="sticky top-0 z-40 w-full bg-background/80 backdrop-blur-md border-b border-sidebar-border h-[72px] flex items-center transition-all duration-300">
      <div className="w-full px-4 md:px-8 flex justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <ToggleMobileSidebar />
          <SidebarTrigger className="hidden lg:flex" />
          <div className="hidden sm:block ml-2">
            <h1 className="text-xl font-semibold text-foreground">
              {getPageTitle(pathname)}
            </h1>
            <p className="text-sm text-muted-foreground">
              {businessName || 'Welcome to your clinic dashboard'}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3">
          <button className="relative w-10 h-10 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
            <Bell className="w-5 h-5" />
            <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-rose-500 rounded-full" />
          </button>

          <FullscreenToggle />
          <ModeDropdown />
          <UserDropdown />
        </div>
      </div>
    </header>
  )
}

