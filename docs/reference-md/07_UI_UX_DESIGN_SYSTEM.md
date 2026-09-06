# ProjectAssure - UI/UX Design System & Component Library

> **Document role:** single source of truth for every visual, spatial, and motion decision in ProjectAssure. If a value appears here, it is the value in the code.

| Field | Value |
|-------|-------|
| Project | ProjectAssure |
| Hackathon | Smart India Hackathon 2026 - Problem Statement ID SIH26103 |
| Theme / Category | Smart Automation / Software |
| Organisation | MoSPI (Ministry of Statistics and Programme Implementation) |
| Team | Amrita Vishwa Vidyapeetham, Chennai Campus |
| Frontend stack | Next.js 15 App Router, TypeScript, Tailwind CSS 4 (`@theme` tokens), shadcn/ui on Radix primitives, Framer Motion 11, React Query + Zustand, Recharts + D3.js, @dnd-kit (kanban) |
| Product surfaces | Main app, analytics.projectassure.vercel.app, ai.projectassure.vercel.app |
| Roles | ADMIN, PROJECT_MANAGER, STAKEHOLDER, VIEWER |
| Quality bar | WCAG 2.1 AA, dark/light theme, fully responsive, installable PWA for field officers |

ProjectAssure gives MoSPI officials a live, colour-coded picture of every scheme and project they own. This document defines how that picture looks and behaves: Part A fixes the principles, Part B the complete token system, Part C the component inventory, Part D the page-by-page blueprints, Part E the motion system, Part F the dashboard information hierarchy, Part G accessibility, Part H responsiveness, Part I UI states, and Part J the rehearsed demo moments for the SIH 2026 jury.

---

## PART A - Design Principles

ProjectAssure is judged by senior government users within seconds of loading. Every principle below exists to survive that scrutiny.

### In Plain English
> These principles are the house rules of a five-star hotel: the guest (a ministry official) never sees the rules, but every staff member (every screen, button, and chart) follows them so the whole stay feels effortless and trustworthy.

### A.1 Principle Matrix

| Principle | Description | Implementation |
|-----------|-------------|----------------|
| **Clarity** | Every element has a clear purpose. No ambiguity. | Consistent labels, tooltips, empty states |
| **Efficiency** | Senior officials can assess portfolio health in under 30 seconds | Executive dashboard with KPI cards, colour-coded health |
| **Accessibility** | WCAG 2.1 AA compliant | Sufficient contrast, keyboard navigation, screen reader support |
| **Responsiveness** | Works on desktop, tablet, and mobile | Tailwind responsive breakpoints, mobile-first design |
| **Trust** | Government-grade professionalism | Muted colour palette, institutional design language |

To these five we add two operational principles the team must honour during development:

| Principle | Description | Implementation |
|-----------|-------------|----------------|
| **Consistency** | The same object looks and behaves identically everywhere | All three domains import tokens and components from one shared `ui` layer; no one-off hex codes or ad-hoc paddings |
| **Feedback** | No click is ever silent | Optimistic UI, skeletons within 100 ms, toasts on completion, shake on invalid input |

### A.2 What Each Principle Means On Screen

**1. Clarity - what this means on screen**
- One card equals one idea. A KPI card shows a label, a number, and a trend chip - nothing else competes for attention.
- Every icon is paired with a text label; icon-only actions get tooltips and `aria-label`s.
- Example: on the Project Detail page the four health cards read "Schedule 82", "Budget 74", "Resources 91", "Milestones 68" - a first-time visitor can explain what the screen says after three seconds.

**2. Efficiency - what this means on screen**
- The dashboard is ordered for scanning, not reading: KPI row answers "how many", the health donut and budget gauge answer "in what proportion", the alerts panel answers "what needs action now", and the ranking table answers "which projects first".
- Common destinations are never more than one click from the dashboard; the command palette (`Ctrl/Cmd + K`) reaches any project in two keystrokes.
- Example: a Joint Secretary opens the dashboard between meetings, sees 74 on-track / 31 at-risk / 23 delayed, taps the red alert, and is standing on the offending project in under 15 seconds.

**3. Accessibility - what this means on screen**
- Contrast, keyboard, screen reader, and reduced-motion support are designed in, not bolted on (full specification in Part G).
- Health colours are never the only signal: every colour is paired with a text label and a shape (dot + label + badge), so colour-blind users lose no information.
- Example: a field officer on a low-end Android phone in bright sunlight still reads the dashboard because text tokens clear 4.5:1 contrast and touch targets are at least 44 px.

**4. Responsiveness - what this means on screen**
- Mobile-first CSS: the base layout is a single column that gains complexity at `sm`, `md`, `lg`, `xl`, and `2xl` (strategy in Part H).
- Tables become stacked cards on small screens; the sidebar becomes a drawer; charts keep aspect ratios instead of overflowing their containers.
- Example: the Projects DataTable renders as a filterable card list on a phone while preserving search, sort, and pagination.

**5. Trust - what this means on screen**
- The palette is institutional: deep blue `#0b426e` for authority, restrained accent use, no marketing gradients or playful illustrations inside data areas.
- Numbers are never rounded away: budget figures show exact values with tabular numerals, and every AI statement cites the data sources behind it.
- Example: every page footer carries "Ministry of Statistics and Programme Implementation" branding, and every destructive action asks for explicit confirmation.

**6. Consistency - what this means on screen**
- Buttons, badges, and spacing are identical across the main app, the analytics subdomain, and the AI subdomain because they all ship from one component library.
- Example: the "Export" button is `variant="outline"` with a download icon in all three domains - a user never has to relearn the interface.

**7. Feedback - what this means on screen**
- Every interaction acknowledges within 100 ms: buttons depress, rows highlight, skeletons appear, toasts confirm completion.
- Example: submitting the Create Project form disables the button, shows a spinner, and lands on the new Project Detail page with a success toast - the user is never left guessing whether the click registered.

### A.3 Principle Precedence When They Collide

When principles conflict, this is the order of precedence: **Accessibility > Clarity > Trust > Efficiency > Feedback > Responsiveness > Aesthetics**. Concrete example: we ship the plainer chart whose labels clear 4.5:1 contrast rather than the prettier chart whose labels sit at 3:1. A second example: a dense 12-column table loses columns (Responsiveness) before it loses contrast or labels (Accessibility, Clarity).

## PART B - Complete Design Tokens

### In Plain English
> Tokens are the labelled pantry of a professional kitchen. Every chef (component) pulls "olive oil", "salt", "pepper" - never "that bottle from the top shelf". Change one jar and every dish updates: rename `--color-primary-500` once and forty components follow.

### B.1 Colour System (Tailwind CSS 4)

```css
/* globals.css */
@theme {
  --color-primary-50: #f0f7ff;
  --color-primary-100: #e0effe;
  --color-primary-200: #bae0fd;
  --color-primary-300: #7cc8fb;
  --color-primary-400: #36adf6;
  --color-primary-500: #0c93e7;
  --color-primary-600: #0074c5;
  --color-primary-700: #015ca0;
  --color-primary-800: #064f85;
  --color-primary-900: #0b426e;
  --color-primary-950: #072b49;

  --color-health-healthy: #22c55e;   /* Green */
  --color-health-at-risk: #f59e0b;  /* Amber */
  --color-health-critical: #ef4444; /* Red */

  --color-surface: #ffffff;
  --color-surface-elevated: #f8fafc;
  --color-surface-muted: #f1f5f9;
  --color-border: #e2e8f0;
  --color-text-primary: #0f172a;
  --color-text-secondary: #64748b;
  --color-text-muted: #94a3b8;
}
```

