# ExamMaster UI Overhaul — Phase 2: Auth Flow

## Context

Second of five phases in the ExamMaster UI overhaul (design system/shell → **auth** → admin → student). Phase 1 (design system & app shell) is merged to `main`: navy/slate/teal tokens, Inter/JetBrains Mono, flat `Card`/dense `Table`, `Sidebar`/`Layout`/`Header`/`Breadcrumbs`/`CommandPalette`. `Login.tsx`/`Register.tsx` are standalone routes (not wrapped by `Layout`), so none of that shell work touched them — this phase is where they finally pick up the new visual language.

## Current State (found during exploration)

- **`Login.tsx`**: hardcodes `bg-gray-50 dark:bg-gray-900` (bypasses tokens), hotlinks its logo from an unrelated third-party domain (`management.lascon.edu.ng`), displays "CBE System" branding, and has three dead commented-out blocks (a "first time user" seeding alert, the "Sign up" link, a "sample credentials" card).
- **`Register.tsx`** is reachable only by typing `/register` directly — the "Sign up" link on Login is commented out. Its role `<Select>` lets an unauthenticated visitor pick **Admin**, with zero restriction. The backend `POST /api/auth/register` (in `server/routes/authRoutes.js:89-176`) accepts and honors that role choice — a live, unauthenticated privilege-escalation path.
- Admins already have a legitimate way to create accounts (Student Management's "Add Student" / bulk CSV upload), so removing self-registration strands no real workflow.
- **No password recovery exists** despite the README claiming "password recovery via email" — no backend route, no UI. A working `EmailService` (`server/services/emailService.js`, nodemailer + SMTP settings from `settingService`) already sends exam-result emails and is reusable for a reset email.
- `User` model (`server/models/User.js`) has no reset-token fields.
- `server/utils/password.js` exports `hashPassword`/`comparePassword` (bcrypt) — reusable for setting the new password during reset.
- `AuthContext.tsx` has ~15 `console.log` debug statements (same pattern already cleaned out of `Sidebar.tsx` in Phase 1) and a `register` function that goes away with `Register.tsx`.
- The word "register" also appears in `CreateExam.tsx`, `EditExam.tsx`, `CreateExamModal.tsx` (react-hook-form's `register()` field binding) and `rich-text-editor.tsx` (`Quill.register()`) — unrelated to auth, not touched by this phase.

## Decisions

- **Self-registration is removed entirely** — `Register.tsx`, its `/register` route, `AuthContext.register`, `api/auth.ts`'s `register()`, and the backend `POST /api/auth/register` route all go away. Not gated, not restricted to student-only — deleted, since there's no legitimate use for it.
- **Password recovery is built for real**, reusing `EmailService`.
- **Layout**: centered card (validated via mockup), same treatment for Login, Forgot Password, and Reset Password — no split-screen brand panel.
- **Logo**: replace the hotlinked image with a self-contained text/icon wordmark ("ExamMaster"), matching the header's branding treatment from Phase 1.
- **Branding**: "CBE System" → "ExamMaster" (matches the Phase 1 decision, applied here since this phase is what touches these files).
- **Login's "seeding hint" banner** (nudges toward `/seeding` on a specific failed-login error) is a dev-onboarding affordance, not real product UX — removed in favor of a plain error toast.

## Password Reset — Design

**Token handling**: on `POST /api/auth/forgot-password { email }`, generate a random 32-byte token (`crypto.randomBytes(32).toString('hex')`). Store only its SHA-256 hash (`crypto.createHash('sha256').update(token).digest('hex')`) on the user document as `resetPasswordToken`, with `resetPasswordExpires` set 1 hour out. Email the **raw** token as a link (`{CLIENT_URL}/reset-password/{token}`) via a new `EmailService.sendPasswordReset(email, name, resetLink)` method, styled like the existing exam-results template. A SHA-256 hash (not bcrypt) is correct here — bcrypt's slow, salted hashing defends low-entropy human passwords against brute force; a 32-byte random token already has enough entropy that a fast, deterministic hash is the standard, appropriate choice, and it must be deterministic so the redemption lookup can hash the incoming token and match it directly.

**`CLIENT_URL`**: no such env var exists today — the only precedent is a hardcoded `http://localhost:5173` string in `server.js`'s boot log. Rather than hardcode a third instance, add `CLIENT_URL` to `server/.env` (with `process.env.CLIENT_URL || 'http://localhost:5173'` as the fallback in code, so a missing `.env` entry doesn't break the reset link in dev) and use it to build the reset link. This is the one small, justified infra addition in this phase — everything else reuses existing patterns.

**Anti-enumeration**: `forgot-password` always responds with the same generic success message ("If that email exists, we've sent a reset link") whether or not the email matches a user — never reveals which emails have accounts.

**Redemption**: `POST /api/auth/reset-password { token, password }` hashes the incoming token with SHA-256, looks up a user whose `resetPasswordToken` matches and whose `resetPasswordExpires` is still in the future, sets a new password via `hashPassword`, and clears both reset fields.

**Explicitly out of scope**: rate-limiting on `forgot-password` (no rate-limiting infrastructure exists anywhere in this backend today — not introduced here), "remember me"/persistent sessions, 2FA, refresh-token rotation changes.

## Pages

- **`Login.tsx`** (rewritten): centered card, text wordmark, tokens instead of hardcoded grays, "ExamMaster" branding, dead code removed, seeding-hint banner removed, new "Forgot password?" link next to the password field pointing to `/forgot-password`.
- **`ForgotPassword.tsx`** (new): email input, submits to the new endpoint, shows the generic success message, link back to `/login`.
- **`ResetPassword.tsx`** (new): reads `:token` from the URL, new-password + confirm-password inputs (client-side match check), submits to the new endpoint, redirects to `/login` with a success toast on completion; shows an error state if the backend reports the token invalid/expired.
- **`Register.tsx`**: deleted.

## Routing Changes (`App.tsx`)

- Remove: `import { Register }`, `<Route path="/register" .../>`.
- Add: `<Route path="/forgot-password" element={<ForgotPassword />} />`, `<Route path="/reset-password/:token" element={<ResetPassword />} />` — both standalone, unauthenticated, same tier as `/login`.

## Testing Approach

Same as Phase 1: no automated test framework exists in this repo and this phase doesn't introduce one. Verification is manual and end-to-end in a real browser: log in, request a reset, retrieve the emailed link (or the backend's logged content if SMTP isn't configured in the dev environment), follow it, set a new password, and confirm login works with the new password and fails with the old one. Confirm `/register` and the backend registration route are both genuinely gone (404/no route), not just hidden.

## Risks

- **Blast radius on `AuthContext.tsx`**: every authenticated page depends on this context; removing `register` and the debug logs must not change `login`/`logout`/`loading` behavior.
- **Email deliverability in dev**: if SMTP settings aren't configured in this environment, `EmailService.sendPasswordReset` will throw (matching existing `sendExamResults` behavior) — verification will fall back to reading the generated reset link from server logs rather than a real inbox.
- **Token reuse**: since `resetPasswordExpires` is cleared on successful reset, a used token cannot be replayed — this is verified explicitly during testing, not just assumed.
