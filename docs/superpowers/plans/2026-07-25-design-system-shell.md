# Design System & App Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reskin ExamMaster to the approved "Professional & Trustworthy" navy/slate + teal design system, and rebuild the app shell (sidebar, header, breadcrumbs, ⌘K navigation) on top of it.

**Architecture:** ExamMaster's frontend (`client/`) already uses shadcn's CSS-variable token system (`client/src/index.css` + `client/tailwind.config.js`), so retheming those tokens, plus flattening the shared `Card`/`Table` primitives, cascades to every page automatically — no per-page changes needed for the color/density system itself. The codebase also has a complete, production-grade shadcn `Sidebar` primitive (`client/src/components/ui/sidebar.tsx`, 763 lines: `SidebarProvider`, collapsible icon-rail behavior, cookie persistence, built-in tooltips, `Cmd/Ctrl+B` shortcut) that was installed but never wired up — this plan builds the new `Sidebar`/`Layout`/`Header` on top of it instead of hand-rolling collapse logic.

**Tech Stack:** React 19 + Vite, TypeScript, Tailwind CSS 3.4, shadcn/ui (Radix primitives), react-router-dom v7, lucide-react icons, cmdk (command palette).

## Global Constraints

- Brand name is **"ExamMaster"** everywhere this plan touches (`Header.tsx`). `Login.tsx`/`Register.tsx` still say "CBE System" — those are NOT touched by this plan; they're fixed in the Auth phase.
- No frontend test framework exists in this repo (no Vitest/Jest, no test files, no Storybook) and **this plan does not introduce one**. Every task's verification step is manual: run `npm run dev` from `client/` and check specific behavior in the browser.
- Design tokens use the exact HSL values below — copy them verbatim, do not approximate further.
- Border radius: `0.375rem`. Font: Inter (sans), JetBrains Mono (mono).
- Icon sizing (spec: "16px inline, 20px section headers") applies to every **new** component this plan creates (they all use `h-4 w-4`/`size-4` inline consistently). Existing pages have inconsistent icon sizes today; auditing/fixing all of them is page-content work, same reasoning as the color audit in Task 13 — not repeated as a separate task since, unlike hardcoded colors, mismatched icon sizes don't fight the token system, they're just visual polish for a later phase.
- **Out of scope, do not do in this plan:** redesigning content inside individual pages (Exam Management tables, forms, etc.), a notification bell/backend, a profile page, cross-entity data search (the ⌘K palette is navigation-only), recoloring `--chart-1`..`--chart-5` (untouched — candidate for the Reports work in the Admin phase, not decided here).
- The existing `client/src/components/ui/sidebar.tsx` primitive must be used as-is (import from it) — do not hand-roll new collapse-state or persistence logic.
- All commands below are run from the `client/` directory unless stated otherwise.

---

### Task 1: Design tokens — retheme `index.css`

**Files:**
- Modify: `client/src/index.css`

**Interfaces:**
- Produces: CSS custom properties (`--background`, `--primary`, `--sidebar-background`, etc.) consumed by `tailwind.config.js` and every shadcn component already in the app — no other task needs anything from this file by name, they just render correctly once these are set.

- [ ] **Step 1: Replace the `:root` and `.dark` blocks**

Replace the entire content of `client/src/index.css` with:

```css

@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222 47% 11%;
    --card: 0 0% 100%;
    --card-foreground: 222 47% 11%;
    --popover: 0 0% 100%;
    --popover-foreground: 222 47% 11%;
    --primary: 175 77% 26%;
    --primary-foreground: 0 0% 100%;
    --secondary: 210 40% 96%;
    --secondary-foreground: 222 47% 11%;
    --muted: 210 40% 96%;
    --muted-foreground: 215 16% 47%;
    --accent: 166 76% 97%;
    --accent-foreground: 176 61% 19%;
    --destructive: 0 72% 51%;
    --destructive-foreground: 0 0% 100%;
    --border: 214 32% 91%;
    --input: 214 32% 91%;
    --ring: 175 77% 26%;
    --chart-1: 12 76% 61%;
    --chart-2: 173 58% 39%;
    --chart-3: 197 37% 24%;
    --chart-4: 43 74% 66%;
    --chart-5: 27 87% 67%;
    --radius: 0.375rem;
    --sidebar-background: 222 47% 11%;
    --sidebar-foreground: 214 32% 91%;
    --sidebar-primary: 172 66% 50%;
    --sidebar-primary-foreground: 222 47% 11%;
    --sidebar-accent: 217 33% 17%;
    --sidebar-accent-foreground: 0 0% 100%;
    --sidebar-border: 217 33% 17%;
    --sidebar-ring: 172 66% 50%;
  }
  .dark {
    --background: 229 84% 5%;
    --foreground: 210 40% 96%;
    --card: 222 47% 11%;
    --card-foreground: 210 40% 96%;
    --popover: 222 47% 11%;
    --popover-foreground: 210 40% 96%;
    --primary: 172 66% 50%;
    --primary-foreground: 229 84% 5%;
    --secondary: 217 33% 17%;
    --secondary-foreground: 210 40% 96%;
    --muted: 217 33% 17%;
    --muted-foreground: 215 20% 65%;
    --accent: 217 33% 17%;
    --accent-foreground: 172 66% 50%;
    --destructive: 0 62% 40%;
    --destructive-foreground: 210 40% 96%;
    --border: 217 33% 17%;
    --input: 217 33% 17%;
    --ring: 172 66% 50%;
    --chart-1: 220 70% 50%;
    --chart-2: 160 60% 45%;
    --chart-3: 30 80% 55%;
    --chart-4: 280 65% 60%;
    --chart-5: 340 75% 55%;
    --sidebar-background: 222 47% 11%;
    --sidebar-foreground: 214 32% 91%;
    --sidebar-primary: 172 66% 50%;
    --sidebar-primary-foreground: 222 47% 11%;
    --sidebar-accent: 217 33% 17%;
    --sidebar-accent-foreground: 0 0% 100%;
    --sidebar-border: 217 33% 17%;
    --sidebar-ring: 172 66% 50%;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground font-sans;
  }
}

```

