
import { Outlet } from "react-router-dom"
import { Header } from "./Header"
import { Footer } from "./Footer"
import { Sidebar } from "./Sidebar"
import { Breadcrumbs } from "./Breadcrumbs"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"

function getInitialSidebarOpen(): boolean {
  const match = document.cookie.match(/(?:^|;\s*)sidebar:state=(true|false)/)
  return match ? match[1] === "true" : true
}

export function Layout() {
  return (
    <SidebarProvider defaultOpen={getInitialSidebarOpen()}>
      <Sidebar />
      <SidebarInset>
        <Header />
        <Breadcrumbs />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
        <Footer />
      </SidebarInset>
    </SidebarProvider>
  )
}