Reading the ramp: `primary-500` (#0c93e7) is the interactive workhorse - buttons, links, active nav, focus rings. `primary-900` (#0b426e) is the authority tone - sidebar, header accents, deep chart series. Steps 50-200 paint soft washes and selected states; 600-800 serve hovers and pressed states; 950 is reserved for the dark theme canvas. The three health colours are domain semantics, not decoration: green means HEALTHY, amber means AT_RISK, red means CRITICAL - nowhere else in the product may those hues carry a different meaning.

### B.2 Semantic and Status Tokens (additive layer)

```css
/* globals.css - semantic layer on top of the base palette */
@theme {
  /* Feedback pairings: soft background + accessible text colour */
  --color-success: #22c55e;
  --color-success-soft: #dcfce7;
  --color-success-text: #15803d;

  --color-warning: #f59e0b;
  --color-warning-soft: #fef3c7;
  --color-warning-text: #b45309;

  --color-danger: #ef4444;
  --color-danger-soft: #fee2e2;
  --color-danger-text: #b91c1c;

  --color-info: #0c93e7;
  --color-info-soft: #e0effe;
  --color-info-text: #015ca0;

  /* Chart categorical palette (Recharts + D3), colour-blind-safe order */
  --color-chart-1: #0c93e7;
  --color-chart-2: #0b426e;
  --color-chart-3: #22c55e;
  --color-chart-4: #f59e0b;
  --color-chart-5: #8b5cf6;
  --color-chart-6: #14b8a6;

  /* Focus ring */
  --color-ring: #0c93e7;
}
```

The `-text` variants exist because the raw health colours fail contrast on white when used as text (verified in Part G). Badges and labels always pair a `-text` colour with its `-soft` background: `bg-warning-soft text-warning-text`, never raw amber on white.

### B.3 Colour Usage Rules

| Token | Use for | Never use for |
|-------|---------|---------------|
| `primary-50..200` | Selected rows, hover washes, soft chips | Body text or borders |
| `primary-500` | Primary buttons, links, active nav, focus ring | Flat fills under small white text (contrast limit, see Part G) |
| `primary-600..800` | Button hover/active, link hover | Long-form body text |
| `primary-900..950` | Sidebar, header accents, deep chart series | Page backgrounds in light theme |
| `health-healthy / at-risk / critical` | Health dots, ring strokes, health badges, health chart series | Text on white (use `-text` variants); decoration on unrelated UI |
| `success / warning / danger + softs` | Toasts, banners, form validation, system messages | Project health encoding (reserved for the health trio) |
| `surface / elevated / muted` | Page canvas, cards, wells and table stripes | Saturation or tinting |
| `border` | All 1px dividers, card outlines | Any divider thicker than 1px except the 2px focus ring |
| `text-primary` | Headings, body, key figures | Text on saturated backgrounds (use white there) |
| `text-secondary` | Labels, secondary copy, table meta | Long paragraphs over 3 lines (switch to `text-primary`) |
| `text-muted` | Placeholders, timestamps, decorative hints | Information required to complete a task |

Two global rules complete the system. First, the **60-30-10 rule**: roughly 60% of any screen is surface neutrals, 30% structure (borders, secondary text, muted fills), and only 10% carries the primary blue and health accents - this keeps the accent colour loud enough to mean something. Second, **"red is sacred"**: red appears only for CRITICAL health, destructive actions, and errors. If red is used for styling, it stops functioning as a warning.

### B.4 Typography Scale

| Token | Size | Weight | Usage |
|-------|------|--------|-------|
| `text-display` | 48px / 3rem | Bold (700) | Dashboard page titles |
| `text-h1` | 30px / 1.875rem | Bold (700) | Section headings |
| `text-h2` | 24px / 1.5rem | Semibold (600) | Subsection headings |
| `text-h3` | 20px / 1.25rem | Semibold (600) | Card titles |
| `text-body` | 14px / 0.875rem | Regular (400) | Body text |
| `text-caption` | 12px / 0.75rem | Regular (400) | Labels, captions |
| `text-overline` | 11px / 0.6875rem | Medium (500) | Overline text (uppercase, tracked) |

Extended specification with the missing values developers need:

| Token | Size | Weight | Line height | Letter spacing | Case | Example on screen |
|-------|------|--------|-------------|----------------|------|-------------------|
| `text-display` | 48px | 700 | 1.1 | -0.02em | Sentence | Dashboard greeting "Good morning, Secretary" |
| `text-h1` | 30px | 700 | 1.2 | -0.01em | Sentence | Page title "Executive Dashboard" |
| `text-h2` | 24px | 600 | 1.25 | 0 | Sentence | Panel heading "Health Distribution" |
| `text-h3` | 20px | 600 | 1.3 | 0 | Sentence | Card title "Critical Alerts" |
| `text-body` | 14px | 400 | 1.5 | 0 | Sentence | Table cells, descriptions |
| `text-small` (added) | 13px | 400 | 1.45 | 0 | Sentence | Dense table meta, helper text |
| `text-caption` | 12px | 400 | 1.4 | 0.01em | Sentence | Badge text, chart axis labels |
| `text-overline` | 11px | 500 | 1.2 | 0.08em | UPPERCASE | KPI card label "TOTAL PROJECTS" |

Additional typographic rules: all KPI numbers and money figures use `font-variant-numeric: tabular-nums` so digits align vertically in tables; the font stack is declared once in tokens; no more than two font weights per screen region; body line length never exceeds 75 characters; text is never justified.

```css
@theme {
  --font-sans: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --font-mono: ui-monospace, "JetBrains Mono", "SFMono-Regular", Menlo, monospace;
}
```

### B.5 Spacing System

Tailwind's default spacing scale (4px base unit):
- `space-1` = 4px, `space-2` = 8px, `space-3` = 12px, `space-4` = 16px
- `space-6` = 24px, `space-8` = 32px, `space-12` = 48px
- Components use 8px grid internally, 24px between cards

The complete scale with usage decisions:

| Token | px | Tailwind | Primary usage |
|-------|----|----------|---------------|
| `space-1` | 4 | `p-1`, `gap-1` | Icon-to-label gaps, badge padding, optical corrections |
| `space-2` | 8 | `p-2`, `gap-2` | Chip padding, dense table cell padding |
| `space-3` | 12 | `p-3`, `gap-3` | Input padding, compact cards |
| `space-4` | 16 | `p-4`, `gap-4` | Default card padding, form row rhythm, grid gutter |
| `space-6` | 24 | `p-6`, `gap-6` | Standard card padding, gap between cards |
| `space-8` | 32 | `p-8`, `gap-8` | Between dashboard sections |
| `space-12` | 48 | `p-12`, `gap-12` | Hero areas, page title breathing room |
| `space-16` | 64 | `p-16`, `gap-16` | Auth pages, empty-state vertical rhythm |

Rhythm rules: the 8px grid governs everything inside components; 4px steps are allowed only for icon/optical alignment. Page gutters are 24px on desktop and 16px on mobile. Vertical rhythm between major dashboard sections is 32px. Form rows sit 16px apart; related fields (city/state) may tighten to 8px.

### B.6 Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `rounded-sm` | 4px | Tags, badges |
| `rounded-md` | 6px | Buttons, inputs |
| `rounded-lg` | 8px | Cards |
| `rounded-xl` | 12px | Modals, panels |
| `rounded-2xl` | 16px | Large containers |
| `rounded-full` | 9999px | Avatars, status dots |

Radius hierarchy rule: a nested element's radius is its parent's radius minus 4px (a 4px-radius button inside an 8px card looks deliberately nested, not accidental). Data-dense surfaces (tables, kanban columns) never exceed `rounded-lg`; only floating containers (dialogs, the AI chat panel) earn `rounded-xl`.

### B.7 Elevation and Shadow Levels

| Level | Value | Usage |
|-------|-------|-------|
| `shadow-xs` | `0 1px 2px 0 rgb(15 23 42 / 0.05)` | Inputs, sticky table headers |
| `shadow-sm` | `0 1px 3px 0 rgb(15 23 42 / 0.08), 0 1px 2px -1px rgb(15 23 42 / 0.06)` | Resting cards, StatCard, DataTable container |
| `shadow-md` | `0 4px 6px -1px rgb(15 23 42 / 0.08), 0 2px 4px -2px rgb(15 23 42 / 0.06)` | Card hover, dropdowns |
| `shadow-lg` | `0 10px 15px -3px rgb(15 23 42 / 0.10), 0 4px 6px -4px rgb(15 23 42 / 0.06)` | Popovers, command palette |
| `shadow-xl` | `0 20px 25px -5px rgb(15 23 42 / 0.12), 0 8px 10px -6px rgb(15 23 42 / 0.06)` | Dialogs, AI chat panel, dragging kanban card |
| `shadow-none` | none | Embedded wells, skeletons, print styles |

Dark theme rule: shadows are replaced by 1px borders (`#1e293b`) and surface lightening - on dark surfaces elevation reads as brightness, not blur. Shadow colour is always slate-based (`15 23 42`), never pure black.

### B.8 Z-Index Layer Registry

| Layer | Value | Contents |
|-------|-------|----------|
| `z-0` (base) | 0 | Page content, charts, tables |
| `z-10` (raised) | 10 | Card hover elevations, sticky table headers |
| `z-20` (dropdown) | 20 | Selects, popovers, tooltips |
| `z-30` (sticky) | 30 | App header, icon rail on scroll |
| `z-40` (drawer) | 40 | Mobile sidebar drawer, AI chat panel |
| `z-50` (overlay) | 50 | Dialog backdrops |
| `z-60` (modal) | 60 | Dialog content |
| `z-70` (toast) | 70 | Sonner toasts, live alert toasts |

Layers are imported from `lib/z-index.ts` - raw numeric z-index values in component files fail code review.

### B.9 Motion Durations and Easings

| Token | Duration | Easing | Usage |
|-------|----------|--------|-------|
| `duration-instant` | 100ms | linear | Hover colour changes, opacity blips |
| `duration-fast` | 150ms | ease-out | Button press, tooltip entrance |
| `duration-base` | 200ms | ease-out | Dropdowns, accordions, tab underlines |
| `duration-slow` | 300ms | ease-out | Page transitions, dialog enter |
| `duration-slower` | 500ms | ease-out | Chart reveals, first-load hero entrance |
| `ease-out-expo` | - | `cubic-bezier(0.16, 1, 0.3, 1)` | Counters, ring sweeps - fast start, gentle landing |
| `spring-gentle` | - | stiffness 200, damping 25 | Health ring scale-in, card pop |
| `spring-snappy` | - | stiffness 300, damping 25 | Alert slide-in, kanban drag snap |

Every animated value is interruptible (Framer Motion springs and `AnimatePresence`), and every animation collapses under `prefers-reduced-motion` (Part E.9).

### B.10 Dark/Light Theme

```tsx
// components/theme-provider.tsx
import { ThemeProvider as NextThemesProvider } from 'next-themes';

export function ThemeProvider({ children }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="light">
      {children}
    </NextThemesProvider>
  );
}
```

Both themes use the same design tokens, with light/dark variants. Token mapping:

| Token | Light value | Dark value |
|-------|-------------|------------|
| `surface` | #ffffff | #0f172a |
| `surface-elevated` | #f8fafc | #1e293b |
| `surface-muted` | #f1f5f9 | #334155 |
| `border` | #e2e8f0 | #1e293b |
| `text-primary` | #0f172a | #f1f5f9 |
| `text-secondary` | #64748b | #94a3b8 |
| `text-muted` | #94a3b8 | #64748b |
| `primary-500` | #0c93e7 | #36adf6 (lifted one step for contrast) |
| health trio | base hues | lightened 8-10%; soft variants become 12-15% alpha washes |

Implementation rules: `attribute="class"` with `defaultTheme="light"` and `suppressHydrationWarning` on `<html>`; charts read CSS variables at render so a theme switch re-keys Recharts to re-colour; pure black `#000000` is banned as a background; the theme choice persists to `localStorage` and respects `prefers-color-scheme` when set to "system".

## PART C - Component Library Inventory

### In Plain English
> Think LEGO. shadcn/ui hands us the standard bricks every builder knows how to snap together. Our custom components are the specialised pieces - the cockpit, the crane, the spinning radar - engineered for this one castle: monitoring government projects.

### C.1 Foundation

All components are built on **shadcn/ui** (which provides the Radix UI primitives) and extended with custom components specific to ProjectAssure. shadcn primitives live in `components/ui/*`, ProjectAssure originals in `components/custom/*`. Every component is TypeScript-typed, forwards refs, and accepts `className` for token-based overrides; inline styles are permitted only for dynamic chart colours.

### C.2 shadcn/ui Base Inventory

| Component | Purpose in ProjectAssure | Variants | States |
|-----------|--------------------------|----------|--------|
| Button | Every action | primary, outline, ghost, destructive, link, icon | default, hover, focus-visible, loading, disabled |
| Input | Forms, search | text, email, password, search, with-icon | default, focus, error, disabled, read-only |
| Textarea | Descriptions, AI feedback | auto-grow | default, error, disabled |
| Select | Department, role, filters | single, with search | open, empty, error |
| Checkbox | Filters, bulk select, remember me | default, indeterminate | checked, unchecked, disabled |
| RadioGroup | Export format, density | horizontal, vertical | checked, disabled |
| Switch | Theme, notifications, thresholds | sm, md | on, off, disabled |
| Slider | Admin health thresholds | single, range | active, disabled |
| Card | Every container | flat, elevated, interactive | hover, selected |
| Badge | Status, health, counts | default, secondary, outline, health (success/warning/danger) | static |
| Avatar | Profile, user tables | sm, md, lg, initials fallback, presence dot | loaded, error, loading |
| Tabs | Project Detail sections, settings | line, pill | active, hover, disabled |
| Dialog | Create/edit, preview, confirmations | sm, md, lg | open, closing |
| AlertDialog | Destructive confirmations | destructive | open |
| Sheet | Mobile sidebar, AI chat panel | left, right | open, closed |
| Drawer | Filters on mobile | bottom | open, closed |
| Popover | Date pickers, column config | anchored | open, closed |
| Tooltip | Icon hints | dark, light | delayed show, instant hide |
| Dropdown Menu | Row actions, profile menu | with icons, with shortcuts | open, closed |
| Command | Global palette (`Ctrl/Cmd + K`) | grouped, with icons | loading, empty, filtered |
| Table primitives | DataTable base | sticky header, sortable | loading (skeleton rows), empty, error |
| Progress | Budget bars, upload progress | linear thin, thick | determinate, indeterminate |
| Skeleton | Loading placeholders | text, card, chart, row | shimmering |
| Sonner toast | Action feedback, live alerts | success, error, warning, info | stacked, swipe dismiss |
| Breadcrumb | Deep navigation (Project Detail) | with collapse | static |
| Separator | Section dividers | horizontal, vertical | static |
| ScrollArea | AI panel, kanban columns, alerts | thin scrollbar | static |
| Form (react-hook-form) | All forms | label, description, error wiring | valid, error, submitting |

### C.3 Custom ProjectAssure Components

| Component | Purpose | Variants | States |
|-----------|---------|----------|--------|
| HealthScoreCard | One project's composite health at a glance | light, tinted | loading, error, animating |
| HealthScoreRing | Animated SVG donut of a 0-100 score | sm 48px, md 80px, lg 120px | idle, sweeping, reduced-motion static |
| StatCard | Dashboard KPI summary | default, delta, clickable | hover, selected, loading |
| KpiDeltaChip | Trend vs last month | up, down, flat | positive, negative, neutral |
| BudgetGauge | Radial budget utilisation with target marker | with/without overrun marker | animating, idle |
| HealthDonut | Portfolio distribution donut | legend right, legend bottom | hover segment, focusable slices |
| AlertBanner | Page-level system notices | info, warning, danger, success | dismissible, sticky |
| AlertToast | Live incoming alert toast | health-coloured | slide-in, auto-dismiss 8s, action row |
| AlertsPanel | Dashboard critical alert list | compact, full | empty, loading, overflowing |
| RankingTable | Projects ranked by health movement | sortable columns | loading, sorted asc/desc |
| DataTable | Projects list workhorse | density compact/comfortable | loading, empty, error, rows selected |
| FilterBar | Search + filter chips + saved views | horizontal, wrapping | active chips, cleared |
| GanttTimeline | D3 task timeline with dependencies | zoom day/week/month, today marker | hover task, drag handle (PM only) |
| MilestoneList | Milestone checklist with dates | with status dots | overdue emphasis, completed |
| BudgetChart | Stacked allocation + burn line | monthly, cumulative | legend toggle, hover crosshair |
| ResourceAllocationTable | People vs projects utilisation | heat cells | over-allocation highlight |
| MultiStepForm | Create Project wizard | 5 steps | per-step validation, autosaving, review |
| FileUploader | Document vault uploads | drag-drop zone, button | uploading %, error, scan pending |
| DocumentVault | Project documents list | grid, list | downloading, deleted |
| KanbanBoard | Task board | 4 columns (Backlog, In Progress, Blocked, Done) | dragging, drop indicator, column at WIP limit |
| KanbanCard | Draggable task | priority stripe, assignee | dragging (lifted + shadow), blocked |
| AiChatPanel | Slide-in AI assistant | docked right, floating launcher | closed, open, streaming, error |
| TypingIndicator | AI thinking signal | 3-dot pulse | pulsing |
| QuickActionChips | Suggested AI prompts | per context (project vs portfolio) | hover, disabled |
| CitationChip | AI source reference | gantt, milestone, budget sources | hover preview |
| ExportDialog | PDF/Excel export builder | format + scope selection | preparing (progress), done, failed |
| CommandPalette (PA skin) | Global nav and search | projects, actions, domains | recents, empty |
| ThemeToggle | Light/dark/system | icon button | cycling |
| RoleGate | Conditional UI by role | wrapper (hide vs disable) | permitted, blocked |
| OfflineBanner | PWA offline notice | top strip | offline, reconnecting, queued count |
| InstallPwaPrompt | Field-officer install card | bottom sheet | accepted, dismissed |
| DomainSwitcher | Jump between the 3 domains | dropdown | current marked |
| PageHeader | Title + actions + breadcrumb | with/without filter slot | static |
| StepperIndicator | Multi-step progress | numbered, back-clickable | current, complete, error |

### C.4 Health Score Card (reference implementation)

```tsx
// components/health-score-card.tsx
import { Card, CardContent } from '@/components/ui/card';
import { motion } from 'framer-motion';

interface HealthScoreCardProps {
  score: number; // 0-100
  category: 'HEALTHY' | 'AT_RISK' | 'CRITICAL';
  projectName: string;
}

export function HealthScoreCard({ score, category, projectName }: HealthScoreCardProps) {
  const color = {
    HEALTHY: 'text-health-healthy',
    AT_RISK: 'text-health-at-risk',
    CRITICAL: 'text-health-critical',
  }[category];

  const bgColor = {
    HEALTHY: 'bg-health-healthy/10',
    AT_RISK: 'bg-health-at-risk/10',
    CRITICAL: 'bg-health-critical/10',
  }[category];

  return (
    <Card className={bgColor}>
      <CardContent className="p-6">
        <p className="text-caption text-text-secondary">{projectName}</p>
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200 }}
          className={`text-display ${color}`}
        >
          {Math.round(score)}
        </motion.div>
        <Badge variant={category.toLowerCase()}>{category.replace('_', ' ')}</Badge>
      </CardContent>
    </Card>
  );
}
```

### C.5 Project Status Table (column specification)

| Column | Content | Width |
|--------|---------|-------|
| Project | Name + department badge | 30% |
| Health | Circular progress + score | 15% |
| Progress | Linear progress bar | 15% |
| Budget | Spent/Total with mini bar | 15% |
| Status | Badge (On Track / Delayed / At Risk) | 10% |
| Target Date | Formatted date | 10% |
| Actions | Menu (View, Edit, Predict) | 5% |

### C.6 Component State Matrix

| State | Visual rule | Motion |
|-------|-------------|--------|
| Hover | 4% primary wash; interactive cards lift to `shadow-md` | 100ms |
| Focus-visible | 2px ring in `--color-ring`, 2px offset; never removed | instant |
| Active/pressed | `scale(0.98)` on buttons | 100ms |
| Disabled | 40% opacity, `cursor-not-allowed`, no hover wash | instant |
| Loading | Skeleton mirrors final layout; buttons keep label + spinner | shimmer loop |
| Error | danger border + message below field, `aria-describedby` linked | shake 200ms on submit |
| Selected | `primary-50` background + 2px left border in `primary-500` | 150ms |
| Empty | icon + one-line cause + one action (Part I) | fade in |

### C.7 Composition Rules

- Pages compose zones from components; components never fetch data themselves (React Query lives in hooks, Zustand holds UI state only).
- A component may not hardcode a hex, shadow, z-index, or duration - only tokens.
- Variant explosion is banned: if a component needs more than four variants, it becomes two components.
- Every custom component ships with its loading and error story before its success story in code review.

## PART D - Page Blueprints (All 9 Pages)

### In Plain English
> Each blueprint is the floor plan of a room in a government office: the door (entry point), the reception (header), the filing cabinets (data zones), and the exit signs (actions). Anyone can walk the room without a guide - which is exactly what a jury member will do.

Every blueprint below follows the same contract: ASCII wireframe, zone-by-zone explanation, component list drawn from Part C, and the key interactions.

### D.1 Login / Register

Design intent (from the original spec):
- Clean, centered card with ProjectAssure logo
- Email + Password fields with validation
- "Government of India" branding footer
- Animated background gradient (subtle)

```
┌────────────────────────────────────────────────────────────┐
│  (subtle animated blue gradient backdrop, 8s loop)         │
│                                                            │
│                   ┌──────────────────────────┐             │
│                   │   [ProjectAssure logo]   │             │
│                   │   Ministry-grade access  │             │
│                   │                          │             │
│                   │   Email                  │             │
│                   │   [___________________]  │             │
│                   │   Password               │             │
│                   │   [___________________]  │             │
│                   │   [x] Remember me        │             │
│                   │   [      Sign In       ] │             │
│                   │   ───────── or ───────── │             │
│                   │   [ Continue with SSO ]  │             │
│                   │   New here? Register     │             │
│                   └──────────────────────────┘             │
│                                                            │
│  Government of India | MoSPI | SIH 2026 footer strip       │
└────────────────────────────────────────────────────────────┘
```

| Zone | Contents | Components |
|------|----------|------------|
| Backdrop | Subtle gradient drift, static under reduced motion | CSS keyframes |
| Auth card | Logo, Tabbed Sign In / Register, credential fields, submit | Card, Tabs, Input, Form, Button, Checkbox, Separator |
| Footer strip | Government of India branding, SIH 2026 mark | static layout |

Key interactions: inline validation on blur (email format, password length); submit shows spinner then redirects by role (ADMIN/PM/STAKEHOLDER/VIEWER all land on Executive Dashboard with role-scoped data); failed sign-in shakes the card and shows a single non-specific error; the Register tab reuses the card with name + department + role-request fields; a "Demo credentials" chip is available on the SIH demo build only.

### D.2 Executive Dashboard

```
┌─────────────────────────────────────────────────────────┐
│ Header: Logo | Search | Notifications | Profile        │
├─────────────────────────────────────────────────────────┤
│ Sidebar:                                                │
│  Dashboard (active)                                     │
│  Projects                                               │
│  Analytics                                              │
│  AI Assistant                                           │
│  Reports                                                │
│  Settings                                               │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  KPI Cards Row:                                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │ Total    │ │ On Track │ │ At Risk  │ │ Delayed  │   │
│  │ Projects │ │    74    │ │    31    │ │    23    │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │
│                                                         │
│  ┌────────────────────┐ ┌────────────────────────────┐ │
│  │ Health Distribution │ │ Budget Utilisation Gauge  │ │
│  │ (Donut Chart)       │ │ (Radial Chart)            │ │
│  └────────────────────┘ └────────────────────────────┘ │
│                                                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │ Critical Alerts Panel                              │   │
│  │ (List of latest high-priority alerts)             │   │
│  └──────────────────────────────────────────────────┘   │
│                                                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │ Project Ranking Table (sorted by health score)    │   │
│  └──────────────────────────────────────────────────┘   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

Design intent (from the original spec):
- 4 KPI cards at the top (Total, On Track, At Risk, Delayed)
- Health distribution donut chart + Budget gauge side by side
- Critical alerts panel
- Project ranking table (sortable by health, progress, budget)
- Filter bar (department, status, health, search)

| Zone | Contents | Components |
|------|----------|------------|
| Header | Logo, global search (opens palette), alert bell with badge, profile menu | Avatar, Dropdown Menu, Badge |
| Sidebar | 6 nav items, active state in primary-900 tint | Sheet (mobile), RoleGate on Settings |
| Page header | Greeting (display), date, department FilterBar | FilterBar, PageHeader |
| KPI row | 4 StatCards: Total, On Track, At Risk, Delayed with deltas | StatCard, KpiDeltaChip |
| Charts row | Health donut (left, 2/5) + budget gauge (right, 3/5) | HealthDonut, BudgetGauge |
| Alerts | Latest high-priority alerts, worst first, max 5 visible | AlertsPanel |
| Ranking | Sortable table by health, progress, budget | RankingTable |

Key interactions: every glance-level element is clickable (KPI → filtered Projects list, donut segment → filtered list, alert row → Project Detail, ranking row → Project Detail); React Query refetches every 30 seconds with a subtle "Updated x s ago" stamp; `Ctrl/Cmd + K` opens the command palette; the AI Assistant sidebar item opens the AiChatPanel in portfolio context; alerts arrive live via websocket and also raise AlertToasts (Part J, moment 3).

### D.3 Projects List (DataTable)

```
┌────────────────────────────────────────────────────────────┐
│ Header: Logo | Search | Notifications | Profile            │
├──────────┬─────────────────────────────────────────────────┤
│ Sidebar  │ Projects                        [+ New Project] │
│ Projects*│ ┌─────────────────────────────────────────────┐ │
│          │ │ [Department v] [Health v] [Status v]        │ │
│          │ │ [Search___________] [Export v] [View: Table]│ │
│          │ └─────────────────────────────────────────────┘ │
│          │ ┌─────────────────────────────────────────────┐ │
│          │ │ Project | Health | Progress | Budget | Menu │ │
│          │ │ ░░░░░░░  (8 skeleton rows while loading)    │ │
│          │ │ row: name + dept badge, ring 82, bar 64%,   │ │
│          │ │      spent/total, status badge, row menu    │ │
│          │ └─────────────────────────────────────────────┘ │
│          │ Pagination: ‹ 1 2 3 … 12 ›     118 projects     │
└──────────┴─────────────────────────────────────────────────┘
```

| Zone | Contents | Components |
|------|----------|------------|
| Toolbar | PageHeader + New Project (PM and above), FilterBar with saved views, export menu | PageHeader, FilterBar, ExportDialog |
| Table | 7-column spec from C.5, sortable headers, sticky header on scroll | DataTable, Badge, HealthScoreRing (sm) |
| Footer | Pagination, result count, density toggle | DataTable primitives |

Key interactions: sort toggles with `aria-sort`; search debounced 300 ms; active filters render as removable chips; row click navigates to Project Detail; row menu exposes View / Edit (PM+) / Run AI prediction; Export offers PDF and Excel scoped to current filters; on mobile the table switches to stacked cards preserving filter, sort, and pagination.

### D.4 Create Project (Multi-Step Form)

```
┌────────────────────────────────────────────────────────────┐
│  Step indicator: ①Basics ─ ②Timeline ─ ③Budget ─           │
│                  ④Resources ─ ⑤Review                      │
├────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Step 1 - Basics                                      │  │
│  │   Project name*  [____________________________]      │  │
│  │   Department*    [Select department          v]      │  │
│  │   Scheme code    [____________________________]      │  │
│  │   Description    [____________________________]      │  │
│  └──────────────────────────────────────────────────────┘  │
│                          [Back]  [Continue]                │
└────────────────────────────────────────────────────────────┘
```

| Step | Fields | Validation |
|------|--------|------------|
| 1 Basics | name, department, scheme code, description | required name/department, unique name |
| 2 Timeline | start, target end, milestone rows (name + date) | end after start, milestones inside window |
| 3 Budget | total allocation, category splits, monthly phasing | splits sum to total |
| 4 Resources | PM, team members, stakeholder list | valid users, no duplicate PM |
| 5 Review | read-only summary + "Create project" | all steps valid |

Components: StepperIndicator, MultiStepForm, Input, Select, DatePicker (Popover), MilestoneList (editable), ResourceAllocationTable (editable), Button.

Key interactions: per-step validation on Continue (never blocks Back); autosave draft to Zustand + localStorage with a "Draft saved" whisper; stepper chips are clickable for completed steps; the review step summarises every value and flags conflicts; on submit the button shows a spinner and success routes to the new Project Detail page with a toast "Project created - health engine initialised"; an AI prefill suggestion (from past similar projects) appears as an optional chip on steps 2-4.

### D.5 Project Detail

Design intent (from the original spec):
- Project header with name, department, status badge
- 4 health dimension cards (Schedule, Budget, Resources, Milestones)
- Gantt chart timeline
- Milestone list with status indicators
- Budget breakdown chart
- Resource allocation table
- Latest AI predictions
- Alert history
- Document uploads
- AI chat panel (slide-in from right)

```
┌────────────────────────────────────────────────────────────┐
│ ← Projects | Project name [AT RISK] | Dept badge | ⋯ Menu  │
├──────────┬─────────────────────────────────────────────────┤
│ Sidebar  │ ┌Schedule┐ ┌Budget┐ ┌Resources┐ ┌Milestones┐   │
│          │ │  82    │ │  74  │ │   91    │ │   68     │   │
│          │ └────────┘ └──────┘ └─────────┘ └──────────┘   │
│          │ ┌────────────────────────┐ ┌────────────────┐ │
│          │ │ GanttTimeline          │ │ AI prediction  │ │
│          │ │ tasks, deps, today line│ │ summary card   │ │
│          │ └────────────────────────┘ └────────────────┘ │
│          │ Tabs: [Milestones][Budget][Resources][Docs]    │
│          │  - MilestoneList with status dots              │
│          │  - BudgetChart (stacked + burn line)           │
│          │  - ResourceAllocationTable                     │
│          │  - DocumentVault + FileUploader                │
│          │ Alert history feed (bottom)                    │
└──────────┴─────────────────────────────────────────────────┘
        AiChatPanel slides in from the right on demand
```

| Zone | Contents | Components |
|------|----------|------------|
| Header | breadcrumb, name, health badge, department, row menu (Edit, Export, Run prediction) | Breadcrumb, Badge, Dropdown Menu |
| Health row | 4 dimension cards, each a HealthScoreRing + score + trend | HealthScoreCard, HealthScoreRing |
| Timeline row | Gantt (2/3) + latest AI prediction summary (1/3) | GanttTimeline, CitationChip |
| Tabs | Milestones, Budget, Resources, Docs | Tabs + the four components |
| History | Alert history feed, oldest collapsed | AlertsPanel (full variant) |
| AI panel | Slide-in assistant with project context pre-loaded | AiChatPanel |

Key interactions: tabs deep-link to URLs (`?tab=budget`) so officials can share exact views; Gantt zoom day/week/month with a red today marker; clicking a health card scrolls to and highlights its evidence zone; document upload supports drag-drop with per-file progress; alert history rows expand to show the metric values that triggered them.

### D.6 Kanban Board

```
┌────────────────────────────────────────────────────────────┐
│ [Project v] | Milestone workboard     [+ Add]  [Filter]    │
├───────────┬────────────┬─────────────┬─────────────────────┤
│ Backlog(4)│In Prog.(3) │ Blocked(1)  │ Done(12)            │
│ ┌───────┐ │ ┌────────┐ │ ┌─────────┐ │ ┌────────┐          │
│ │ Task  │ │ │ Task   │ │ │ Task    │ │ │ Task v │          │
│ │ P2 3d │ │ │ P1 AI  │ │ │ P1 late │ │ │ done d │          │
│ └───────┘ │ └────────┘ │ └─────────┘ │ └────────┘          │
└───────────┴────────────┴─────────────┴─────────────────────┘
  @dnd-kit: drag handle per card, drop indicators, snap spring
```

| Zone | Contents | Components |
|------|----------|------------|
| Header | project selector, add task, filter by assignee/priority | Select, Button, FilterBar |
| Columns | Backlog, In Progress, Blocked, Done with WIP counts | KanbanBoard, ScrollArea |
| Cards | title, priority stripe, assignee avatar, due chip, blocked reason | KanbanCard |

Key interactions: drag-and-drop via @dnd-kit with `PointerSensor` and `KeyboardSensor` (Space lifts, arrows move, Space drops - this is the accessibility fallback and a demo fallback); drops update Zustand optimistically, rollback with a toast if the API fails; a card dropped into Done animates its checkmark and can nudge milestone health; WIP limit on In Progress (5) shows an amber column border when reached; column counts re-render with a number counter.

### D.7 Analytics Domain (analytics.projectassure.vercel.app)

```
┌────────────────────────────────────────────────────────────┐
│ analytics.projectassure.vercel.app                         │
│ Top bar: DomainSwitcher | Date range | [Export PDF/Excel]  │
├────────────────────────────────────────────────────────────┤
│ Tabs: [Portfolio][Budget][Trends][Exports]                 │
│ ┌───────────────────────────┐ ┌──────────────────────────┐ │
│ │ Portfolio: dept bar chart │ │ Scatter: budget vs health│ │
│ └───────────────────────────┘ └──────────────────────────┘ │
│ Trends: 12-month health index line + department compare    │
│ Exports: report builder (scope, format) + saved exports    │
└────────────────────────────────────────────────────────────┘
```

| Zone | Contents | Components |
|------|----------|------------|
| Top bar | DomainSwitcher (main / analytics / ai), global date range, export | DomainSwitcher, Popover, ExportDialog |
| Portfolio tab | department bar chart, budget-vs-health scatter, bottom-10 table | Recharts (bars and scatter) |
| Budget tab | allocation vs utilisation stacked bars, overrun list | BudgetChart |
| Trends tab | 12-month health index lines, moving average toggle | Recharts LineChart |
| Exports tab | report builder + saved export history | ExportDialog, DataTable |

Key interactions: cross-domain navigation preserves auth session; date range filters every chart simultaneously; every chart is also available in the exported PDF; scatter points are hoverable with a tooltip card linking to the Project Detail page on the main domain; the report builder remembers the last used scope per user (Zustand persist).

### D.8 AI Chat Panel (ai.projectassure.vercel.app and in-app panel)

Design intent (from the original spec):
- Slide-in panel from the right (like Vercel's AI chat)
- Message history with user/assistant bubbles
- Typing indicator
- Quick action buttons ("Why is this project at risk?", "Show budget analysis")
- Sources cited below each response

```
                             ┌──────────────────────────────┐
                             │ AI Assistant        [–] [×]  │
                             ├──────────────────────────────┤
                             │ [Why is this project at risk]│
                             │ [Show budget analysis]       │
                             │                              │
                             │ You: Why is project X at …   │
                             │ ┌──────────────────────────┐ │
                             │ │ AI: Schedule variance of │ │
                             │ │ 14 days on M-12 …        │ │
                             │ │ Sources: [Gantt] [M-12]  │ │
                             │ └──────────────────────────┘ │
                             │ ● ● ●  typing                │
                             ├──────────────────────────────┤
                             │ [Ask anything…    ] [Send]   │
                             └──────────────────────────────┘
```

| Zone | Contents | Components |
|------|----------|------------|
| Header | title, minimise, close, context label ("Project X" / "Portfolio") | Sheet, Button |
| Quick actions | 2-4 context-aware prompt chips | QuickActionChips |
| Thread | user right / assistant left bubbles, citations under answers | ScrollArea, CitationChip |
| Status | typing indicator while streaming | TypingIndicator |
| Composer | textarea, send, stop-generation | Input, Button |

Key interactions: `/` opens the panel anywhere in the app; responses stream token-by-token with the typing indicator replaced by text; CitationChips expand to a preview card and click-scroll to the exact Gantt row, milestone, or budget series; the panel remembers thread context per project; every answer ends with a data-freshness line ("Based on data as of 09:42 IST"); guardrail: if data does not support an answer, the assistant says so instead of speculating.

### D.9 Admin Settings (ADMIN only)

```
┌────────────────────────────────────────────────────────────┐
│ Settings                                                    │
│ Tabs: [Users][Roles][Departments][Thresholds][Appearance]  │
├────────────────────────────────────────────────────────────┤
│ Users: DataTable - name, email, role select, status, last  │
│        login, row menu (deactivate, reset)                 │
│ Roles: permission matrix, 4 roles x capabilities, switches │
│ Departments: list + create + lead assignment               │
│ Thresholds: amber at 60, red at 40 (sliders + live preview)│
│ Appearance: default theme, table density, PWA toggles      │
└────────────────────────────────────────────────────────────┘
```

| Zone | Contents | Components |
|------|----------|------------|
| Tabs | six settings areas | Tabs, RoleGate (ADMIN) |
| Users | user DataTable with inline role Select | DataTable, Select, AlertDialog |
| Roles | ADMIN, PROJECT_MANAGER, STAKEHOLDER, VIEWER permission matrix | Switch, Table primitives |
| Thresholds | health band sliders with instant donut preview | Slider, HealthDonut |
| Appearance | default theme, density, PWA configuration | Switch, RadioGroup |

Key interactions: role changes require confirmation and announce who is affected; threshold sliders live-update a preview donut before saving; every settings mutation writes an audit log entry (timestamp, actor, before/after) shown in a collapsible audit table; destructive user deactivation uses AlertDialog with typed confirmation.

---

## PART E - Framer Motion Animation System

### In Plain English
> Motion in this product is the usher at a theatre: it quietly points you to your seat (where to look next) and never stands in front of the screen. If the audience notices the usher more than the play, the usher is fired - the same rule applies to our animations.

### E.1 Philosophy

1. **Purposeful**: every animation answers "what changed, and where did it come from?" Elements enter from where they logically came (alerts from the notification edge, panels from their launcher).
2. **Fast**: nothing exceeds 500ms except deliberate first-load chart reveals; hover and press feedback sit at 100-150ms.
3. **Physical**: springs for anything draggable or interruptible (kanban, cards); duration curves for one-shot transitions (pages, dialogs).
4. **Optional**: under `prefers-reduced-motion`, all transforms collapse to opacity fades or nothing; content never depends on motion to be understood.
5. **Tokenised**: durations and easings come from Part B.9 - no magic numbers in components.

### E.2 Page Transitions

```tsx
// app/(dashboard)/layout.tsx
import { AnimatePresence, motion } from 'framer-motion';

export default function DashboardLayout({ children }) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.3 }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
```

Spec: exit 200ms, enter 300ms, `mode="wait"` prevents overlap flashes; y-offset is 20px maximum - pages slide, they do not fly.

### E.3 Staggered List Animation

```tsx
// Project cards animate in with a stagger
const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

