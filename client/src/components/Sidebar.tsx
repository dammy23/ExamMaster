
import { Link, useLocation } from "react-router-dom"
import { ChevronRight } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Sidebar as SidebarPrimitive,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"
import { LoadingState } from "@/components/ui/loading-state"
import { adminNavItems, studentNavItems, isNavGroup } from "@/lib/nav-config"

export function Sidebar() {
  const location = useLocation()
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <SidebarPrimitive collapsible="icon">
        <SidebarContent>
          <LoadingState label="Loading menu..." />
        </SidebarContent>
      </SidebarPrimitive>
    )
  }

  const isAdmin = user?.role === "admin" || (!user && location.pathname.startsWith("/admin"))
  const navItems = isAdmin ? adminNavItems : studentNavItems

  return (
    <SidebarPrimitive collapsible="icon">
      <SidebarHeader>
        <div className="flex h-8 items-center px-2 text-sm font-semibold text-sidebar-foreground group-data-[collapsible=icon]:justify-center">
          <span className="group-data-[collapsible=icon]:hidden">
            {isAdmin ? "Admin Panel" : "Student Portal"}
          </span>
          <span className="hidden group-data-[collapsible=icon]:inline">
            {isAdmin ? "AP" : "SP"}
          </span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) =>
                isNavGroup(item) ? (
                  <Collapsible
                    key={item.title}
                    defaultOpen={item.items.some((sub) => sub.href === location.pathname)}
                    className="group/collapsible"
                  >
                    <SidebarMenuItem>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton tooltip={item.title}>
                          <item.icon />
                          <span>{item.title}</span>
                          <ChevronRight className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          {item.items.map((subItem) => (
                            <SidebarMenuSubItem key={subItem.href}>
                              <SidebarMenuSubButton asChild isActive={location.pathname === subItem.href}>
                                <Link to={subItem.href}>
                                  <subItem.icon />
                                  <span>{subItem.title}</span>
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          ))}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </SidebarMenuItem>
                  </Collapsible>
                ) : (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={location.pathname === item.href} tooltip={item.title}>
                      <Link to={item.href}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </SidebarPrimitive>
  )
}
