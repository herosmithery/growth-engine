"use client"

import Image from "next/image"
import Link from "next/link"
import { Sparkles } from "lucide-react"

import { FullscreenToggle } from "@/components/layout/full-screen-toggle"
import { ModeDropdown } from "@/components/layout/mode-dropdown"
import { UserDropdown } from "@/components/layout/user-dropdown"
import { ToggleMobileSidebar } from "../toggle-mobile-sidebar"

export function BottomBarHeader() {
  return (
    <div className="container flex h-14 justify-between items-center gap-4">
      <ToggleMobileSidebar />
      <Link href="/" className="hidden text-foreground font-black lg:flex items-center gap-2">
        <div className="w-6 h-6 rounded-md bg-[var(--primary)] dark:bg-white flex items-center justify-center">
          <Sparkles className="w-3 h-3 text-white dark:text-black" />
        </div>
        <span>Growth Engine</span>
      </Link>
      <div className="flex gap-2">
        <FullscreenToggle />
        <ModeDropdown />
        <UserDropdown />
      </div>
    </div>
  )
}