Note: `font-sans` is added to the body rule now; it resolves correctly once Task 2 configures the `sans` font family (Tailwind won't error before then — `font-sans` already exists as a default Tailwind utility, it just won't be Inter until Task 2).

- [ ] **Step 2: Verify the retheme**

Run: `npm run dev` (from `client/`)

Open the app in a browser (default `http://localhost:5173`), log in, and check:
- Primary buttons, active nav states, and links are teal, not black/gray.
- Cards/borders read as white-on-slate with visible borders (no visual change expected in width/spacing yet — only color).
- Toggle dark mode via the existing header theme toggle: background goes near-black navy, primary becomes brighter teal.
- No visual regression: nothing should be unreadable (e.g. white text on white bg) in either mode.

- [ ] **Step 3: Commit**

```bash
git add client/src/index.css
git commit -m "feat: retheme design tokens to navy/slate + teal palette"
```

---

### Task 2: Typography — Inter + JetBrains Mono

**Files:**
- Modify: `client/package.json`
- Modify: `client/src/main.tsx`
- Modify: `client/tailwind.config.js`

**Interfaces:**
- Consumes: nothing from prior tasks.
- Produces: Tailwind `font-sans` = Inter, `font-mono` = JetBrains Mono, available to every component (used later for exam timers etc., though wiring timers to `font-mono` is out of scope for this phase — that's page content).

- [ ] **Step 1: Install font packages**

Run (from `client/`):
```bash
npm install @fontsource/inter @fontsource-variable/jetbrains-mono
```

- [ ] **Step 2: Import the fonts**

In `client/src/main.tsx`, add these two import lines directly after the existing `import './index.css'` line:

```ts
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import '@fontsource-variable/jetbrains-mono'
```

The full top of the file should now read:

```tsx

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import '@fontsource-variable/jetbrains-mono'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

- [ ] **Step 3: Register the font families in Tailwind**

In `client/tailwind.config.js`, inside `theme.extend`, add a `fontFamily` key alongside the existing `borderRadius`/`colors`/`keyframes`/`animation` keys:

```js
  		fontFamily: {
  			sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
  			mono: ['"JetBrains Mono Variable"', 'ui-monospace', 'monospace']
  		},
```

(Match the existing 2-tab indentation style already used in that file.)

- [ ] **Step 4: Verify**

Run: `npm run dev`

Open the app in a browser, open DevTools → Elements, select the `<body>` tag, and check the Computed styles panel: `font-family` should resolve to `Inter` (not a system font). Confirm text renders visibly different from the browser's default UI font (Inter has a distinct look — check the lowercase "a" and "g").

- [ ] **Step 5: Commit**

```bash
git add client/package.json client/package-lock.json client/src/main.tsx client/tailwind.config.js
git commit -m "feat: add Inter and JetBrains Mono fonts to the design system"
```

---

### Task 3: Shared `LoadingState`, `EmptyState`, `ErrorState` components

**Files:**
- Create: `client/src/components/ui/loading-state.tsx`
- Create: `client/src/components/ui/empty-state.tsx`
- Create: `client/src/components/ui/error-state.tsx`

**Interfaces:**
- Consumes: `cn` from `@/lib/utils`, `Button` from `@/components/ui/button` (both already exist).
- Produces:
  - `LoadingState({ label?: string, className?: string })` from `@/components/ui/loading-state`.
  - `EmptyState({ icon?: LucideIcon, title: string, description?: string, action?: { label: string, onClick: () => void }, className?: string })` from `@/components/ui/empty-state`.
  - `ErrorState({ title?: string, description?: string, onRetry?: () => void, className?: string })` from `@/components/ui/error-state`.
  - Task 9 (Sidebar rewrite) imports `LoadingState`. `EmptyState`/`ErrorState` have no consumer in this plan — see their verification note below for why that's expected.

- [ ] **Step 1: Create `LoadingState`**

```tsx

import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface LoadingStateProps {
  label?: string
  className?: string
}

export function LoadingState({ label = "Loading...", className }: LoadingStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground", className)}>
      <Loader2 className="h-6 w-6 animate-spin" />
      <p className="text-sm">{label}</p>
    </div>
  )
}
```

Save as `client/src/components/ui/loading-state.tsx`.

- [ ] **Step 2: Create `EmptyState`**

```tsx

import { type LucideIcon, Inbox } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: string
  action?: { label: string; onClick: () => void }
  className?: string
}

