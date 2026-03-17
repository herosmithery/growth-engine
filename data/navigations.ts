import type { NavigationType } from "@/types"

export const navigationsData: NavigationType[] = [
  {
    title: "Overview",
    items: [
      { title: "Dashboard", href: "/dashboard", iconName: "LayoutDashboard" },
    ],
  },
  {
    title: "Client Management",
    items: [
      { title: "Clients", href: "/clients", iconName: "Users" },
      { title: "Leads", href: "/leads", iconName: "UserPlus" },
      { title: "Calendar", href: "/calendar", iconName: "CalendarDays" },
      { title: "Appointments", href: "/appointments", iconName: "Calendar" },
    ],
  },
  {
    title: "Communication",
    items: [
      { title: "AI Calls", href: "/calls", iconName: "Phone" },
      { title: "Messages", href: "/messages", iconName: "Mail" },
      { title: "Follow-Ups", href: "/followups", iconName: "MessageSquare" },
    ],
  },
  {
    title: "Growth",
    items: [
      { title: "Campaigns", href: "/campaigns", iconName: "Megaphone" },
      { title: "Reviews", href: "/reviews", iconName: "Star" },
    ],
  },
  {
    title: "Operations",
    items: [
      { title: "Dispatch", href: "/dispatch", iconName: "MapPin" },
      { title: "Inventory", href: "/inventory", iconName: "Package" },
      { title: "Field Reports", href: "/field-reports", iconName: "ClipboardList" },
    ],
  },
  {
    title: "System",
    items: [
      { title: "Webhooks", href: "/webhooks", iconName: "Webhook" },
      { title: "Settings", href: "/settings", iconName: "Settings" },
    ],
  }
]
