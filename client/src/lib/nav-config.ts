
import type { LucideIcon } from "lucide-react"
import {
  LayoutDashboard,
  FileText,
  Users,
  BarChart3,
  Settings,
  BookOpen,
  ClipboardList,
  ClipboardCheck,
  TrendingUp,
  Bookmark,
  MessageSquare,
  Activity,
} from "lucide-react"

export interface NavLeaf {
  title: string
  href: string
  icon: LucideIcon
}

export interface NavGroup {
  title: string
  icon: LucideIcon
  items: NavLeaf[]
}

export type NavEntry = NavLeaf | NavGroup

export function isNavGroup(entry: NavEntry): entry is NavGroup {
  return "items" in entry
}

export const adminNavItems: NavEntry[] = [
  { title: "Dashboard", href: "/admin", icon: LayoutDashboard },
  {
    title: "Exam Management",
    icon: FileText,
    items: [
      { title: "All Exams", href: "/admin/exams", icon: ClipboardList },
      { title: "Create Exam", href: "/admin/exams/create", icon: FileText },
    ],
  },
  { title: "Questions", href: "/admin/questions", icon: BookOpen },
  { title: "Subjects", href: "/admin/subjects", icon: Bookmark },
  { title: "Students", href: "/admin/students", icon: Users },
  { title: "Grading", href: "/admin/grading", icon: ClipboardCheck },
  { title: "Live Monitoring", href: "/admin/live-monitoring", icon: Activity },
  { title: "Reports", href: "/admin/reports", icon: BarChart3 },
  { title: "AI Chat", href: "/admin/ai-chat", icon: MessageSquare },
  { title: "Settings", href: "/admin/settings", icon: Settings },
]

export const studentNavItems: NavEntry[] = [
  { title: "Dashboard", href: "/student", icon: LayoutDashboard },
  { title: "My Results", href: "/student/results", icon: TrendingUp },
]

export function flattenNavItems(entries: NavEntry[]): NavLeaf[] {
  return entries.flatMap((entry) => (isNavGroup(entry) ? entry.items : [entry]))
}
