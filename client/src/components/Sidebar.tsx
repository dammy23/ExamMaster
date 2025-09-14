import { useState, useEffect } from "react"
import { Link, useLocation } from "react-router-dom"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  LayoutDashboard,
  FileText,
  Users,
  BarChart3,
  Settings,
  ChevronDown,
  ChevronRight,
  BookOpen,
  ClipboardList,
  TrendingUp,
  Database
} from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"

const adminNavItems = [
  {
    title: "Dashboard",
    href: "/admin",
    icon: LayoutDashboard,
  },
  {
    title: "Exam Management",
    icon: FileText,
    items: [
      {
        title: "All Exams",
        href: "/admin/exams",
        icon: ClipboardList,
      },
      {
        title: "Create Exam",
        href: "/admin/exams/create",
        icon: FileText,
      },
    ],
  },
  {
    title: "Questions",
    href: "/admin/questions",
    icon: BookOpen,
  },
  {
    title: "Students",
    href: "/admin/students",
    icon: Users,
  },
  {
    title: "Reports",
    href: "/admin/reports",
    icon: BarChart3,
  },
  {
    title: "Database Seeding",
    href: "/admin/seeding",
    icon: Database,
  },
]

const studentNavItems = [
  {
    title: "Dashboard",
    href: "/student",
    icon: LayoutDashboard,
  },
  {
    title: "My Results",
    href: "/student/results",
    icon: TrendingUp,
  },
]

export function Sidebar() {
  const location = useLocation()
  const { user, loading } = useAuth()
  const [openItems, setOpenItems] = useState<string[]>([])

  console.log('Sidebar - Current user:', user)
  console.log('Sidebar - User loading:', loading)
  console.log('Sidebar - Current pathname:', location.pathname)

  // Wait for auth loading to complete before determining role
  if (loading) {
    return (
      <div className="pb-12 w-64 border-r bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
        </div>
      </div>
    )
  }

  // Determine user role - prioritize user object role, fallback to path detection
  const isAdmin = user?.role === 'admin' || (!user && location.pathname.startsWith('/admin'))
  const navItems = isAdmin ? adminNavItems : studentNavItems

  console.log('Sidebar - User role:', user?.role)
  console.log('Sidebar - Is admin:', isAdmin)
  console.log('Sidebar - Nav items:', navItems.map(item => item.title))

  const toggleItem = (title: string) => {
    setOpenItems(prev =>
      prev.includes(title)
        ? prev.filter(item => item !== title)
        : [...prev, title]
    )
  }

  const isItemOpen = (title: string) => openItems.includes(title)

  return (
    <div className="pb-12 w-64 border-r bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="space-y-4 py-4">
        <div className="px-3 py-2">
          <h2 className="mb-2 px-4 text-lg font-semibold tracking-tight">
            {isAdmin ? 'Admin Panel' : 'Student Portal'}
          </h2>
          <ScrollArea className="h-[calc(100vh-8rem)]">
            <div className="space-y-1">
              {navItems.map((item) => (
                <div key={item.title}>
                  {item.items ? (
                    <Collapsible
                      open={isItemOpen(item.title)}
                      onOpenChange={() => toggleItem(item.title)}
                    >
                      <CollapsibleTrigger asChild>
                        <Button
                          variant="ghost"
                          className="w-full justify-between"
                        >
                          <div className="flex items-center">
                            <item.icon className="mr-2 h-4 w-4" />
                            {item.title}
                          </div>
                          {isItemOpen(item.title) ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="space-y-1">
                        {item.items.map((subItem) => (
                          <Link key={subItem.href} to={subItem.href}>
                            <Button
                              variant="ghost"
                              className={cn(
                                "w-full justify-start pl-8",
                                location.pathname === subItem.href && "bg-muted"
                              )}
                            >
                              <subItem.icon className="mr-2 h-4 w-4" />
                              {subItem.title}
                            </Button>
                          </Link>
                        ))}
                      </CollapsibleContent>
                    </Collapsible>
                  ) : (
                    <Link to={item.href}>
                      <Button
                        variant="ghost"
                        className={cn(
                          "w-full justify-start",
                          location.pathname === item.href && "bg-muted"
                        )}
                      >
                        <item.icon className="mr-2 h-4 w-4" />
                        {item.title}
                      </Button>
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  )
}