<motion.div variants={container} initial="hidden" animate="show">
  {projects.map(p => (
    <motion.div key={p.id} variants={item}>
      <ProjectCard project={p} />
    </motion.div>
  ))}
</motion.div>
```

Spec: stagger 50ms per item, capped at 12 items before the remaining rows appear instantly (no marathon reveals on the Projects list); used on dashboard KPI row, alert list, kanban columns.

### E.4 Number Counter (health scores, KPIs)

```tsx
// Animated counter for health scores
import { useSpring, animated } from '@react-spring/web';

function AnimatedScore({ value }: { value: number }) {
  const { number } = useSpring({ number: value, from: 0 });
  return <animated.span>{number.to(n => Math.round(n))}</animated.span>;
}
```

Framer Motion 11 equivalent used in the actual codebase:

```tsx
import { animate, useMotionValue, useTransform } from 'framer-motion';

function AnimatedScore({ value }: { value: number }) {
  const mv = useMotionValue(0);
  const rounded = useTransform(mv, (v) => Math.round(v).toString());
  useEffect(() => {
    const controls = animate(mv, value, { duration: 1.2, ease: [0.16, 1, 0.3, 1] });
    return () => controls.stop();
  }, [value]);
  return <motion.span>{rounded}</motion.span>;
}
```

Spec: 1.2s, `ease-out-expo`; tabular numerals so digits do not jitter horizontally; reduced-motion renders the final value directly.

### E.5 Alert Slide-In

```tsx
// Notifications slide in from the right
<motion.div
  initial={{ x: 300, opacity: 0 }}
  animate={{ x: 0, opacity: 1 }}
  exit={{ x: 300, opacity: 0 }}
  transition={{ type: 'spring', damping: 25, stiffness: 300 }}
