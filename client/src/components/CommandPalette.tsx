
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { useAuth } from "@/contexts/AuthContext"
import { adminNavItems, studentNavItems, flattenNavItems } from "@/lib/nav-config"

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const { user } = useAuth()

  const isAdmin = user?.role === "admin"
  const items = flattenNavItems(isAdmin ? adminNavItems : studentNavItems)

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  const handleSelect = (href: string) => {
    setOpen(false)
    navigate(href)
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="h-8 gap-2 text-muted-foreground"
        onClick={() => setOpen(true)}
      >
        <Search className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Search navigation...</span>
        <kbd className="pointer-events-none hidden select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] sm:inline-flex">
          ⌘K
        </kbd>
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Jump to a page..." />
        <CommandList>
          <CommandEmpty>No matching page found.</CommandEmpty>
          <CommandGroup heading="Navigation">
            {items.map((item) => (
              <CommandItem key={item.href} value={item.title} onSelect={() => handleSelect(item.href)}>
                <item.icon className="mr-2 h-4 w-4" />
                <span>{item.title}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  )
}
