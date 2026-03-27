"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { ChevronDown, Sparkles, LogOut, Heart, Shield } from "lucide-react"

import type { NavigationNestedItem, NavigationRootItem } from "@/types"

import { navigationsData } from "@/data/navigations"

import { isActivePathname } from "@/lib/utils"

import { useSettings } from "@/hooks/use-settings"
import { Badge } from "@/components/ui/badge"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarFooter,
  Sidebar as SidebarWrapper,
  useSidebar,
} from "@/components/ui/sidebar"
import { DynamicIcon } from "@/components/dynamic-icon"
import { CommandMenu } from "./command-menu"
import { useAuth } from "@/lib/auth-context"

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { openMobile, setOpenMobile, isMobile } = useSidebar()
  const { settings } = useSettings()

  const { businessName, branding, isAdmin, user, signOut } = useAuth()
  const isLoggedIn = !!user;

  const isHoizontalAndDesktop = settings.layout === "horizontal" && !isMobile

  // If the layout is horizontal and not on mobile, don't render the sidebar. (We use a menubar for horizontal layout navigation.)
  if (isHoizontalAndDesktop) return null

  const renderMenuItem = (item: NavigationRootItem | NavigationNestedItem) => {
    // If the item has nested items, render it with a collapsible dropdown.
    if (item.items) {
      return (
        <Collapsible className="group/collapsible">
          <CollapsibleTrigger asChild>
            <SidebarMenuButton className="w-full justify-between [&[data-state=open]>svg]:rotate-180">
              <span className="flex items-center">
                {"iconName" in item && (
                  <DynamicIcon name={item.iconName} className="me-2 h-4 w-4" />
                )}
                <span>{item.title}</span>
                {"label" in item && (
                  <Badge variant="secondary" className="me-2">
                    {item.label}
                  </Badge>
                )}
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200" />
            </SidebarMenuButton>
          </CollapsibleTrigger>
          <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
            <SidebarMenuSub>
              {item.items.map((subItem: NavigationNestedItem) => (
                <SidebarMenuItem key={subItem.title}>
                  {renderMenuItem(subItem)}
                </SidebarMenuItem>
              ))}
            </SidebarMenuSub>
          </CollapsibleContent>
        </Collapsible>
      )
    }

    // Otherwise, render the item with a link.
    if ("href" in item) {
      const isActive = isActivePathname(item.href, pathname)

      return (
        <SidebarMenuButton
          isActive={isActive}
          onClick={() => setOpenMobile(!openMobile)}
          asChild
        >
          <Link href={item.href}>
            {"iconName" in item && (
              <DynamicIcon name={item.iconName} className="h-4 w-4" />
            )}
            <span>{item.title}</span>
            {"label" in item && <Badge variant="secondary">{item.label}</Badge>}
          </Link>
        </SidebarMenuButton>
      )
    }
  }

  async function handleLogout() {
    await signOut();
    router.push('/login');
  }

  return (
    <SidebarWrapper side="left">
      <SidebarHeader>
        <Link
          href="/"
          className="w-fit flex text-foreground font-black p-2 pb-0 mb-2 items-center gap-3"
          onClick={() => isMobile && setOpenMobile(!openMobile)}
        >
          {branding?.logoUrl ? (
            <img
              src={branding.logoUrl}
              alt={businessName || 'Logo'}
              className="w-7 h-7 rounded-md object-contain"
            />
          ) : (
            <div
              className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
              style={{ backgroundColor: branding?.primaryColor || 'var(--primary)' }}
            >
              {businessName ? (
                <span className="text-white text-xs font-bold">{businessName.slice(0, 2).toUpperCase()}</span>
              ) : (
                <Sparkles className="w-3 h-3 text-white" />
              )}
            </div>
          )}
          <div className="flex flex-col">
            <span>{businessName || 'Growth Engine'}</span>
            <span className="text-xs font-normal text-muted-foreground">Powered by Scale with Jak</span>
          </div>
        </Link>
        <CommandMenu buttonClassName="max-w-full" />
      </SidebarHeader>

      <ScrollArea>
        <SidebarContent className="gap-0">
          {navigationsData.map((nav) => (
            <SidebarGroup key={nav.title}>
              <SidebarGroupLabel>{nav.title}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {nav.items.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      {renderMenuItem(item)}
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}

          {isAdmin && (
            <SidebarGroup>
              <SidebarGroupLabel>Admin</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      isActive={pathname === '/admin'}
                      onClick={() => setOpenMobile(!openMobile)}
                      asChild
                    >
                      <Link href="/admin">
                        <Shield className="h-4 w-4" />
                        <span>Admin Panel</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}

        </SidebarContent>
      </ScrollArea>

      <SidebarFooter>
        {isLoggedIn ? (
          <SidebarMenuButton onClick={handleLogout} className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
            <LogOut className="h-4 w-4" />
            <span>Sign Out</span>
          </SidebarMenuButton>
        ) : (
          <SidebarMenuButton asChild className="bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90">
            <Link href="/login">
              <Heart className="h-4 w-4" />
              <span>Sign In</span>
            </Link>
          </SidebarMenuButton>
        )}
      </SidebarFooter>
    </SidebarWrapper>
  )
}