>
  <AlertCard alert={alert} />
</motion.div>
```

Spec: spring-snappy; entry from the right edge (where notifications live); auto-dismiss after 8s with a 3s progress hairline; hover pauses dismissal; critical alerts use `role="alert"` and stay until acknowledged.

### E.6 Chart Reveal

```tsx
// Recharts wrapper reveal on mount / data change
const chartVariants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
};

<motion.div variants={chartVariants} initial="hidden" animate="show">
  <ResponsiveContainer>
    {/* donut, gauge, bar or line chart */}
  </ResponsiveContainer>
</motion.div>
```

Spec: container fades and rises 16px while Recharts animates its own series (donut sweep, line draw); staggered 150ms after the KPI row so the eye lands on numbers first, then charts.

### E.7 Health Ring Sweep

```tsx
// HealthScoreRing: SVG circle stroke sweep
const circumference = 2 * Math.PI * radius;

<svg viewBox={`0 0 ${size} ${size}`}>
  <circle cx={c} cy={c} r={radius} stroke="var(--color-surface-muted)" strokeWidth={8} fill="none" />
  <motion.circle
    cx={c} cy={c} r={radius}
    stroke={`var(--color-health-${tone})`} strokeWidth={8} fill="none"
    strokeLinecap="round"
    strokeDasharray={circumference}
    initial={{ strokeDashoffset: circumference }}
    animate={{ strokeDashoffset: circumference * (1 - score / 100) }}
    transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
  />
