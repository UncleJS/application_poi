# UI Modernization Design Plan

_Last updated: 2026-03-31_

---

## Current State (What exists)

| File | What it does |
|------|-------------|
| `web/app/page.js` | Everything: login, map, POI list, filters, create form, POI detail/edit, ACL sharing, photos — one giant component (~700 LOC) |
| `web/app/categories/page.js` | Category admin (create, rename, archive/restore) + public list |
| `web/app/users/page.js` | User admin (create, role/password edit, archive/restore) — duplicates login state |

**Core problems:**
- No shared auth context — every page re-implements `loadStoredAuth` + login form
- No navigation — pages only reachable by URL
- Home page is a monolith mixing map, CRUD, and admin concerns
- No loading/empty/error states for individual sections
- Timestamps exist in DB/API but are never shown in UI

---

## Proposed Screen Map

```
/login                      ← public; redirects to /map if already authenticated
/map                        ← primary screen (public read, auth to write)
/admin/categories           ← admin only
/admin/users                ← admin only
```

### Navigation groups

```
Primary nav (always visible):
  🗺  Map            /map
  (divider — admin only)
  ⚙  Categories     /admin/categories
  👥 Users          /admin/users

Header actions:
  👤 badge: "username (role)"
  ↩  Logout button
```

---

## Screen Specs

### 1. `/login`

**Layout:** Centered card on zinc-950 background.

**Fields:** username, password  
**States:**
- `idle` — form enabled
- `loading` — button spinner, fields disabled
- `error` — ErrorBanner below form (e.g. "Invalid credentials")

**Behaviour:** On success → `router.replace('/map')`. If already authed → immediate redirect.

---

### 2. `/map` (primary screen)

**Layout:** Full-height horizontal split  
- Sidebar: `~35%` width, full height, scrollable  
- Map panel: remaining width, full height

**Sidebar sections (top → bottom):**
1. `FilterBar` — scope toggle (all / mine / shared), category `<Select>`, text search `q`, archived `<Checkbox>`
2. `PoiList` — scrollable list of `PoiCard` rows; skeleton / empty / error states
3. `CreatePoiForm` — collapsible accordion, shown only when authenticated; requires pending pin to submit

**Map panel:**
- react-leaflet + OpenStreetMap tiles
- `PoiMarker` per visible POI → click opens `PoiDetailPanel`
- `PendingPinBanner` — amber callout strip when a pin is placed but not yet saved

**`PoiDetailPanel`** (desktop: right side-panel; mobile: bottom Sheet from shadcn):
- Name, description, category badge, visibility badge (`Public` / `Private` / `Shared`), owner username
- Timestamps: `created_at`, `updated_at` — always shown as `YYYY-MM-DD HH:mm:ss` local via `<Timestamp>`
- Edit mode (name, description, visibility, category) — rendered if `canEdit`
- Photos section: `PhotoGallery` + upload button — rendered if `canEdit`
- Actions: Archive / Restore, ACL Share (`AclSharePanel`)

**States per section:** `loading` (skeleton) | `empty` | `error` | `populated`

---

### 3. `/admin/categories`

**Layout:** Single-column max-w-4xl page under AppShell.

**Sections:**
1. `CategoryForm` — text input + Create button at top
2. `CategoryTable` — sortable table: name, created_at (Timestamp), status badge, actions (Rename inline, Archive, Restore)

**States:** loading skeleton rows | empty state | error banner

---

### 4. `/admin/users`

**Layout:** Single-column max-w-4xl page under AppShell.

**Sections:**
1. `UserForm` — username, password, role select + Create button
2. `UserTable` — table: username, role badge, created_at (Timestamp), status, actions (edit role/password inline, Archive, Restore)

**States:** loading skeleton rows | empty state | error banner

---

## Component Map

