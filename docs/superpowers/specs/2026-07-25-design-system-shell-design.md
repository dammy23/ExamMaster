# ExamMaster UI Overhaul — Phase 1: Design System & App Shell

## Context

ExamMaster ("total UI overhaul + features + functionality") is too large for a single spec. It decomposes into five independent pieces:

1. **Design system & app shell** ← this document
2. Auth flow (Login/Register/password recovery)
3. Admin suite (Dashboard, Exam CRUD, Questions, Subjects, Students, Reports, AI Chat, Settings, DB Seeding)
4. Student exam-taking experience (Dashboard, Instructions, Exam Attempt desktop/mobile, Results)
5. Functionality/UX improvements — folded into each area's own spec as we reach it, rather than handled as a separate stream

Agreed build order: **Design system & shell → Auth → Admin → Student**. Each phase gets its own brainstorm → spec → plan → implementation cycle. This document covers Phase 1 only.

Motivation (per stakeholder): both the visual language *and* underlying UX need work, equally — not a pure reskin.

## Current State (found during exploration)

- Frontend already uses shadcn's CSS-variable token system (`client/src/index.css`, consumed via `client/tailwind.config.js`) — currently all grayscale, no brand color.
- A `.dark` class variant already exists and the `ThemeToggle` component is wired up and functional in `Header.tsx` — it just currently toggles between two grayscale palettes.
- **Branding inconsistency**: browser tab title and `package.json` say "ExamMaster"; `Header.tsx` and `Login.tsx` hardcode "CBE System". Resolved: **ExamMaster** is correct everywhere. Note: `Login.tsx`/`Register.tsx` are standalone routes not wrapped by `Layout` (see `App.tsx`), so Phase 1 does not touch them — the `Header.tsx` fix ships now, the `Login.tsx`/`Register.tsx` fix ships with the Auth phase (Phase 2), which redesigns those pages anyway.
- `Sidebar.tsx`: fixed `w-64`, not collapsible; contains leftover `console.log` debug statements; "Database Seeding" nav item is commented out (dead code) even though the route exists.
- `Header.tsx`: notification bell is commented out (dead code, no backend to drive it); "Profile" menu item is commented out (no profile page exists); no breadcrumbs; no global search.
- `components/ui/command.tsx` (shadcn `Command` palette primitive) exists in the codebase but is not used anywhere — free win for a ⌘K navigator.
- 19 separate page files each implement their own ad hoc `animate-spin` loading indicator; no shared empty-state or error-state pattern; status labels (Active/Draft/etc.) are styled ad hoc per page instead of through one consistent mapping.
- No frontend test infrastructure exists (no Vitest/Jest, no test files, no Storybook).

## Visual Direction (validated via mockups)

**Style**: "Professional & Trustworthy" — navy/slate base, single teal accent, sharp-ish corners (6px radius, not fully square), dense information layout. Chosen over Modern Minimal, Bold & Vibrant, and Warm & Approachable directions.

**Navigation shell**: Option A — persistent left sidebar that collapses to an icon-only rail (vs. a top-nav-only or icon-rail+tabs alternative). Sidebar stays dark navy in both light and dark mode. Top header holds a ⌘K command trigger, and a user menu; a breadcrumb strip sits below the header.

## Design Tokens

### Light mode
| Token | HSL | Tailwind equivalent |
|---|---|---|
| `background` / `card` / `popover` | `0 0% 100%` | white |
| `foreground` / `card-foreground` / `popover-foreground` | `222 47% 11%` | slate-900 |
| `primary` | `175 77% 26%` | teal-700 |
| `primary-foreground` | `0 0% 100%` | white |
| `secondary` / `muted` | `210 40% 96%` | slate-100 |
| `secondary-foreground` | `222 47% 11%` | slate-900 |
| `muted-foreground` | `215 16% 47%` | slate-500 |
| `accent` | `166 76% 97%` | teal-50 |
| `accent-foreground` | `176 61% 19%` | teal-900 |
| `destructive` | `0 72% 51%` | red-600 |
| `destructive-foreground` | `0 0% 100%` | white |
| `border` / `input` | `214 32% 91%` | slate-200 |
| `ring` | `175 77% 26%` | teal-700 |
| `radius` | `0.375rem` | — |
| `sidebar-background` | `222 47% 11%` | slate-900 (dark, even in light mode) |
| `sidebar-foreground` | `214 32% 91%` | slate-200 |
| `sidebar-primary` | `172 66% 50%` | teal-400 |
| `sidebar-primary-foreground` | `222 47% 11%` | slate-900 |
| `sidebar-accent` | `217 33% 17%` | slate-800 (hover bg) |
| `sidebar-accent-foreground` | `0 0% 100%` | white |
| `sidebar-border` / `sidebar-ring` | `217 33% 17%` / `172 66% 50%` | slate-800 / teal-400 |