</svg>
```

Spec: sweep starts after the counter has begun (200ms delay) so number and ring finish together; reduced-motion renders the final arc statically.

### E.8 Skeleton Shimmer

```css
/* globals.css */
@keyframes shimmer {
  from { background-position: 200% 0; }
  to   { background-position: -200% 0; }
}
.skeleton {
  background: linear-gradient(
    90deg,
    var(--color-surface-muted) 25%,
    var(--color-surface-elevated) 50%,
    var(--color-surface-muted) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.4s ease-in-out infinite;
}
```

### E.9 Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

Framer Motion code additionally checks `useReducedMotion()` to skip spring physics on drag surfaces.

### E.10 Motion Inventory

| Element | Pattern | Duration / easing | Trigger |
|---------|---------|-------------------|---------|
| Page change | fade + 20px slide | 300ms ease-out | route change |
| KPI numbers | counter | 1.2s ease-out-expo | first load, data refresh |
| Health ring | stroke sweep | 1.1s ease-out-expo | first load |
| Lists/cards | stagger | 50ms per item | first load, filter change |
| Donut / gauge | container rise + series sweep | 500ms + native | first load |
| Alert toast | spring slide from right | spring 300/25 | websocket event |
| Kanban drag | lift + shadow-xl, drop snap | spring 300/25 | pointer / keyboard |
| Dialogs | fade + scale 0.96→1 | 200ms | open/close |
| Skeletons | shimmer loop | 1.4s loop | while loading |
| Theme switch | colour cross-fade | 200ms | toggle |

## PART F - The "30-Second Executive" Dashboard Principle

### In Plain English
> Design the dashboard like a newspaper front page: the headline (KPI cards) tells you whether something big happened, the subheads (donut, gauge, alerts) tell you where, and the body text (ranking table) holds the detail for whoever keeps reading. A busy secretary gets the whole story in 30 seconds without reading a single paragraph.

### F.1 The Problem Being Solved

MoSPI officials are responsible for many schemes and projects but review them in the gaps between meetings - a realistic attention window is 30 seconds. In that window the official must reach one of three decisions: *nothing needs me*, *I need to ask a question*, or *this needs escalation now*. The dashboard is therefore a triage instrument, not a comprehensive report. Everything on it is ordered to move the eye from "is anything wrong?" to "what exactly?" to "what do I do?" without a single wasted fixation.

### F.2 Information Hierarchy: Glance → Compare → Drill

| Band | Time | Question answered | Element | Design rule |
|------|------|-------------------|---------|-------------|
| Glance | 0-10s | "Is anything wrong?" | 4 KPI cards + health donut + budget gauge | Pre-attentive encoding only - size, colour, position. Zero reading required. Fully visible at 1366x768 without scrolling |
| Compare | 10-20s | "Where exactly is the trouble?" | Critical alerts panel + ranking table | Worst-first ordering; each row self-explains with badge + delta; maximum 8 rows visible before "view all" |
| Drill | 20-30s | "What do I do about it?" | Click-through to Project Detail or AI "why" | Any project is one click away; every alert row carries an AI quick-action |

### F.3 Rules Derived From the Principle

1. **Maximum 4 KPI cards.** Working memory handles four items; a fifth card dilutes the first four.
2. **Colour is the first sort.** The alerts panel sits above the ranking table because red pulls the eye; we place the red where the eye lands.
3. **Every number is comparative.** A KPI without a delta ("31 at risk, +4 vs last month") forces mental arithmetic - so all deltas are pre-computed.
4. **Projector-safe above the fold.** At 1366x768 the glance band and alerts are visible with no scroll - demo rooms and review meetings both use projectors.
5. **Tabular numerals everywhere.** Digits align in columns; misaligned digits read as errors.
6. **Progressive disclosure.** Filters, advanced charts, and department splits live below the fold or in popovers - they never push the glance band down.
7. **No dead data.** Every glance-level element is a link into the compare or drill band.

### F.4 Application Across Roles

STAKEHOLDER and VIEWER accounts see the identical glance and compare bands but drill actions degrade to read-only (no Edit, no Run prediction). ADMIN sees one extra strip in the compare band: system health (queue lag, last sync). PROJECT_MANAGER sees the same dashboard plus the kanban shortcut per project row. The hierarchy never changes by role - only the permissions of its exits do.

---

## PART G - Accessibility (WCAG 2.1 AA)

### In Plain English
> Accessibility is the ramp built next to the stairs. Sighted mouse users take the stairs; keyboard, screen-reader, and low-vision users take the ramp. Same building, same destination - and the whole building is better because the ramp forced clearer signage for everyone.

### G.1 Contrast Checklist (Token Pairs)

Ratios are approximate, verified with axe-core and the WebAIM checker in CI:

| Foreground | Background | Ratio | Verdict | Allowed usage |
|------------|------------|-------|---------|---------------|
| `text-primary` #0f172a | `surface` #ffffff | ~17.5:1 | AAA | headings, body, key figures |
| `text-primary` #0f172a | `surface-muted` #f1f5f9 | ~15.9:1 | AAA | table stripe text |
| `text-secondary` #64748b | `surface` #ffffff | ~4.8:1 | AA | labels, secondary copy |
| `text-muted` #94a3b8 | `surface` #ffffff | ~2.9:1 | Fails text | decorative hints, disabled only - never task-critical info |
| `#ffffff` | `primary-600` #0074c5 | ~4.9:1 | AA | primary button labels |
| `#ffffff` | `primary-500` #0c93e7 | ~3.3:1 | Large text / icons only | big CTAs, icon fills |
| `primary-700` #015ca0 | `surface` #ffffff | ~6.7:1 | AA | links on white |
| `success-text` #15803d | `success-soft` #dcfce7 | ~4.7:1 | AA | success badges |
| `warning-text` #b45309 | `warning-soft` #fef3c7 | ~4.6:1 | AA | warning badges |
| `danger-text` #b91c1c | `danger-soft` #fee2e2 | ~5.6:1 | AA | danger badges, form errors |
| `health-*` raw hues | `surface` #ffffff | 2.2-3.8:1 | Graphics only | ring strokes, dots - always paired with a labelled value |
| dark `text-primary` #f1f5f9 | dark `surface` #0f172a | ~13:1 | AAA | dark theme body |

### G.2 Keyboard Map

| Keys | Context | Action |
|------|---------|--------|
| `Tab` / `Shift+Tab` | everywhere | move focus; ring always visible |
| `Enter` / `Space` | buttons, table rows, cards | activate / open detail |
| `Ctrl/Cmd + K` | global | command palette |
| `/` | global (not while typing) | open AI chat panel |
| `Esc` | dialog, sheet, palette, AI panel | close and return focus to trigger |
| `Arrow keys` | Tabs, RadioGroup, Select, Kanban, menu | move focus / selection |
| `Space`, arrows, `Space` | KanbanCard (keyboard sensor) | lift, move, drop |
| `G` then `D` / `P` / `A` | global | go to Dashboard / Projects / Analytics |
| `?` | global | keyboard shortcut help dialog |

### G.3 ARIA Rules

- Skip-to-content link is the first tabbable element on every page.
- Landmarks: `header`, `nav`, `main`, `aside`; exactly one `h1` per page.
- Charts: `role="img"` plus `aria-label` summarising the data ("Portfolio health: 74 healthy, 31 at risk, 23 critical"); the health donut and budget gauge expose a visually-hidden data table for exact values.
- DataTable: `aria-sort` on sortable headers, `aria-selected` on selected rows, `aria-busy` while loading.
- Dialogs and sheets: focus trap, `role="dialog"`, `aria-modal`, focus returns to the trigger on close.
- Live regions: standard toasts are `role="status" aria-live="polite"`; critical alert toasts are `role="alert" aria-live="assertive"`.
- Icon-only buttons carry `aria-label`; health dots are `aria-hidden` because the adjacent text carries the meaning.
- @dnd-kit `KeyboardSensor` is enabled on the kanban so drag-and-drop is fully operable without a pointer.

### G.4 Screen-Reader Announcements for Live Alerts

| Event | Region | Announcement |
|-------|--------|--------------|
| New alert toast | polite | "Alert: Project Bharat Mapping budget utilisation crossed 85 percent, 2 minutes ago." |
| Critical alert | assertive | "Critical alert: Milestone M-12 of Project Census Prep is 14 days overdue. Press Enter to open." |
| Dashboard refresh | polite | "Portfolio updated: 128 projects, 74 on track, 31 at risk, 23 critical." |
| Table sort | polite | "Sorted by health score, ascending, column 2 of 7." |
| Kanban drop | polite | "Task Contractor onboarding moved to In Progress." |

### G.5 Testing Gates

- CI runs axe-core on every page; zero serious or critical violations is a merge requirement.
- Manual passes each release: NVDA + Chrome (Windows) and VoiceOver + Safari (macOS/iOS).
- Lighthouse accessibility score of 95 or higher on all three domains.
- A keyboard-only walkthrough of the five core journeys (login, dashboard triage, project drill, kanban move, export) every sprint.

---

## PART H - Responsive Strategy

### In Plain English
> One suit, three tailors. The desktop layout is the suit; tablets and phones get it re-cut, not redesigned - same fabric (tokens), same style (principles), different seams. Nobody expects the suit to become a T-shirt.

### H.1 Breakpoint Table

| Breakpoint | Width | Device class | Layout behaviour |
|------------|-------|--------------|------------------|
| base | < 640px | phones | single column; sidebar becomes a drawer; tables become stacked cards; 44px touch targets |
| `sm` | >= 640px | large phones | KPI 2-across; filters wrap to two rows |
| `md` | >= 768px | tablets | KPI 2-across + charts stacked; sidebar becomes a persistent icon rail |
| `lg` | >= 1024px | laptops | full 240px sidebar; KPI 4-across; charts side-by-side; full DataTable |
| `xl` | >= 1280px | desktops | right rail (AI hints / alert digest); container max-w 1400px |
| `2xl` | >= 1536px | large monitors | container max-w 1600px; dashboard gains a third column for the ranking table |

### H.2 Executive Dashboard per Breakpoint

| Breakpoint | Adaptation |
|------------|------------|
| base | KPI 1-col (2x2 at sm); donut and gauge stacked; alerts and ranking become full-width cards; sidebar is a drawer |
| md | KPI 2x2; charts stacked; ranking table horizontal-scrolls with sticky first column |
| lg | the full desktop layout; glance band fits without scroll |
| xl | alerts digest moves into the right rail as a live feed |
| 2xl | ranking table widens to show budget and trend columns simultaneously |

### H.3 Projects List per Breakpoint

| Breakpoint | Adaptation |
|------------|------------|
| base | rows become cards: name + health ring + status badge; FilterBar collapses into a Drawer; pagination stays sticky at the bottom |
| sm-md | two-column card grid; column-priority menu lets users pick which 3 metrics show on each card |
| lg+ | the full 7-column table with sortable headers and sticky header |

### H.4 Project Detail per Breakpoint

| Breakpoint | Adaptation |
|------------|------------|
| base | 4 health cards in 2x2; Gantt switches to a horizontal-scroll strip with sticky task names; Tabs become an Accordion |
| md | health cards 4-across; Gantt scrolls with visible affordance edge |
| lg+ | full layout; Gantt zoom controls appear inline |

### H.5 Touch and PWA Rules for Field Officers

- Touch targets at least 44x44px; inputs use 16px font to prevent iOS zoom; safe-area insets respected on notched devices.
- The PWA manifest carries the ProjectAssure name, `#0b426e` theme colour, and a maskable icon; the service worker uses stale-while-revalidate for the app shell and cache-first for static assets.
- Mutations performed offline queue in IndexedDB and replay via Background Sync; the OfflineBanner shows the queued count.
- The InstallPwaPrompt bottom sheet appears on the second visit; the installed app opens the last-visited page with a 24-hour cached dashboard snapshot for read-only reference.

---

## PART I - States Design

### In Plain English
> Design the states like an airport handles problems: the departure board never goes blank. Gates unassigned (empty)? It says so. Data late (loading)? A spinner appears. Cancelled (error)? It offers rebooking. Fog (offline)? It shows the last known information and says how old it is.

### I.1 State Matrix

| Page / component | Empty | Loading | Error | Offline |
|------------------|-------|---------|-------|---------|
| Executive Dashboard | welcome-onboarding card (0 projects) | 4 KPI skeletons, chart placeholders | per-region retry cards | cached snapshot + banner |
| Projects list | "no match" + clear filters | 8 skeleton rows | retry card | cached list, stale label |
| Project Detail | n/a (always exists) | section skeletons | per-tab retry | read-only cache |
| Kanban | per-column empty hint | column skeletons | column retry | queued moves badge |
| Analytics | "not enough data yet" | chart skeletons | chart retry | hidden (needs live) |
| AI Chat | quick-action chips | typing indicator | "answer failed, retry" | disabled with notice |
| Documents | upload dropzone CTA | file progress rows | per-file retry | queued uploads badge |

### I.2 Empty States (copy examples)

- Alerts panel: bell icon, "No critical alerts" + "You are all caught up. Alerts appear when a project crosses a health threshold." (no CTA - calm is the message)
- Projects table: "No projects match your filters" + primary "Clear filters" + secondary "New project" (PM and above)
- Documents: "No documents yet" + "Upload the first DPR - PDF or XLSX, up to 25 MB" + FileUploader dropzone
- Rules: one sentence of cause, one of action; zero is never styled as an error; every empty state names the action that fills it.

### I.3 Loading States

- Skeletons mirror the final layout exactly - four KPI blocks, chart-shaped circles, eight table rows - never a generic spinner for structure.
- Buttons keep their label and gain an inline spinner; layout never shifts more than 4px when loading resolves.
- Minimum skeleton display of 300ms prevents flicker on fast loads.
- Stale-while-revalidate: React Query shows last known data with an "Updated 2 min ago" whisper while refetching - the screen is never blank on return visits.

### I.4 Error States

- Region-level errors render a retry card inside the affected zone; sibling zones stay alive.
- Form errors appear under each field via `aria-describedby`; the multi-step form shows a summary banner listing failed steps.
- 403 pages explain the missing role ("Ask an ADMIN for STAKEHOLDER access"); 404 offers search and back-to-dashboard.
- Route-level ErrorBoundary per segment shows a calm message, a digest for support, and a Reload button.

### I.5 Offline (PWA)

- OfflineBanner: "You are offline - showing cached data from 09:42. Actions will sync when you reconnect." with a queued-count badge.
- Field-officer flow: open dashboard offline, read the cached snapshot, record a note or capture a document (queued), and on reconnect a toast confirms "3 queued actions uploaded".
- Conflict rule: queued mutations replay in order; a failed replay rolls back optimistically and surfaces a per-item retry in the banner.

---

## PART J - Demo-Day "Wow Moments"

### In Plain English
> Five rehearsed magic tricks. Each one is a real product feature - no smoke, no mockups - but staged so the jury leans forward. Practise the click order until it is boring; boring for the team is jaw-drop for the jury.

### J.1 The Living Health Ring

- **Setup:** Executive Dashboard opened fresh (cache cleared) so the entrance replays.
- **On screen:** KPI counters roll from zero; the health donut sweeps to 74 / 31 / 23; the budget gauge fills; alert rows stagger in. Under two seconds, motion done.
- **Narrate:** "In under two seconds a secretary sees the whole portfolio. No report to request, no waiting - colour and motion do the triage. That is the 30-second principle in Part F of our design system."
- **Fallback:** pre-rendered static numbers with one recorded GIF on the demo laptop.

### J.2 Ask the AI "Why Is This Project At Risk?"

- **Setup:** Project Detail of an at-risk project preloaded; AI panel closed; `/` shortcut at the ready.
- **On screen:** the panel slides in; the question is typed; a typing indicator pulses; the answer streams token-by-token and cites milestone M-12 and the budget burn chart with CitationChips; clicking a chip scroll-highlights the exact Gantt row.
- **Narrate:** "Answers come from the project's own data, every claim cited and auditable - exactly what a ministry needs before it trusts AI."
- **Fallback:** a pre-cached response replays as if streamed.

### J.3 Real-Time Alert Toast

- **Setup:** a second device or script triggers a threshold breach (budget crosses 85%) mid-demo.
- **On screen:** an AlertToast springs in from the right; the At-Risk KPI ticks from 31 to 32; the donut segment re-animates; the alerts panel gains a row with a highlight flash.
- **Narrate:** "Live, not refreshed. The moment a scheme slips, the secretary knows - this is the Smart Automation thesis in one toast."
- **Fallback:** the seeded demo dataset fires the alert on a timer from the operator's script.

### J.4 Drag-and-Drop Kanban

- **Setup:** the kanban of a project with one Blocked task, tablet on stage.
- **On screen:** "Contractor onboarding" is dragged from Blocked to In Progress; the card lifts with shadow-xl, other cards part like water, the drop snaps with a spring, a persist toast confirms, and the milestone health chip improves.
- **Narrate:** "Field updates made by the people doing the work - even from a tablet - feed the health engine instantly."
- **Fallback:** keyboard drag-and-drop (Space, arrows, Space) - which doubles as the accessibility proof.

### J.5 One-Click Export

- **Setup:** analytics domain, portfolio view filtered to one department.
- **On screen:** Export PDF runs a progress sweep and downloads a branded report containing the donut, the ranking table, and health commentary; Export Excel follows for the data team.
- **Narrate:** "The monthly review deck used to take an analyst two days. It is now one click, generated from live data."
- **Fallback:** a pre-generated PDF on the desktop, opened even if offline.

### J.6 Demo Discipline

- One operator drives, one narrator speaks; the rehearsed 8-minute path is Dashboard → J.1 → Project Detail → J.2 → J.3 → J.4 → Analytics → J.5.
- Every moment has a network-independent fallback; the seeded dataset (74 / 31 / 23) is tuned to hit the narrative beats.
- Never apologise on stage; every fumble has a scripted recovery line and the next wow moment is one click away.

---

*This document is part of the ProjectAssure SIH 2026 submission.*