```
app/
├── layout.tsx              ← AppShell (AuthProvider, nav, header)
├── login/page.tsx
├── map/page.tsx
├── admin/
│   ├── layout.tsx          ← admin guard (redirect non-admin → /map)
│   ├── categories/page.tsx
│   └── users/page.tsx

components/
├── layout/
│   ├── AppShell.tsx        ← sidebar nav + top header bar
│   ├── NavItem.tsx         ← icon + label, active highlight
│   └── PageHeader.tsx      ← page title + optional action slot
├── auth/
│   ├── AuthProvider.tsx    ← context: user, role, token, login(), logout(), refresh()
│   └── RequireAuth.tsx     ← redirect wrapper (uses useAuth hook)
├── map/
│   ├── PoiMap.tsx          ← react-leaflet wrapper, no SSR (dynamic import)
│   ├── PoiMarker.tsx       ← marker + popup trigger
│   └── PendingPinBanner.tsx← amber callout strip
├── poi/
│   ├── FilterBar.tsx       ← scope, category, search, archived toggle
│   ├── PoiList.tsx         ← virtualized scroll list
│   ├── PoiCard.tsx         ← row: name, category badge, visibility, updated_at
│   ├── PoiDetailPanel.tsx  ← panel/sheet wrapper, loads POI detail on open
│   ├── PoiDetailForm.tsx   ← editable fields inside detail panel
│   ├── CreatePoiForm.tsx   ← collapsible accordion, requires pendingPin
│   ├── PhotoGallery.tsx    ← image grid + upload + archive
│   └── AclSharePanel.tsx   ← share-with-user combobox + share list
├── categories/
│   ├── CategoryTable.tsx
│   └── CategoryForm.tsx
├── users/
│   ├── UserTable.tsx
│   └── UserForm.tsx
└── ui/                     ← shadcn primitives + project-level overrides
    ├── StatusBadge.tsx     ← Public / Private / Shared / Archived variants
    ├── RoleBadge.tsx       ← admin (violet) / user (zinc)
    ├── Timestamp.tsx       ← YYYY-MM-DD HH:mm:ss local — see rule below
    ├── SkeletonRows.tsx    ← n-row table skeleton
    ├── EmptyState.tsx      ← icon + message + optional CTA
    └── ErrorBanner.tsx     ← destructive alert with message
```

### Key state matrix

| Component | loading | empty | error | populated |
|---|---|---|---|---|
| PoiList | SkeletonRows | EmptyState "No POIs match" | ErrorBanner | PoiCard list |
| PoiDetailPanel | Skeleton card | — | ErrorBanner | detail view |
| CategoryTable | SkeletonRows | EmptyState "No categories" | ErrorBanner | rows |
| UserTable | SkeletonRows | EmptyState "No users" | ErrorBanner | rows |
| PhotoGallery | image placeholders | EmptyState "No photos" | ErrorBanner | img grid |

---

## Auth Flow

```
App starts
  ↓
AuthProvider reads localStorage (accessToken, refreshToken, role, username)
  ↓
  ├── has refreshToken but no accessToken → call /auth/refresh silently
  ├── has accessToken → mark authenticated
  └── nothing → mark unauthenticated (map still loads, read-only)

Any 401 response → AuthProvider calls /auth/refresh
  ├── success → retry original request
  └── fail    → logout() → redirect /login
```

---

## Theming / Design Tokens

### Color palette (high-contrast dark)

```css
/* globals.css — HSL variables for shadcn */
--background:    240 10%  4%;   /* #09090b zinc-950 */
--surface:       240  6% 10%;   /* #18181b zinc-900 */
--surface-raised:240  5% 16%;   /* #27272a zinc-800 */
--border:        240  4% 25%;   /* #3f3f46 zinc-700 */
--text-primary:    0  0% 98%;   /* #fafafa zinc-50  */
--text-muted:    240  4% 63%;   /* #a1a1aa zinc-400 */
--accent:        173 80% 40%;   /* #14b8a6 teal-500 */
--accent-hover:  173 80% 36%;   /* #0d9488 teal-600 */
```