### Dark mode
| Token | HSL | Tailwind equivalent |
|---|---|---|
| `background` | `229 84% 5%` | slate-950 |
| `foreground` | `210 40% 96%` | slate-100 |
| `card` / `popover` | `222 47% 11%` | slate-900 |
| `primary` | `172 66% 50%` | teal-400 (brighter, for contrast on dark bg) |
| `primary-foreground` | `229 84% 5%` | slate-950 |
| `secondary` / `muted` / `accent` | `217 33% 17%` | slate-800 |
| `muted-foreground` | `215 20% 65%` | slate-400 |
| `accent-foreground` | `172 66% 50%` | teal-400 |
| `destructive` | `0 62% 40%` | red-700 |
| `border` / `input` | `217 33% 17%` | slate-800 |
| `ring` | `172 66% 50%` | teal-400 |
| `sidebar-*` | same as light mode | sidebar is already dark; dark mode mainly changes the content area |

### Status badge mapping (semantic, distinct from brand tokens)
| Status | Color |
|---|---|
| Active / In Progress / Published | teal (`primary`/`accent`) |
| Draft | slate (`muted`) |
| Completed / Graded | blue (`221 83% 53%` / blue-600) |
| Pending Review / Flagged | amber (`38 92% 50%` / amber-500) |
| Archived | slate-400 (lighter than Draft) |
| Overdue / Rejected / Error | red (`destructive`) |

Applied consistently everywhere a status appears: exams, exam attempts, AI grading, video review.

## Typography & Iconography

- **Inter** for all UI text (headings + body).
- **JetBrains Mono** (or `ui-monospace` fallback) for exam timers, IDs, and tabular numeric data — prevents digit jitter in countdown timers, reinforces precision.
- **lucide-react** stays the icon set (already used throughout) — standardize sizing: 16px inline, 20px section headers.
- Denser spacing than shadcn defaults: card padding `p-4` (not `p-6`), table row padding `py-2` (not `py-4`), base body text `text-sm` (14px) as default.

## App Shell Changes

- **`Sidebar.tsx`**: rewrite for icon-rail collapse behavior (state persisted to `localStorage`); remove `console.log` debug statements; move "Database Seeding" from top-level nav into Settings (advanced/dev section) since it's a developer tool, not a daily-use admin function.
- **`Header.tsx`**: fix branding to "ExamMaster"; add breadcrumb strip (new `Breadcrumbs` component, derived from route hierarchy); add ⌘K command palette (new component wrapping the existing but unused `components/ui/command.tsx`) — **navigation only** (jump to any page/section), not a data search, since no backend search endpoint exists. Remove the notification bell entirely rather than ship a non-functional placeholder — real notifications require deciding what triggers them (AI grading done? video flagged?), which belongs to the Admin/Student phases once that's known.
- New shared components: `LoadingState`, `EmptyState`, `ErrorState` (replacing the 19 duplicated ad hoc spinners), `StatusBadge` (wraps `Badge` with the mapping above).
- Cards: flat, 1px border, no heavy shadow — shadow reserved for genuinely elevated surfaces (modals, dropdowns, popovers).
- Tables: sticky header, dense rows, right-aligned numeric columns, status column uses `StatusBadge`.

## Scope

**In scope:** `index.css` token rewrite, `tailwind.config.js` font additions, Inter + JetBrains Mono webfonts, `LoadingState`/`EmptyState`/`ErrorState`/`StatusBadge`/`Breadcrumbs`/command-palette components, `Sidebar.tsx` and `Header.tsx` rewrites, hardcoded-color audit and fixes across existing pages.

**Explicitly out of scope (deferred to later phases):** redesigning content *inside* individual pages (Exam Management tables, Question forms, etc.) — these inherit the new tokens automatically since they already use shadcn primitives; their own layout/UX work happens in the Admin/Student phases. Notification backend and bell. Profile page. Cross-entity data search (only navigation search ships now). Introducing a test framework (none exists today; not introduced as a side effect of a UI phase).

## Risks & Mitigations

- **Hardcoded colors bypassing tokens** (e.g. `bg-blue-600` instead of `bg-primary`) won't pick up the new palette automatically — mitigate with a grep audit across all 21 pages before calling Phase 1 done.
- **Blast radius**: `Layout`/`Sidebar`/`Header` wrap every authenticated route, so this phase touches the whole app at once — mitigate with a manual QA pass across both admin and student views, not just spot checks.
- **Transitional inconsistency**: pages with their own heavy-shadow cards will look out of step with the new flat style until their own phase touches them — expected and acceptable given the phased rollout.
- **Dark-mode contrast**: teal-on-navy and teal-on-white combinations need a WCAG AA contrast check before shipping.

## Testing Approach

No frontend test infrastructure exists in this repo. Phase 1 verification is a manual QA checklist walking all 21 pages in both light and dark mode, checking: token cascade (no leftover grayscale), sidebar collapse/expand + persistence, breadcrumb correctness per route, ⌘K navigation, and the hardcoded-color audit. Introducing automated frontend testing is a separate decision, not bundled into this phase.