export function EmptyState({ icon: Icon = Inbox, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 py-12 text-center", className)}>
      <Icon className="h-8 w-8 text-muted-foreground" />
      <p className="text-sm font-medium">{title}</p>
      {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && (
        <Button size="sm" variant="outline" className="mt-2" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  )
}
```

Save as `client/src/components/ui/empty-state.tsx`.

- [ ] **Step 3: Create `ErrorState`**

```tsx

import { AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface ErrorStateProps {
  title?: string
  description?: string
  onRetry?: () => void
  className?: string
}

export function ErrorState({ title = "Something went wrong", description, onRetry, className }: ErrorStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 py-12 text-center", className)}>
      <AlertTriangle className="h-8 w-8 text-destructive" />
      <p className="text-sm font-medium">{title}</p>
      {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      {onRetry && (
        <Button size="sm" variant="outline" className="mt-2" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  )
}
```

Save as `client/src/components/ui/error-state.tsx`.

- [ ] **Step 4: Verify by temporary render**

Open `client/src/pages/BlankPage.tsx`, note its current content, then temporarily replace its returned JSX with:

```tsx
import { LoadingState } from "@/components/ui/loading-state"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"

export function BlankPage() {
  return (
    <div className="space-y-8 p-8">
      <LoadingState />
      <EmptyState title="No exams yet" description="Create your first exam to get started." action={{ label: "Create Exam", onClick: () => alert("clicked") }} />
      <ErrorState description="Could not reach the server." onRetry={() => alert("retry")} />
    </div>
  )
}
```

Run `npm run dev`, navigate to a URL that doesn't match any route (e.g. `/does-not-exist`) so `BlankPage` renders (per the `*` route in `App.tsx`), and confirm all three render correctly with legible text, correct icons, and the buttons trigger their `alert`s. Check both light and dark mode.

Why `EmptyState`/`ErrorState` have no real consumer yet: they're design-system primitives meant to replace ad hoc "No data"/error text found across 17 existing pages, but wiring each page to use them is page-content work — out of scope here (same reasoning as Task 13's color audit). This temporary render is the only verification they get in this phase; their real usage lands when the Admin/Student phases touch those pages.

**Then revert `BlankPage.tsx` to its original content** — this was a temporary smoke test, not a permanent change.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/ui/loading-state.tsx client/src/components/ui/empty-state.tsx client/src/components/ui/error-state.tsx
git commit -m "feat: add shared LoadingState, EmptyState, ErrorState components"
```

---

### Task 4: `StatusBadge` component + status tokens

**Files:**
- Modify: `client/src/index.css`
- Modify: `client/tailwind.config.js`
- Create: `client/src/components/ui/status-badge.tsx`

**Interfaces:**
- Consumes: `cn` from `@/lib/utils`, `cva`/`VariantProps` from `class-variance-authority` (already a dependency, used by `badge.tsx`).
- Produces: `StatusBadge({ status: Status, className?, ...divProps })` and the exported `Status` union type, from `@/components/ui/status-badge`. No task in this plan consumes it — same reasoning as `EmptyState`/`ErrorState` in Task 3: it's a design-system primitive whose first real usage (e.g. exam status tables) lands in the Admin phase.

- [ ] **Step 1: Add status tokens to `index.css`**

In `client/src/index.css`, inside the `:root { ... }` block, add these lines right after `--sidebar-ring: 172 66% 50%;`:

```css
    --status-info: 214 95% 93%;
    --status-info-foreground: 226 71% 33%;
    --status-warning: 48 96% 89%;
    --status-warning-foreground: 32 81% 29%;
    --status-danger: 0 93% 94%;
    --status-danger-foreground: 0 70% 35%;
```

Inside the `.dark { ... }` block, add these lines right after its `--sidebar-ring: 172 66% 50%;`:

```css
    --status-info: 224 64% 21%;
    --status-info-foreground: 212 96% 78%;
    --status-warning: 28 73% 26%;
    --status-warning-foreground: 41 96% 70%;
    --status-danger: 0 63% 20%;
    --status-danger-foreground: 0 91% 82%;
```

- [ ] **Step 2: Register the tokens in Tailwind**

In `client/tailwind.config.js`, inside `theme.extend.colors`, add a `status` key alongside the existing `sidebar` key:

```js
  			status: {
  				info: {
  					DEFAULT: 'hsl(var(--status-info))',
  					foreground: 'hsl(var(--status-info-foreground))'
  				},
  				warning: {
  					DEFAULT: 'hsl(var(--status-warning))',
  					foreground: 'hsl(var(--status-warning-foreground))'
  				},
  				danger: {
  					DEFAULT: 'hsl(var(--status-danger))',
  					foreground: 'hsl(var(--status-danger-foreground))'
  				}
  			},
```

- [ ] **Step 3: Create `StatusBadge`**

```tsx

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

export type Status =
  | "active"
  | "in-progress"
  | "published"
  | "draft"
  | "archived"
  | "completed"
  | "graded"
  | "pending-review"
  | "flagged"
  | "overdue"
  | "rejected"
  | "error"

const STATUS_LABELS: Record<Status, string> = {
  active: "Active",
  "in-progress": "In Progress",
  published: "Published",
  draft: "Draft",
  archived: "Archived",
  completed: "Completed",
  graded: "Graded",
  "pending-review": "Pending Review",
  flagged: "Flagged",
  overdue: "Overdue",
  rejected: "Rejected",
  error: "Error",
}

const statusBadgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
  {
    variants: {
      status: {
        active: "bg-accent text-accent-foreground",
        "in-progress": "bg-accent text-accent-foreground",
        published: "bg-accent text-accent-foreground",
        draft: "bg-muted text-muted-foreground",
        archived: "bg-muted text-muted-foreground opacity-60",
        completed: "bg-status-info text-status-info-foreground",
        graded: "bg-status-info text-status-info-foreground",
        "pending-review": "bg-status-warning text-status-warning-foreground",
        flagged: "bg-status-warning text-status-warning-foreground",
        overdue: "bg-status-danger text-status-danger-foreground",
        rejected: "bg-status-danger text-status-danger-foreground",
        error: "bg-status-danger text-status-danger-foreground",
      } satisfies Record<Status, string>,
    },
    defaultVariants: {
      status: "draft",
    },
  }
)

export interface StatusBadgeProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "children">,
    VariantProps<typeof statusBadgeVariants> {
  status: Status
}

export function StatusBadge({ status, className, ...props }: StatusBadgeProps) {
  return (
    <div className={cn(statusBadgeVariants({ status }), className)} {...props}>
      {STATUS_LABELS[status]}
    </div>
  )
}
```

Save as `client/src/components/ui/status-badge.tsx`.

- [ ] **Step 4: Verify by temporary render**

Same method as Task 3 Step 4: temporarily render every status in `client/src/pages/BlankPage.tsx`:

```tsx
import { StatusBadge, type Status } from "@/components/ui/status-badge"

const ALL_STATUSES: Status[] = ["active", "in-progress", "published", "draft", "archived", "completed", "graded", "pending-review", "flagged", "overdue", "rejected", "error"]

export function BlankPage() {
  return (
    <div className="flex flex-wrap gap-2 p-8">
      {ALL_STATUSES.map((s) => <StatusBadge key={s} status={s} />)}
    </div>
  )
}
```

Run `npm run dev`, visit a non-existent route, confirm all 12 badges render with visibly distinct colors (teal-ish for active/in-progress/published, slate for draft, faded slate for archived, blue for completed/graded, amber for pending-review/flagged, red for overdue/rejected/error) in both light and dark mode, all text legible.

**Revert `BlankPage.tsx`** afterward.

- [ ] **Step 5: Commit**

```bash
git add client/src/index.css client/tailwind.config.js client/src/components/ui/status-badge.tsx
git commit -m "feat: add StatusBadge component and status color tokens"
```

---

### Task 5: Flatten `Card` and densify `Table` primitives

**Files:**
- Modify: `client/src/components/ui/card.tsx`
- Modify: `client/src/components/ui/table.tsx`

**Interfaces:**
- Consumes: nothing new — both files already only use `cn` from `@/lib/utils`.
- Produces: identical exports/signatures to before (`Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`, `Table`, `TableHeader`, `TableBody`, `TableFooter`, `TableRow`, `TableHead`, `TableCell`, `TableCaption`) — every existing call site across the app is unaffected and picks up the new look automatically, same cascading mechanism as Task 1.

This task exists because the spec's "Cards: flat with a 1px border instead of heavy shadows" and "Tables: sticky header, dense rows" conventions are satisfiable as single-file primitive edits — the same low-risk, high-leverage pattern as the token retheme — rather than page-by-page work. (Right-aligned numeric columns and sticky-header *usage* still depend on each page's own column layout / bounded-height container, which is correctly out of scope here — see Step 3.)

- [ ] **Step 1: Flatten `Card`**

In `client/src/components/ui/card.tsx`, in the `Card` component, change:
```tsx
      "rounded-lg border bg-card text-card-foreground shadow-sm",
```
to:
```tsx
      "rounded-lg border bg-card text-card-foreground shadow-none",
```

In `CardHeader`, change:
```tsx
    className={cn("flex flex-col space-y-1.5 p-6", className)}
```
to:
```tsx
    className={cn("flex flex-col space-y-1.5 p-4", className)}
```

In `CardContent`, change:
```tsx
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
```
to:
```tsx
  <div ref={ref} className={cn("p-4 pt-0", className)} {...props} />
```

In `CardFooter`, change:
```tsx
    className={cn("flex items-center p-6 pt-0", className)}
```
to:
```tsx
    className={cn("flex items-center p-4 pt-0", className)}
```

- [ ] **Step 2: Densify `Table`**

In `client/src/components/ui/table.tsx`, in `TableHeader`, change:
```tsx
  <thead ref={ref} className={cn("[&_tr]:border-b", className)} {...props} />
```
to:
```tsx
  <thead ref={ref} className={cn("sticky top-0 z-10 bg-background [&_tr]:border-b", className)} {...props} />
```

In `TableHead`, change:
```tsx
      "h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0",
```
to:
```tsx
      "h-9 px-3 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0",
```

In `TableCell`, change:
```tsx
    <td ref={ref} className={cn("p-4 align-middle [&:has([role=checkbox])]:pr-0", className)} {...props} />
```
to:
```tsx
    <td ref={ref} className={cn("py-2 px-3 align-middle [&:has([role=checkbox])]:pr-0", className)} {...props} />
```

Note on the sticky header: `sticky top-0` only visibly sticks once a page wraps its `<Table>` in a container with a bounded height and its own scroll (e.g. `<div className="max-h-[600px] overflow-auto">`). No existing page currently does that, so this change is inert until a later phase adds one — it's forward-compatible, not a functional no-op bug.

- [ ] **Step 3: Verify the cascade**

Run: `npm run dev`, log in as admin, and check two pre-existing pages (view-only, do not edit them):
- `/admin` (`AdminDashboard.tsx`, uses `Card`): cards now render with no drop shadow and tighter internal padding than before.
- `/admin/students` or `/admin/questions` (uses `Table`): table rows are visibly shorter (less vertical padding) than before Task 1.

Confirm nothing looks broken (text isn't clipped, buttons inside cards still have reasonable spacing).

- [ ] **Step 4: Commit**

```bash
git add client/src/components/ui/card.tsx client/src/components/ui/table.tsx
git commit -m "feat: flatten Card and densify Table primitives per design system"
```

---

### Task 6: Shared nav configuration

**Files:**
- Create: `client/src/lib/nav-config.ts`

**Interfaces:**
- Consumes: nothing (pure data + types).
- Produces: `adminNavItems: NavEntry[]`, `studentNavItems: NavEntry[]`, `isNavGroup(entry): entry is NavGroup`, `flattenNavItems(entries): NavLeaf[]`, and the `NavEntry`/`NavLeaf`/`NavGroup` types — all from `@/lib/nav-config`. Task 8 (CommandPalette) and Task 9 (Sidebar) both import from here.

- [ ] **Step 1: Create the file**

```ts

import type { LucideIcon } from "lucide-react"
import {
  LayoutDashboard,
  FileText,
  Users,
  BarChart3,
  Settings,
  BookOpen,
  ClipboardList,
  TrendingUp,
  Bookmark,
  MessageSquare,
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
```

Save as `client/src/lib/nav-config.ts`. Note: "Database Seeding" is intentionally not in this list — see Task 12.

- [ ] **Step 2: Verify by temporary log**

In `client/src/main.tsx`, temporarily add after the existing imports:

```ts
import { flattenNavItems, adminNavItems } from './lib/nav-config'
console.log('[nav-config check]', flattenNavItems(adminNavItems).map((i) => i.title))
```

Run `npm run dev`, open the browser console, and confirm the logged array is exactly:
`["Dashboard", "All Exams", "Create Exam", "Questions", "Subjects", "Students", "Reports", "AI Chat", "Settings"]`

**Remove the two temporary lines from `main.tsx`** afterward.

- [ ] **Step 3: Commit**

```bash
git add client/src/lib/nav-config.ts
git commit -m "feat: extract shared nav-config data for sidebar and command palette"
```

---

### Task 7: Breadcrumbs

**Files:**
- Create: `client/src/lib/breadcrumbs.ts`
- Create: `client/src/components/Breadcrumbs.tsx`

**Interfaces:**
- Consumes: nothing from prior tasks.
- Produces: `getBreadcrumbs(pathname: string): BreadcrumbSegment[]` from `@/lib/breadcrumbs`, and `<Breadcrumbs />` (reads `useLocation()` itself, no props) from `@/components/Breadcrumbs`. Task 10 (Layout rewrite) mounts `<Breadcrumbs />`.

- [ ] **Step 1: Create the pure breadcrumb function**

```ts

export interface BreadcrumbSegment {
  label: string
  href: string
}

const ROUTE_LABELS: Record<string, string> = {
  admin: "Admin",
  student: "Student",
  exams: "Exam Management",
  create: "Create Exam",
  edit: "Edit Exam",
  details: "Details",
  questions: "Questions",
  subjects: "Subjects",
  students: "Students",
  reports: "Reports",
  "ai-chat": "AI Chat",
  settings: "Settings",
  seeding: "Database Seeding",
  results: "My Results",
  instructions: "Instructions",
  mobile: "Mobile",
}

const ID_PATTERN = /^[0-9a-fA-F]{24}$|^\d+$/

export function getBreadcrumbs(pathname: string): BreadcrumbSegment[] {
  const parts = pathname.split("/").filter(Boolean)
  const crumbs: BreadcrumbSegment[] = []
  let href = ""

  for (const part of parts) {
    href += `/${part}`
    const label = ID_PATTERN.test(part) ? "Details" : ROUTE_LABELS[part] ?? part
    crumbs.push({ label, href })
  }

  return crumbs
}
```

Save as `client/src/lib/breadcrumbs.ts`.

- [ ] **Step 2: Create the component**

```tsx

import { Link, useLocation } from "react-router-dom"
import { ChevronRight } from "lucide-react"
import { getBreadcrumbs } from "@/lib/breadcrumbs"

export function Breadcrumbs() {
  const location = useLocation()
  const crumbs = getBreadcrumbs(location.pathname)

  if (crumbs.length === 0) return null

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 border-b bg-background px-4 py-1.5 text-xs text-muted-foreground">
      {crumbs.map((crumb, index) => {
        const isLast = index === crumbs.length - 1
        return (
          <span key={crumb.href} className="flex items-center gap-1">
            {index > 0 && <ChevronRight className="h-3 w-3" />}
            {isLast ? (
              <span className="font-medium text-foreground">{crumb.label}</span>
            ) : (
              <Link to={crumb.href} className="hover:text-foreground">
                {crumb.label}
              </Link>
            )}
          </span>
        )
      })}
    </nav>
  )
}
```

Save as `client/src/components/Breadcrumbs.tsx`.

- [ ] **Step 3: Verify by temporary mount**

Open `client/src/pages/BlankPage.tsx`, note its current content, then temporarily replace it with:

```tsx
import { Breadcrumbs } from "@/components/Breadcrumbs"

export function BlankPage() {
  return <Breadcrumbs />
}
```

Run `npm run dev` and navigate directly (via the browser address bar) to each of these paths, confirming the rendered breadcrumb trail matches:
- `/admin/exams` → `Admin / Exam Management`
- `/admin/exams/create` → `Admin / Exam Management / Create Exam`
- `/admin/exams/edit/507f1f77bcf86cd799439011` → `Admin / Exam Management / Edit Exam / Details`
- `/student/results` → `Student / My Results`

(These will all hit the `BlankPage` fallback since we've temporarily replaced its content — that's fine, we're only checking the breadcrumb output, not routing.)

**Revert `BlankPage.tsx`** to its original content afterward.

- [ ] **Step 4: Commit**

```bash
git add client/src/lib/breadcrumbs.ts client/src/components/Breadcrumbs.tsx
git commit -m "feat: add Breadcrumbs component"
```

---

### Task 8: Command palette (⌘K navigation)

**Files:**
- Create: `client/src/components/CommandPalette.tsx`

**Interfaces:**
- Consumes: `adminNavItems`, `studentNavItems`, `flattenNavItems` from `@/lib/nav-config` (Task 6); `CommandDialog`, `CommandInput`, `CommandList`, `CommandEmpty`, `CommandGroup`, `CommandItem` from `@/components/ui/command` (pre-existing); `useAuth` from `@/contexts/AuthContext` (pre-existing).
- Produces: `<CommandPalette />` (no props) from `@/components/CommandPalette`. Task 11 (Header rewrite) mounts it.

- [ ] **Step 1: Create the component**

```tsx

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
```

Save as `client/src/components/CommandPalette.tsx`.

- [ ] **Step 2: Verify by temporary mount**

Open `client/src/pages/BlankPage.tsx`, note its current content, then temporarily replace it with:

```tsx
import { CommandPalette } from "@/components/CommandPalette"

export function BlankPage() {
  return (
    <div className="p-8">
      <CommandPalette />
    </div>
  )
}
```

Run `npm run dev`, navigate to a non-existent route, and:
- Click the "Search navigation..." button — the dialog should open with a list of nav items (as an admin user, or student items if logged in as a student).
- Close it, then press `Ctrl+K` (or `Cmd+K` on Mac) — the dialog should toggle open/closed.
- Type part of an item's name (e.g. "quest") — the list should filter to matching items (cmdk's built-in fuzzy filter).
- Click an item — the dialog should close and the browser should navigate to that item's route.

**Revert `BlankPage.tsx`** to its original content afterward.

- [ ] **Step 3: Commit**

```bash
git add client/src/components/CommandPalette.tsx
git commit -m "feat: add CommandPalette for keyboard-driven navigation"
```

---

### Task 9: Rewrite `Sidebar.tsx` on the existing `ui/sidebar` primitive

**Files:**
- Modify: `client/src/components/Sidebar.tsx`

**Interfaces:**
- Consumes: `Sidebar` (aliased), `SidebarContent`, `SidebarGroup`, `SidebarGroupContent`, `SidebarHeader`, `SidebarMenu`, `SidebarMenuButton`, `SidebarMenuItem`, `SidebarMenuSub`, `SidebarMenuSubButton`, `SidebarMenuSubItem` from `@/components/ui/sidebar` (pre-existing, Task 10 wraps it in `SidebarProvider`); `LoadingState` from `@/components/ui/loading-state` (Task 3); `adminNavItems`, `studentNavItems`, `isNavGroup` from `@/lib/nav-config` (Task 6); `Collapsible`/`CollapsibleTrigger`/`CollapsibleContent` from `@/components/ui/collapsible` (pre-existing); `useAuth` from `@/contexts/AuthContext` (pre-existing).
- Produces: `<Sidebar />` (no props) from `@/components/Sidebar` — same export name/shape as before, so `Layout.tsx` (Task 10) doesn't need an import change. Must be rendered inside a `SidebarProvider` (Task 10 provides it).

- [ ] **Step 1: Replace the file contents**

```tsx

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
```

This removes: the old fixed-`w-64` hand-rolled markup, all `console.log` debug statements, and the "Database Seeding" nav entry (moved to Settings in Task 12).

- [ ] **Step 2: Verify (after Task 10 wires it into `Layout`)**

This component cannot render standalone (it requires a `SidebarProvider` ancestor, which `useSidebar()` throws without). Its real verification happens in Task 10's Step 3, once `Layout.tsx` provides that context. Confirm the file compiles with no TypeScript errors for now:

Run: `npx tsc --noEmit` (from `client/`) and confirm no errors are reported for `src/components/Sidebar.tsx` specifically. Ignore errors elsewhere caused by `Layout.tsx`/`Header.tsx` not yet updated — those are expected until Tasks 10-11 land.

- [ ] **Step 3: Commit**

```bash
git add client/src/components/Sidebar.tsx
git commit -m "refactor: rebuild Sidebar on the existing shadcn sidebar primitive"
```

---

### Task 10: Rewrite `Layout.tsx` — mount `SidebarProvider`, `Breadcrumbs`, drop the gradient background

**Files:**
- Modify: `client/src/components/Layout.tsx`

**Interfaces:**
- Consumes: `SidebarProvider`, `SidebarInset` from `@/components/ui/sidebar`; `Breadcrumbs` from `@/components/Breadcrumbs` (Task 7); `Sidebar` from `./Sidebar` (Task 9); `Header` from `./Header` (Task 11 — must land before this task's final verification, though the file can be edited in either order).
- Produces: `<Layout />` — same export/usage (`App.tsx` already imports and routes to it, no changes needed there).

- [ ] **Step 1: Replace the file contents**

```tsx

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
```

This drops the old `min-h-screen bg-gradient-to-br from-background via-background to-secondary/20` wash (inconsistent with the flat "Professional & Trustworthy" direction — `SidebarInset` already applies a flat `bg-background`) and the manual `pt-16`/`h-[calc(100vh-4rem)]` offset hacks (no longer needed since `Header` is a normal flex child now, not `fixed` — see Task 11).

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit` (from `client/`) and confirm no errors in `src/components/Layout.tsx`, `src/components/Sidebar.tsx`, or `src/components/Header.tsx`. (If Task 11 hasn't landed yet, expect errors from `Header.tsx` still referencing the old fixed layout — complete Task 11 before this check if working sequentially.)

- [ ] **Step 3: Full end-to-end verification**

Run: `npm run dev`, log in as an admin user, and check:
- Sidebar renders on the left, dark navy, with the "Admin Panel" nav.
- Header renders at the top, full width, not overlapping content (no more fixed-position overlap).
- Breadcrumb strip renders directly below the header, updates correctly as you click through nav items (spot-check 2-3 routes).
- Click the sidebar collapse toggle (in the header, added in Task 11) — sidebar shrinks to icon-only rail, main content reflows to use the freed space, nav item labels disappear but icons + tooltips-on-hover still work.
- Refresh the page — the sidebar's collapsed/expanded state should persist (reads the `sidebar:state` cookie set by the primitive).
- Repeat logged in as a student — "Student Portal" nav renders instead, only Dashboard/My Results.
- Toggle dark mode — sidebar and content both adapt correctly, no unstyled flashes.

- [ ] **Step 4: Commit**

```bash
git add client/src/components/Layout.tsx
git commit -m "refactor: rebuild Layout around SidebarProvider/SidebarInset, add breadcrumbs"
```

---

### Task 11: Rewrite `Header.tsx` — fix branding, remove dead code, mount sidebar toggle + command palette

**Files:**
- Modify: `client/src/components/Header.tsx`

**Interfaces:**
- Consumes: `SidebarTrigger` from `@/components/ui/sidebar` (pre-existing primitive); `CommandPalette` from `@/components/CommandPalette` (Task 8).
- Produces: `<Header />` — same export/usage as before (`Layout.tsx`, Task 10, already imports it).

- [ ] **Step 1: Replace the file contents**

```tsx

import { LogOut } from "lucide-react"
import { Button } from "./ui/button"
import { ThemeToggle } from "./ui/theme-toggle"
import { SidebarTrigger } from "./ui/sidebar"
import { CommandPalette } from "./CommandPalette"
import { useAuth } from "@/contexts/AuthContext"
import { useNavigate } from "react-router-dom"
import { Badge } from "./ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu"

export function Header() {
  const { logout, user } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate("/login")
  }

  const getUserInitials = (name?: string) => {
    if (!name) return "U"
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }

  const getUserRole = () => {
    if (!user) return "User"
    return user.role === 'admin' ? 'Admin' : 'Student'
  }

  return (
    <header className="flex h-14 items-center justify-between border-b bg-background px-4">
      <div className="flex items-center gap-3">
        <SidebarTrigger />
        <div className="text-lg font-bold text-foreground">
          ExamMaster
        </div>
        <Badge variant="secondary" className="text-xs">
          {getUserRole()}
        </Badge>
      </div>

      <div className="flex items-center gap-3">
        <CommandPalette />
        <ThemeToggle />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-8 w-8 rounded-full">
              <Avatar className="h-8 w-8">
                <AvatarImage src="/avatars/01.png" alt={user?.name || "User"} />
                <AvatarFallback>{getUserInitials(user?.name)}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{user?.name || "User"}</p>
                <p className="text-xs leading-none text-muted-foreground">
                  {user?.email || "user@example.com"}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
```

This fixes the "CBE System" → "ExamMaster" branding, drops the gradient-text-clip logo treatment, removes the commented-out notification bell and commented-out Profile menu item (dead code), and removes `fixed top-0 z-50 w-full backdrop-blur` (no longer needed — `Header` is now a normal flex child of `SidebarInset`, not fixed-position, per Task 10).

- [ ] **Step 2: Verify**

This is verified together with Task 10 Step 3 (they're structurally coupled — `Header` only renders correctly inside the new `Layout`). If Task 10 is already done, additionally check specifically here:
- Header text reads "ExamMaster", not "CBE System".
- No notification bell icon anywhere in the header.
- Clicking the sidebar-toggle icon (leftmost in the header) collapses/expands the sidebar.
- The "Search navigation..." button and `Ctrl+K`/`Cmd+K` both open the command palette (from Task 8).

- [ ] **Step 3: Commit**

```bash
git add client/src/components/Header.tsx
git commit -m "refactor: rebuild Header with ExamMaster branding, sidebar toggle, command palette"
```

---

### Task 12: Keep "Database Seeding" reachable from Settings

**Files:**
- Modify: `client/src/pages/admin/SettingsPage.tsx`

**Interfaces:**
- Consumes: `Link` from `react-router-dom` (newly imported in this task); pre-existing `Tabs`/`TabsContent`/`TabsTrigger`, `Card`/`CardHeader`/`CardTitle`/`CardDescription`/`CardContent`, `Button`, `Database` icon (all already imported in this file).
- Produces: nothing consumed by other tasks — this is a leaf change.

- [ ] **Step 1: Add the `react-router-dom` import**

At the top of `client/src/pages/admin/SettingsPage.tsx`, change:
```tsx
import { useEffect, useState } from "react"
```
to:
```tsx
import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
```

- [ ] **Step 2: Add the "Advanced" tab trigger**

Find (around line 535-539):
```tsx
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="general">General Settings</TabsTrigger>
          <TabsTrigger value="ai-platforms">AI Platforms</TabsTrigger>
        </TabsList>
```

Replace with:
```tsx
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="general">General Settings</TabsTrigger>
          <TabsTrigger value="ai-platforms">AI Platforms</TabsTrigger>
          <TabsTrigger value="advanced">Advanced</TabsTrigger>
        </TabsList>
```

- [ ] **Step 3: Add the "Advanced" tab content**

Find the end of the `ai-platforms` tab content and the closing `</Tabs>` tag (around lines 964-966):
```tsx
          )}
        </TabsContent>
      </Tabs>
```

Replace with:
```tsx
          )}
        </TabsContent>

        <TabsContent value="advanced" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <Database className="h-4 w-4" />
                Database Seeding
              </CardTitle>
              <CardDescription>
                Developer tool for populating the database with sample data. Not part of day-to-day administration.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" asChild>
                <Link to="/admin/seeding">Open Database Seeding</Link>
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
```

- [ ] **Step 4: Verify**

Run: `npm run dev`, log in as admin, navigate to `/admin/settings`, click the new "Advanced" tab, confirm the Database Seeding card renders, click "Open Database Seeding", confirm it navigates to `/admin/seeding` and that page renders (it's pre-existing and unaffected by this plan).

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/admin/SettingsPage.tsx
git commit -m "feat: surface Database Seeding under Settings > Advanced"
```

---

### Task 13: Hardcoded-color audit (inventory only)

**Files:**
- Create: `docs/superpowers/specs/2026-07-25-hardcoded-color-audit.md`

**Interfaces:**
- Consumes: nothing.
- Produces: a tracked inventory document. No code changes — see rationale below.

**Why inventory-only:** the spec called for "audit and fixes." Running the audit for real turned up hardcoded Tailwind color classes (`bg-blue-600`, `text-red-500`, etc., bypassing the design tokens) in **26 of the app's page/component files** — effectively every page. Fixing all of them means touching individual page content, which the same spec explicitly puts out of scope for this phase ("redesigning content inside individual pages... happens in the Admin/Student phases"). Rather than silently doing a 26-file sweep or silently dropping the fix, this task records the exact findings so the Admin and Student phases can consume them directly when they touch each page anyway.

- [ ] **Step 1: Run the audit and capture output**

Run (from the repo root):
```bash
grep -rnE "(bg|text|border)-(red|blue|green|yellow|amber|orange|purple|pink|indigo|teal|emerald|cyan|gray|slate|zinc|neutral|stone)-[0-9]{2,3}" client/src/pages client/src/components --include="*.tsx" > /tmp/hardcoded-color-audit-raw.txt
wc -l /tmp/hardcoded-color-audit-raw.txt
```

- [ ] **Step 2: Write the tracked audit document**

Create `docs/superpowers/specs/2026-07-25-hardcoded-color-audit.md` with this structure (fill the `<PASTE ...>` block with the actual command output from Step 1 — do not summarize or truncate it):

```markdown
# Hardcoded Color Audit

Generated during the Design System & App Shell phase (2026-07-25). These are
literal Tailwind color utility classes (`bg-blue-600`, `text-red-500`, etc.)
that bypass the design-token system introduced in that phase, found via:

    grep -rnE "(bg|text|border)-(red|blue|green|yellow|amber|orange|purple|pink|indigo|teal|emerald|cyan|gray|slate|zinc|neutral|stone)-[0-9]{2,3}" client/src/pages client/src/components --include="*.tsx"

They will NOT pick up the new navy/slate/teal palette automatically and will
look visually inconsistent next to token-driven components. Fixing them means
editing individual page content, which is out of scope for the shell phase —
**each of these should be fixed as its own page is touched by the Admin or
Student phase**, not as a standalone sweep.

## Raw findings

<PASTE the full output of the Step 1 command here, verbatim>

## Affected files (26)

<list the deduplicated file paths from the output>
```

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/specs/2026-07-25-hardcoded-color-audit.md
git commit -m "docs: record hardcoded-color audit for Admin/Student phases to consume"
```

---

## Plan Self-Review Notes

- **Spec coverage:** every spec section maps to a task — design tokens (1), typography (2), shared state components (3), StatusBadge (4), Card/Table primitive conventions (5) — this last one was missing from the first draft of this plan; caught during self-review because `Card`/`Table` are single shared files with the exact same "cascades everywhere for free" property as the token retheme, so leaving them untouched would have been an unforced spec gap — nav-config/breadcrumbs/command-palette/sidebar/layout/header (6-11) cover the app shell, Settings reachability for the removed nav item (12), and the color-audit risk mitigation (13).
- **Icon-size standardization** (spec: "16px inline, 20px section headers") is satisfied for every new component this plan writes, but not retrofitted onto existing pages — recorded as a one-line Global Constraint rather than a task, since (unlike hardcoded colors) it doesn't fight the token system and isn't worth a dedicated audit deliverable.
- **Deviation from spec, flagged explicitly:** the spec said "audit and fixes" for hardcoded colors; Task 13 does audit-only once the real blast radius (26 files) turned out to conflict with the spec's own "don't touch page content" boundary. Flagged in Task 13 rather than silently resolved.
- **Type consistency checked:** `NavEntry`/`NavLeaf`/`NavGroup` (Task 6) are used identically in Task 8 (`CommandPalette`) and Task 9 (`Sidebar`) — same import path, same field names (`title`, `href`, `icon`, `items`). `LoadingState`'s `label` prop (Task 3) matches its usage in Task 9. `Breadcrumbs`/`getBreadcrumbs` (Task 7) take no arguments beyond `pathname`, matching their only call site (the component itself, via `useLocation()`). Task numbering was fully re-checked after inserting Task 5 partway through drafting — every cross-reference above points at the current numbering, not the pre-insertion one.
