"use client"

import type { ReactNode } from "react"

import { Footer } from "../footer"
import { Sidebar } from "../sidebar"
import { VerticalLayoutHeader } from "./vertical-layout-header"

export function VerticalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex w-full transition-all duration-300">
      <Sidebar />
      <div className="flex-1 w-full min-w-0">
        <VerticalLayoutHeader />
        <main className="min-h-[calc(100svh-6.82rem)] bg-muted/40 p-4 md:p-8">
          {children}
        </main>
        <Footer />
      </div>
    </div>
  )
}