```
/* Status badge variants (bg / text) */
Public:   emerald-900 / emerald-200
Private:  zinc-800    / zinc-300
Shared:   blue-900    / blue-200
Mine:     teal-900    / teal-200
Archived: zinc-800    / zinc-400 (italic)
Admin:    violet-900  / violet-200
User:     zinc-800    / zinc-300
```

### Timestamp component rule

```tsx
// components/ui/Timestamp.tsx
// Input: ISO-8601 UTC string from API  (e.g. "2026-03-15T09:22:00Z")
// Output: "YYYY-MM-DD HH:mm:ss" in browser-local time
export function Timestamp({ iso }: { iso: string | null }) {
  if (!iso) return <span className="text-zinc-500">—</span>
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  const s = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ` +
            `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  return <time dateTime={iso} className="font-mono text-xs text-zinc-400">{s}</time>
}
```

### shadcn components to install

```
button, input, textarea, select, badge, card, dialog, sheet,
dropdown-menu, separator, skeleton, label, checkbox, tabs,
table, toast, scroll-area, accordion, collapsible
```

---

## User Flows

### Flow A — View public POIs (unauthenticated)
`/login` redirect skipped (no token) → `/map` loads → `PoiMap` + `FilterBar` + `PoiList` render → click marker → `PoiDetailPanel` opens (read-only, no edit/photo/share actions)

### Flow B — Create POI (authenticated)
`/map` → click map to place pin → `PendingPinBanner` appears → expand `CreatePoiForm` accordion → fill name / description / category / visibility → Save → optimistic add: `PoiMarker` + `PoiCard` appear → banner clears

### Flow C — Edit POI (authenticated, canEdit)
`/map` → click `PoiCard` or `PoiMarker` → `PoiDetailPanel` slides in → click "Edit" → `PoiDetailForm` fields activate → Save → optimistic update, panel stays open

### Flow D — Admin: manage categories
`/admin/categories` → `CategoryForm` → Create → `CategoryTable` row appears → click Rename → inline edit → Save → click Archive → row fades/badge changes → toggle "include archived" → Restore

### Flow E — Admin: manage users
`/admin/users` → `UserForm` → Create → `UserTable` row appears → inline role/password edit → Save → Archive / Restore

---

## Decisions Needed

### D1 — POI Detail: how to show detail on mobile?
1. ✅ **Bottom sheet (shadcn `Sheet`)** — slides up, map stays visible, natural mobile UX
2. Side drawer full-height on all viewports
3. Separate `/poi/[id]` page (navigate away from map)
4. Modal dialog (loses map context)

_Recommendation: **Option 1** — bottom sheet on `sm`, side panel on `md+` via CSS breakpoint. Zero extra deps._

---

### D2 — Navigation style
1. ✅ **Collapsible left sidebar** — icons + labels, collapses to icon-only strip on mobile
2. Top horizontal navbar with dropdown
3. Bottom tab bar (mobile-first, limits desktop density)
4. No persistent nav — breadcrumbs only

_Recommendation: **Option 1** — fits admin tool aesthetic, scales to more routes._

---

### D3 — Map library
1. ✅ **Keep react-leaflet** — already in use, OSM tiles, zero cost, familiar
2. Migrate to MapLibre GL (vector tiles, WebGL, more visual control)
3. Mapbox GL (paid tier required)

_Recommendation: **Option 1** unless vector tile rendering or GL effects are required._

---

### D4 — Client state management
1. ✅ **React Context + SWR** — auth in Context, server data via SWR (caching, revalidation, dedup)
2. React Context + TanStack Query (heavier, more features)
3. Zustand + SWR (adds global store)
4. Keep useState per-page (current, painful)

_Recommendation: **Option 1** — lightest lift, SWR replaces all manual fetch/useEffect patterns._

---

### D5 — TypeScript migration (NEW)
Current pages are `.js`. Modernization requires a decision on scope:
1. ✅ **Migrate to `.tsx` as each file is rewritten** — incremental, no flag day
2. Full flag-day migration before starting UI work
3. Keep `.js` throughout (no type safety)

_Recommendation: **Option 1** — convert file-by-file as part of the component build._

