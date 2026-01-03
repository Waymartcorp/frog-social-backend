# Frog Social – UI Style Guide

Goal: The app should feel like a **modern lab console** crossed with a **calm chat hub**.
Young postdocs, veterinarians, and PIs should feel like:
- “This is a serious tool.”
- “This is nicer than most institutional software.”
- “I actually enjoy hanging out here.”

## Brand adjectives

- Calm, precise, trustworthy
- Slightly playful / insider, not corporate
- “Field notes + control room” rather than generic dashboard

## Color palette

Base:
- Background: `#050810` (very dark blue-black) for outer shell, `#0B1020` for app body
- Surface cards: `#111827` / `#111827` with subtle border `#1F2937`
- Text primary: `#F9FAFB`
- Text secondary: `#9CA3AF`

Accent (Xenopus / water):
- Primary accent: `#34D399` (emerald / frog-green)
- Secondary accent: `#38BDF8` (cyan)
- Warning: `#F97316` (orange) for “things are trending bad”
- Danger: `#EF4444` (red) for escalations

Usage:
- Primary CTA buttons (e.g., “Open case intake”, “Post”) use emerald.
- Links and subtle highlights use cyan.
- Avoid pure white backgrounds; everything sits on dark surfaces or soft gradients.

## Typography

- Base font: system sans (Inter / system UI), 14–15px body, 18–22px titles.
- Headings:
  - H1 (page title): `text-2xl md:text-3xl font-semibold`
  - H2 (card titles / section headings): `text-lg font-semibold`
- Body text: `text-sm md:text-base text-gray-300`
- Important meta info (pH, temp, density) can be displayed in **small caps / mono**: `font-mono text-xs text-gray-400`.

## Layout & spacing

- Global layout: max width ~1200–1280px centered, with generous padding (`px-4 md:px-8 py-6`).
- Use **cards** with:
  - Rounded corners: `rounded-2xl`
  - Border: `border border-white/5`
  - Background: `bg-slate-900/70 backdrop-blur` (soft glassy look)
  - Shadow: `shadow-lg shadow-black/40`
- Spacing:
  - Inside cards: `p-4 md:p-6`
  - Between cards: `gap-4 md:gap-6`

## Navigation bar

- Fixed top nav with slightly translucent background:
  - `bg-slate-950/80 backdrop-blur border-b border-white/5`
- Active nav item:
  - `text-emerald-300`
  - Small pill background: `bg-emerald-500/10 rounded-full px-3 py-1`
- Include a subtle frog icon / glyph with “Frog Social” in the left corner.

## Buttons & inputs

Buttons:
- Primary:
  - `bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-medium rounded-full px-4 py-2 shadow shadow-emerald-500/30`
- Secondary:
  - `bg-slate-800 hover:bg-slate-700 text-gray-100 rounded-full px-4 py-2 border border-white/10`

Inputs:
- `bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-emerald-400 focus:ring-emerald-400/60`

## Cards on the Dashboard

- Each dashboard tile should follow this pattern:
  - Title row with small tag (e.g., “Core workflow”) as a pill: `text-xs uppercase tracking-wide bg-emerald-500/15 text-emerald-300 rounded-full px-2 py-1`
  - Main title: `text-lg font-semibold`
  - Body: `text-sm text-gray-300`
  - Footer link: `text-sm font-medium text-emerald-300 hover:text-emerald-200 inline-flex items-center gap-1`

## Social feed look

- Background split:
  - Left: feed on a darker card (`bg-slate-900/70`)
  - Right: AI sidebar card with slightly brighter border to feel “active”.
- Messages:
  - Each message in a rounded bubble `rounded-2xl bg-slate-800/80 border border-white/5 px-3 py-2`
  - Show author + timestamp in a tiny header line `text-xs text-gray-400`
- AI summaries:
  - Highlight key husbandry levers as **chips** (e.g., “Density”, “Flow”, “RO buffer”) using `bg-emerald-500/15 text-emerald-200 rounded-full px-2 py-0.5 text-xs`.

## Motion

- Use **small, subtle animations only**:
  - Hover: cards lift slightly (`translate-y-[-1px]`) and increase shadow.
  - Buttons: scale 1.02 on hover.
  - Page transitions: simple fade-in or slide-up for main content, 150–250ms.
- No big spinners or gimmicks; this is a lab tool.

## Icons & visual details

- Use a consistent icon set (Lucide) for:
  - Cases, social, systems, labworks, profile.
- Water / waveform / microscope / frog silhouettes can appear sparingly as flourishes in empty states (e.g., “No cases yet”).

Implementation notes:
- Use Tailwind utility classes as described here.
- Refactor existing components to conform to this palette and spacing.
- Do **not** change functional behavior, only visual styling.
