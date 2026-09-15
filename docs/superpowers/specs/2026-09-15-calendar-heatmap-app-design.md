# Calendar heatmap app — design

## Purpose

A minimal, framework-free web app that renders a multi-month calendar
heatmap: each day is colored by a user-configured category (e.g. OOO,
offsite, security response), with weekend/regular-workday as built-in
fallbacks. Recreates the visual design in `Calendar.dc.html` (a Claude
Design canvas mockup) as a standalone app whose time period and
categories are configurable through a form, instead of hardcoded data.

Source mockup: `Calendar.dc.html` / `support.js` (Claude Design's
proprietary `.dc.html` preview runtime — used only as the visual
reference; not a dependency of this app).

## Non-goals (out of scope for this pass)

- Export/import of config as a file, or URL-based sharing of a config.
- Drag-to-paint across multiple days (click one day at a time is in
  scope; drag is a good follow-up, not needed now).
- Auth, accounts, or a backend of any kind.
- A build step, bundler, or npm dependency.

## Architecture

Fully static app: `index.html` plus a handful of native ES modules,
loaded via `<script type="module">`. No build tooling.

```
index.html
css/
  tokens.css            — design tokens (oklch colors, fonts, spacing) on :root
js/
  calendar-app.js        — <calendar-app> — shell, state, persistence
  calendar-heatmap.js     — <calendar-heatmap> — renders stats/legend/months/cells
  calendar-config-form.js — <calendar-config-form> — the gutter form
  date-utils.js           — pure date/range helper functions
  default-config.js       — first-run example config (H1 2026 dataset)
```

### `<calendar-app>`

- Owns the `Config` (see Data model) as in-memory state.
- On connect: loads `Config` from `localStorage` (key
  `calendar-heatmap-config`), falling back to `default-config.js` if
  absent or invalid.
- Renders a floating show/hide button (always visible, outside the
  gutter), `<calendar-config-form>` inside a collapsible gutter, and
  `<calendar-heatmap>` in the main area.
- Listens for `config-change` (from the form) and `day-click` (from
  the heatmap, active only in paint mode), applies the update to
  `Config`, re-renders children, and persists to `localStorage`
  (including `gutterOpen`).

### `<calendar-config-form>`

- Fields: period start date, period end date.
- A repeatable list of category rows: name, color swatch/picker, a
  list of date-range rows (start/end date, add/remove), reorder
  (up/down) to set priority, delete category, "add category" button.
- A "paint" selector: choose which category (or "erase") is active
  for click-to-paint on the calendar; painting is optional — if no
  tool is selected, the calendar is not clickable for editing.
- An optional free-text notes field, shown under the calendar when
  non-empty.
- Validates that each range's start ≤ end and highlights the row
  inline if not; invalid ranges are not emitted in `config-change`.
- Emits `config-change` (bubbling `CustomEvent<Config>`) on every
  committed edit.

### `<calendar-heatmap>`

- Input: resolved `Config`.
- Renders: header (period label), stat tiles (count per category incl.
  built-in fallbacks), legend, one card per month in the period with
  a 7-column day grid.
- Per-day category resolution (see Data model) determines cell fill,
  text color, and tooltip title.
- When a paint tool is active (passed down as an attribute/property
  from the app), clicking a day dispatches `day-click` with the
  date; the component itself holds no category state.

### `date-utils.js`

Pure functions, no classes:
- `enumerateMonths(periodStart, periodEnd)` → month definitions for
  the grid.
- `datesInRange(start, end)` → `string[]` of ISO dates.
- `collapseDatesToRanges(dates: string[])` → contiguous
  `{start, end}[]`, for displaying a category's set as form rows.
- `isWeekend(dateStr)`.

### `default-config.js`

Exports the H1 2026 example `Config` from the mockup (Feb 1 – Jul 31
2026; Regular/OOO/Offsite/AI/Security categories with their original
dates) so the app isn't empty on first run.

## Data model

```ts
type Category = {
  id: string
  name: string
  color: string          // any valid CSS color
  dates: string[]         // sorted ISO "YYYY-MM-DD", the source of truth
}

type Config = {
  periodStart: string     // ISO date
  periodEnd: string       // ISO date
  categories: Category[]  // priority = array order, index 0 highest
  gutterOpen: boolean
  notes?: string
}
```

Per-day category resolution, in order:
1. First category (in array order) whose `dates` includes the day.
2. Built-in "Weekend" (fixed color) if the day is Saturday/Sunday.
3. Built-in "Regular workday" (fixed color) fallback.

A category's `dates` is the only stored representation. The form's
range rows are a view: typing a range expands it to individual dates
via `datesInRange` and merges them into the set; the form displays a
category's current set collapsed back to ranges via
`collapseDatesToRanges`. Click-to-paint toggles a single date in the
set. This keeps range-editing and click-to-paint from ever diverging.

Weekend and Regular-workday are not user-editable categories (fixed
gray tones matching the mockup) — they're fallbacks, not configurable
fields, to keep the category list to things the user actually assigns.

## Persistence

- `localStorage["calendar-heatmap-config"]` = JSON-serialized
  `Config`, written (debounced) on every `config-change` / `day-click`
  update.
- Corrupt/missing/schema-mismatched stored config is discarded in
  favor of `default-config.js` (logged to console, not thrown) —
  this is the one place the app tolerates bad input, since it's
  reading its own past output from a store the user could have
  cleared or edited by hand.

## Styling

- Shadow DOM per component for encapsulation.
- `css/tokens.css` defines the mockup's oklch palette, spacing, and
  the IBM Plex Sans/Mono font stack as custom properties on `:root`;
  custom properties cross the shadow boundary, so each component's
  internal `<style>` references `var(--token-name)` instead of
  hardcoding values.
- The gutter and its floating toggle button use fixed/sticky
  positioning so hiding the gutter leaves a clean, screenshot-ready
  full-width calendar.

## Testing

Manual verification in-browser (no test framework needed for a static
app this size):
- Load with empty `localStorage` → default H1 2026 example renders
  correctly, matching the mockup's category colors/counts.
- Edit period dates → month cards update.
- Add/edit/remove a category and its ranges → cells, stats, and
  legend update; invalid range (start > end) is rejected inline.
- Select a paint tool, click days → set updates, form's collapsed
  ranges reflect the click; reload the page → change persisted.
- Toggle the gutter closed/open → main area reflows; reload → state
  persisted.
