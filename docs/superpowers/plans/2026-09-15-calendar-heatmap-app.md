# Calendar Heatmap App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a static, framework-free web app that renders a multi-month calendar heatmap from a user-configurable period and set of day categories, with a hideable form gutter and localStorage persistence.

**Architecture:** Three custom elements (`<calendar-app>` shell, `<calendar-config-form>` gutter form, `<calendar-heatmap>` renderer) communicating via DOM events and property setters, plus two pure helper modules (`date-utils.js`, `default-config.js`). No build step — plain ES modules loaded via `<script type="module">`.

**Tech Stack:** Vanilla JS (Custom Elements, Shadow DOM, ES modules), plain CSS with custom properties, Node's built-in `node:test` runner for the pure logic modules. No npm dependencies.

**Spec:** [docs/superpowers/specs/2026-09-15-calendar-heatmap-app-design.md](../specs/2026-09-15-calendar-heatmap-app-design.md)

## Global Constraints

- No build step, no bundler, no framework, no npm dependencies. Plain `.js` files loaded as ES modules.
- `package.json` sets `"type": "module"` so the same `.js` files run under both `node --test` and the browser.
- Category `color` fields are only ever set via `<input type="color">`, which always yields a safe `#rrggbb` string — this is what makes it safe to interpolate `category.color` directly into a `style="..."` attribute without escaping. Never add a free-text color field.
- Any other user-provided string (category name, notes) that gets inserted into `innerHTML` MUST go through the shared `escapeHtml` function exported by `js/html-utils.js` — never a locally redefined copy.
- `localStorage` key: `calendar-heatmap-config`. Corrupt/missing/invalid stored config falls back to `default-config.js`'s `defaultConfig`, logged via `console.warn`, never thrown.
- Dates are always ISO `YYYY-MM-DD` strings, parsed as local dates (never `new Date("YYYY-MM-DD")` directly — that parses as UTC and can shift the weekday near midnight in negative-UTC-offset timezones). Use `date-utils.js`'s `parseDateLocal`.
- Git: local repo only, no remote. Terse, single-line, conventional-style commit subjects (`feat(scope): description`), no commit body.

---

### Task 1: Project scaffold + `date-utils.js` + `html-utils.js`

**Files:**
- Create: `package.json`
- Create: `js/date-utils.js`
- Create: `js/html-utils.js`
- Test: `tests/date-utils.test.js`
- Test: `tests/html-utils.test.js`

**Interfaces:**
- Produces: `parseDateLocal(dateStr: string): Date`, `formatDateLocal(date: Date): string`, `isWeekend(dateStr: string): boolean`, `datesInRange(startStr: string, endStr: string): string[]`, `collapseDatesToRanges(dates: string[]): {start: string, end: string}[]`, `enumerateMonths(periodStart: string, periodEnd: string): {year: number, month: number, name: string}[]` (month is 0-based, matching `Date`), `monthGridDays(year: number, month: number): ({day: number, date: string} | null)[]`, `isWithinPeriod(dateStr: string, periodStart: string, periodEnd: string): boolean`. Also produces `escapeHtml(value: unknown): string` from `js/html-utils.js` — the one shared implementation every other task imports instead of redefining.

- [ ] **Step 1: Scaffold `package.json`**

The git repo and this task's branch/worktree already exist (set up by the controller before dispatch) — do not run `git init`. Just create `package.json`:

```json
{
  "name": "rendered-and-quartered-calendar",
  "private": true,
  "type": "module"
}
```

- [ ] **Step 2: Write the failing tests**

Create `tests/date-utils.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isWeekend,
  datesInRange,
  collapseDatesToRanges,
  enumerateMonths,
  monthGridDays,
  isWithinPeriod,
} from '../js/date-utils.js';

test('isWeekend identifies Saturday and Sunday', () => {
  assert.equal(isWeekend('2026-06-06'), true);
  assert.equal(isWeekend('2026-06-07'), true);
  assert.equal(isWeekend('2026-06-08'), false);
});

test('datesInRange enumerates inclusive ISO dates', () => {
  assert.deepEqual(datesInRange('2026-06-01', '2026-06-03'), [
    '2026-06-01',
    '2026-06-02',
    '2026-06-03',
  ]);
});

test('collapseDatesToRanges merges contiguous dates and keeps gaps separate', () => {
  const dates = ['2026-06-03', '2026-06-01', '2026-06-02', '2026-06-10'];
  assert.deepEqual(collapseDatesToRanges(dates), [
    { start: '2026-06-01', end: '2026-06-03' },
    { start: '2026-06-10', end: '2026-06-10' },
  ]);
});

test('enumerateMonths spans an inclusive month range across a year boundary', () => {
  const months = enumerateMonths('2026-11-15', '2027-01-05');
  assert.deepEqual(
    months.map((m) => `${m.year}-${m.month}`),
    ['2026-10', '2026-11', '2027-0']
  );
});

test('monthGridDays pads leading/trailing cells to full weeks', () => {
  const cells = monthGridDays(2026, 5); // June 2026 starts on a Monday
  assert.equal(cells.length, 35);
  assert.equal(cells[0], null);
  assert.equal(cells[1].date, '2026-06-01');
  assert.equal(cells[30].date, '2026-06-30');
  assert.equal(cells[31], null);
});

test('isWithinPeriod is inclusive of both bounds', () => {
  assert.equal(isWithinPeriod('2026-02-01', '2026-02-01', '2026-07-31'), true);
  assert.equal(isWithinPeriod('2026-01-31', '2026-02-01', '2026-07-31'), false);
});
```

- [ ] **Step 3: Run the tests and confirm they fail**

Run: `node --test tests/`
Expected: FAIL — `Cannot find module '../js/date-utils.js'`

- [ ] **Step 4: Implement `js/date-utils.js`**

```js
export function parseDateLocal(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function formatDateLocal(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function isWeekend(dateStr) {
  const dow = parseDateLocal(dateStr).getDay();
  return dow === 0 || dow === 6;
}

export function datesInRange(startStr, endStr) {
  const end = parseDateLocal(endStr);
  const dates = [];
  for (const cursor = parseDateLocal(startStr); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
    dates.push(formatDateLocal(cursor));
  }
  return dates;
}

function nextDay(dateStr) {
  const d = parseDateLocal(dateStr);
  d.setDate(d.getDate() + 1);
  return formatDateLocal(d);
}

export function collapseDatesToRanges(dates) {
  const sorted = [...new Set(dates)].sort();
  const ranges = [];
  for (const dateStr of sorted) {
    const last = ranges[ranges.length - 1];
    if (last && nextDay(last.end) === dateStr) {
      last.end = dateStr;
    } else {
      ranges.push({ start: dateStr, end: dateStr });
    }
  }
  return ranges;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function enumerateMonths(periodStart, periodEnd) {
  const start = parseDateLocal(periodStart);
  const end = parseDateLocal(periodEnd);
  const months = [];
  let year = start.getFullYear();
  let month = start.getMonth();
  const endYear = end.getFullYear();
  const endMonth = end.getMonth();
  while (year < endYear || (year === endYear && month <= endMonth)) {
    months.push({ year, month, name: MONTH_NAMES[month] });
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
  }
  return months;
}

export function monthGridDays(year, month) {
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startDow = first.getDay();
  const totalCells = Math.ceil((startDow + daysInMonth) / 7) * 7;
  const cells = [];
  for (let i = 0; i < totalCells; i++) {
    const dayNum = i - startDow + 1;
    if (dayNum < 1 || dayNum > daysInMonth) {
      cells.push(null);
    } else {
      cells.push({ day: dayNum, date: formatDateLocal(new Date(year, month, dayNum)) });
    }
  }
  return cells;
}

export function isWithinPeriod(dateStr, periodStart, periodEnd) {
  return dateStr >= periodStart && dateStr <= periodEnd;
}
```

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `node --test tests/`
Expected: PASS — 6 tests, 0 failures

- [ ] **Step 6: Write the failing test for `html-utils.js`**

Create `tests/html-utils.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml } from '../js/html-utils.js';

test('escapeHtml escapes the five HTML-significant characters', () => {
  assert.equal(escapeHtml(`<b>"a" & 'b'</b>`), '&lt;b&gt;&quot;a&quot; &amp; &#39;b&#39;&lt;/b&gt;');
});

test('escapeHtml coerces non-string input', () => {
  assert.equal(escapeHtml(42), '42');
});
```

- [ ] **Step 7: Run the tests and confirm the new one fails**

Run: `node --test tests/`
Expected: FAIL — `Cannot find module '../js/html-utils.js'`

- [ ] **Step 8: Implement `js/html-utils.js`**

```js
const ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ESCAPES[ch]);
}
```

- [ ] **Step 9: Run the tests and confirm they all pass**

Run: `node --test tests/`
Expected: PASS — 8 tests, 0 failures

- [ ] **Step 10: Commit**

```bash
git add package.json js/date-utils.js js/html-utils.js tests/date-utils.test.js tests/html-utils.test.js
git commit -m "feat(date-utils): add pure date/range and html-escaping helpers"
```

---

### Task 2: `default-config.js`

**Files:**
- Create: `js/default-config.js`
- Test: `tests/default-config.test.js`

**Interfaces:**
- Consumes: `isWithinPeriod` from `js/date-utils.js` (Task 1).
- Produces: `defaultConfig: Config` where `Config = { periodStart: string, periodEnd: string, gutterOpen: boolean, notes?: string, categories: { id: string, name: string, color: string, dates: string[] }[] }`.

- [ ] **Step 1: Write the failing tests**

Create `tests/default-config.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultConfig } from '../js/default-config.js';
import { isWithinPeriod } from '../js/date-utils.js';

test('defaultConfig has a valid period', () => {
  assert.ok(defaultConfig.periodStart < defaultConfig.periodEnd);
});

test('defaultConfig categories are well-formed and within the period', () => {
  assert.ok(Array.isArray(defaultConfig.categories));
  assert.ok(defaultConfig.categories.length > 0);
  for (const category of defaultConfig.categories) {
    assert.equal(typeof category.id, 'string');
    assert.equal(typeof category.name, 'string');
    assert.equal(typeof category.color, 'string');
    assert.ok(Array.isArray(category.dates));
    for (const dateStr of category.dates) {
      assert.ok(
        isWithinPeriod(dateStr, defaultConfig.periodStart, defaultConfig.periodEnd),
        `${dateStr} in category ${category.id} is outside the configured period`
      );
    }
  }
});

test('defaultConfig category ids are unique', () => {
  const ids = defaultConfig.categories.map((c) => c.id);
  assert.equal(ids.length, new Set(ids).size);
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `node --test tests/`
Expected: FAIL — `Cannot find module '../js/default-config.js'`

- [ ] **Step 3: Implement `js/default-config.js`**

```js
export const defaultConfig = {
  periodStart: '2026-02-01',
  periodEnd: '2026-07-31',
  gutterOpen: true,
  notes:
    'Example dataset shown on first load. Edit the period and categories in the form to track your own — this data is just a placeholder.',
  categories: [
    {
      id: 'oncall',
      name: 'On-call rotation',
      color: '#c0392b',
      dates: [
        '2026-05-18', '2026-05-19', '2026-05-20', '2026-05-21',
        '2026-05-22', '2026-05-26', '2026-05-27', '2026-05-28',
      ],
    },
    {
      id: 'offsite',
      name: 'Team offsite',
      color: '#8e44ad',
      dates: ['2026-06-01', '2026-06-02', '2026-06-03', '2026-06-04', '2026-06-05'],
    },
    {
      id: 'training',
      name: 'Training day',
      color: '#d4a017',
      dates: ['2026-03-17', '2026-03-18'],
    },
    {
      id: 'timeoff',
      name: 'Time off',
      color: '#2980b9',
      dates: [
        '2026-02-26', '2026-03-05', '2026-03-23', '2026-03-26', '2026-04-03',
        '2026-05-25', '2026-05-29', '2026-06-15', '2026-06-16', '2026-06-17',
        '2026-06-18', '2026-06-19', '2026-06-22', '2026-06-23', '2026-06-24',
        '2026-06-25', '2026-06-26', '2026-07-03', '2026-07-06',
      ],
    },
  ],
};
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `node --test tests/`
Expected: PASS — 9 tests total, 0 failures

- [ ] **Step 5: Commit**

```bash
git add js/default-config.js tests/default-config.test.js
git commit -m "feat(default-config): add example dataset"
```

---

### Task 3: `<calendar-heatmap>` + design tokens + scaffold `index.html`

**Files:**
- Create: `css/tokens.css`
- Create: `js/calendar-heatmap.js`
- Create: `index.html`

**Interfaces:**
- Consumes: `enumerateMonths`, `monthGridDays`, `isWithinPeriod`, `isWeekend`, `datesInRange` from `js/date-utils.js`; `escapeHtml` from `js/html-utils.js` (Task 1); `defaultConfig` from `js/default-config.js` (index.html wiring only).
- Produces: custom element `<calendar-heatmap>` with property `config: Config` (setter, triggers render), boolean attribute `paint-active` (when present, day cells become clickable and get `data-date`), and a `day-click` event (`CustomEvent<{date: string}>`, bubbles, composed).

- [ ] **Step 1: Create `css/tokens.css`**

```css
:root {
  --font-sans: 'IBM Plex Sans', Helvetica, Arial, sans-serif;
  --font-mono: 'IBM Plex Mono', monospace;

  --color-bg: oklch(97% 0.004 250);
  --color-text: oklch(22% 0.012 250);
  --color-border: oklch(85% 0.006 250);
  --color-panel: oklch(99% 0.002 250);
  --color-muted: oklch(52% 0.01 250);
  --color-muted-strong: oklch(55% 0.01 250);

  --color-weekend-solid: oklch(90% 0.004 250);
  --color-weekend-fill: oklch(96% 0.003 250);
  --color-weekend-text: oklch(75% 0.005 250);

  --color-regular-solid: oklch(55% 0.02 250);
  --color-regular-fill: oklch(93% 0.008 250);
  --color-regular-text: oklch(35% 0.01 250);

  --link-color: oklch(50% 0.1 165);
  --link-color-hover: oklch(42% 0.1 165);
}

* { box-sizing: border-box; }

body {
  margin: 0;
  background: var(--color-bg);
  color: var(--color-text);
  font-family: var(--font-sans);
}

a { color: var(--link-color); }
a:hover { color: var(--link-color-hover); }
```

- [ ] **Step 2: Implement `js/calendar-heatmap.js`**

```js
import { enumerateMonths, monthGridDays, isWithinPeriod, isWeekend, datesInRange } from './date-utils.js';
import { escapeHtml } from './html-utils.js';

const DOW_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function categoryFill(color) {
  return `color-mix(in srgb, ${color} 30%, white)`;
}

function computeStats(periodStart, periodEnd, categories) {
  const categorySets = categories.map((c) => ({ name: c.name, color: c.color, dates: new Set(c.dates) }));

  let regularCount = 0;
  for (const dateStr of datesInRange(periodStart, periodEnd)) {
    const claimed = categorySets.some((c) => c.dates.has(dateStr));
    if (!claimed && !isWeekend(dateStr)) regularCount++;
  }

  const categoryStats = categorySets.map((c) => ({
    name: c.name,
    solid: c.color,
    fill: categoryFill(c.color),
    count: [...c.dates].filter((d) => isWithinPeriod(d, periodStart, periodEnd)).length,
  }));

  return [
    { name: 'Regular workday', solid: 'var(--color-regular-solid)', fill: 'var(--color-regular-fill)', count: regularCount },
    ...categoryStats,
  ];
}

function resolveDay(dateStr, periodStart, periodEnd, categorySets) {
  if (!isWithinPeriod(dateStr, periodStart, periodEnd)) return null;
  for (const category of categorySets) {
    if (category.dates.has(dateStr)) {
      return { name: category.name, fill: categoryFill(category.color), text: 'var(--color-text)' };
    }
  }
  if (isWeekend(dateStr)) {
    return { name: 'Weekend', fill: 'var(--color-weekend-fill)', text: 'var(--color-weekend-text)' };
  }
  return { name: 'Regular workday', fill: 'var(--color-regular-fill)', text: 'var(--color-regular-text)' };
}

const STYLES = `
  :host { display: block; font-family: var(--font-sans); color: var(--color-text); }
  .header { border-bottom: 1px solid var(--color-border); padding-bottom: 18px; margin-bottom: 22px; }
  .period { font-size: 28px; font-weight: 700; }
  .stats {
    display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 1px;
    background: var(--color-border); border: 1px solid var(--color-border); margin-bottom: 26px;
  }
  .stat { background: var(--color-panel); padding: 16px 18px; display: flex; flex-direction: column; gap: 8px; }
  .stat-bar { height: 4px; width: 28px; border-radius: 1px; }
  .stat-count { font-family: var(--font-mono); font-size: 34px; font-weight: 600; line-height: 1; }
  .stat-label { font-size: 11.5px; letter-spacing: 0.04em; color: var(--color-muted); font-weight: 500; }
  .legend {
    display: flex; flex-wrap: wrap; gap: 18px; align-items: center; padding: 10px 14px;
    background: var(--color-panel); border: 1px solid var(--color-border); margin-bottom: 28px;
  }
  .legend-title {
    font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase;
    color: var(--color-muted-strong); font-weight: 600; margin-right: 4px;
  }
  .legend-item { display: flex; align-items: center; gap: 7px; font-size: 12.5px; }
  .legend-swatch { width: 12px; height: 12px; border-radius: 2px; border: 1px solid var(--color-border); flex-shrink: 0; }
  .months { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 20px; }
  .month-card { background: var(--color-panel); border: 1px solid var(--color-border); }
  .month-head {
    padding: 10px 14px; border-bottom: 1px solid var(--color-border); font-weight: 600; font-size: 14px;
    display: flex; justify-content: space-between; align-items: baseline;
  }
  .month-year { font-family: var(--font-mono); font-size: 11px; color: var(--color-muted-strong); font-weight: 500; }
  .dow-row { display: grid; grid-template-columns: repeat(7, 1fr); background: var(--color-border); gap: 1px; }
  .dow {
    background: oklch(96% 0.004 250); text-align: center; font-size: 10px; font-weight: 600;
    letter-spacing: 0.04em; color: var(--color-muted-strong); padding: 5px 0;
  }
  .day-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 1px; background: var(--color-border); padding-bottom: 1px; }
  .day {
    aspect-ratio: 1; display: flex; align-items: flex-start; justify-content: flex-start;
    padding: 4px 5px; box-sizing: border-box; font-family: var(--font-mono); font-size: 11px; font-weight: 500;
  }
  .day.out { background: transparent; }
  .day[data-date] { cursor: pointer; }
`;

export class CalendarHeatmap extends HTMLElement {
  #config = null;
  #paintActive = false;

  static get observedAttributes() {
    return ['paint-active'];
  }

  connectedCallback() {
    if (!this.shadowRoot) this.attachShadow({ mode: 'open' });
    this.render();
  }

  attributeChangedCallback(name, _oldValue, newValue) {
    if (name === 'paint-active') {
      this.#paintActive = newValue !== null;
      this.render();
    }
  }

  set config(value) {
    this.#config = value;
    this.render();
  }

  get config() {
    return this.#config;
  }

  render() {
    if (!this.shadowRoot || !this.#config) return;
    const { periodStart, periodEnd, categories } = this.#config;
    const categorySets = categories.map((c) => ({ name: c.name, color: c.color, dates: new Set(c.dates) }));
    const stats = computeStats(periodStart, periodEnd, categories);
    const legend = [
      ...stats,
      { name: 'Weekend', solid: 'var(--color-weekend-solid)', fill: 'var(--color-weekend-fill)', count: null },
    ];
    const months = enumerateMonths(periodStart, periodEnd);

    this.shadowRoot.innerHTML = `
      <style>${STYLES}</style>
      <div class="header"><div class="period">${escapeHtml(periodStart)} – ${escapeHtml(periodEnd)}</div></div>
      <div class="stats">
        ${stats.map((s) => `
          <div class="stat">
            <div class="stat-bar" style="background:${s.solid}"></div>
            <div class="stat-count">${s.count}</div>
            <div class="stat-label">${escapeHtml(s.name)}</div>
          </div>
        `).join('')}
      </div>
      <div class="legend">
        <span class="legend-title">Legend</span>
        ${legend.map((l) => `
          <div class="legend-item">
            <span class="legend-swatch" style="background:${l.fill}"></span>
            <span>${escapeHtml(l.name)}</span>
          </div>
        `).join('')}
      </div>
      <div class="months">
        ${months.map((m) => this.#renderMonth(m, periodStart, periodEnd, categorySets)).join('')}
      </div>
    `;

    if (this.#paintActive) {
      this.shadowRoot.querySelectorAll('[data-date]').forEach((cell) => {
        cell.addEventListener('click', () => {
          this.dispatchEvent(new CustomEvent('day-click', {
            detail: { date: cell.dataset.date },
            bubbles: true,
            composed: true,
          }));
        });
      });
    }
  }

  #renderMonth(month, periodStart, periodEnd, categorySets) {
    const cells = monthGridDays(month.year, month.month);
    return `
      <div class="month-card">
        <div class="month-head"><span>${escapeHtml(month.name)}</span><span class="month-year">${month.year}</span></div>
        <div class="dow-row">${DOW_LABELS.map((l) => `<div class="dow">${l}</div>`).join('')}</div>
        <div class="day-grid">${cells.map((cell) => this.#renderCell(cell, periodStart, periodEnd, categorySets)).join('')}</div>
      </div>
    `;
  }

  #renderCell(cell, periodStart, periodEnd, categorySets) {
    if (!cell) return '<div class="day out"></div>';
    const info = resolveDay(cell.date, periodStart, periodEnd, categorySets);
    if (!info) return '<div class="day out"></div>';
    const clickableAttr = this.#paintActive ? ` data-date="${cell.date}"` : '';
    return `
      <div class="day"${clickableAttr} title="${escapeHtml(cell.date)} — ${escapeHtml(info.name)}" style="background:${info.fill}">
        <span style="color:${info.text}">${cell.day}</span>
      </div>
    `;
  }
}

customElements.define('calendar-heatmap', CalendarHeatmap);
```

- [ ] **Step 3: Create scaffold `index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Calendar heatmap</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="./css/tokens.css">
</head>
<body>
  <div style="padding: 36px 44px 48px;">
    <calendar-heatmap></calendar-heatmap>
  </div>
  <script type="module">
    import './js/calendar-heatmap.js';
    import { defaultConfig } from './js/default-config.js';
    document.querySelector('calendar-heatmap').config = defaultConfig;
  </script>
</body>
</html>
```

- [ ] **Step 4: Manually verify in a browser**

Run: `python3 -m http.server 8000` (ES module `import` needs `http://`, not `file://`)
Open `http://localhost:8000/` and confirm:
- A header shows "2026-02-01 – 2026-07-31".
- 5 stat tiles (Regular workday, On-call rotation, Team offsite, Training day, Time off) with plausible counts.
- A 6-entry legend including "Weekend".
- 6 month cards, February–July 2026, each a 7-column grid with correct leading/trailing blanks.
- Hovering June 1 shows a tooltip reading `2026-06-01 — Team offsite`; hovering May 18 reads `... — On-call rotation`; a Saturday/Sunday cell is pale gray.

- [ ] **Step 5: Commit**

```bash
git add css/tokens.css js/calendar-heatmap.js index.html
git commit -m "feat(calendar-heatmap): render month grids, stats, and legend"
```

---

### Task 4: `<calendar-config-form>`

**Files:**
- Create: `js/calendar-config-form.js`
- Modify: `index.html`

**Interfaces:**
- Consumes: `datesInRange`, `collapseDatesToRanges` from `js/date-utils.js`; `escapeHtml` from `js/html-utils.js` (Task 1).
- Produces: custom element `<calendar-config-form>` with property `config: Config` (setter, clones and renders), events `config-change` (`CustomEvent<Config>`, bubbles, composed — fired on every committed edit) and `paint-tool-change` (`CustomEvent<{categoryId: string | null}>` — `categoryId` is `null` for "off", `'erase'`, or a category's `id`).
- Note: color inputs in this component are always `<input type="color">`, never free text — this is what lets `calendar-heatmap.js` and this file treat `category.color` as safe to interpolate into `style="..."` without escaping.

- [ ] **Step 1: Implement `js/calendar-config-form.js`**

```js
import { datesInRange, collapseDatesToRanges } from './date-utils.js';
import { escapeHtml } from './html-utils.js';

let nextCategorySeq = 1;

const STYLES = `
  :host { display: block; font-family: var(--font-sans); color: var(--color-text); font-size: 13px; }
  fieldset { border: 1px solid var(--color-border); border-radius: 4px; margin: 0 0 16px; padding: 12px; }
  legend { font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--color-muted-strong); font-weight: 600; padding: 0 4px; }
  label { display: block; font-size: 12px; font-weight: 500; margin: 8px 0 4px; }
  input[type="text"], input[type="date"], textarea {
    width: 100%; box-sizing: border-box; font: inherit; padding: 6px 8px;
    border: 1px solid var(--color-border); border-radius: 3px;
  }
  input[type="color"] { width: 40px; height: 28px; padding: 0; border: 1px solid var(--color-border); border-radius: 3px; }
  .period-row { display: flex; gap: 10px; }
  .period-row > div { flex: 1; }
  .category { border: 1px solid var(--color-border); border-radius: 4px; padding: 10px; margin-bottom: 10px; }
  .category-head { display: flex; align-items: center; gap: 8px; }
  .category-head input[type="text"] { flex: 1; }
  .range-row { display: flex; align-items: center; gap: 6px; margin-top: 6px; }
  .range-row input[type="date"] { flex: 1; }
  .range-error { color: oklch(50% 0.18 25); font-size: 11px; margin-top: 4px; }
  button { font: inherit; cursor: pointer; border: 1px solid var(--color-border); background: var(--color-panel); border-radius: 3px; padding: 4px 8px; }
  button.icon { padding: 4px 6px; }
  .paint-options { display: flex; flex-direction: column; gap: 6px; }
  .paint-options label { display: flex; align-items: center; gap: 6px; font-weight: 400; margin: 0; }
`;

export class CalendarConfigForm extends HTMLElement {
  #config = null;
  #paintTool = null;

  connectedCallback() {
    if (!this.shadowRoot) this.attachShadow({ mode: 'open' });
    this.render();
  }

  set config(value) {
    this.#config = structuredClone(value);
    this.render();
  }

  get config() {
    return this.#config;
  }

  #emitConfigChange() {
    this.dispatchEvent(new CustomEvent('config-change', {
      detail: structuredClone(this.#config),
      bubbles: true,
      composed: true,
    }));
  }

  #emitPaintToolChange() {
    this.dispatchEvent(new CustomEvent('paint-tool-change', {
      detail: { categoryId: this.#paintTool },
      bubbles: true,
      composed: true,
    }));
  }

  render() {
    if (!this.shadowRoot || !this.#config) return;
    const { periodStart, periodEnd, categories, notes } = this.#config;

    this.shadowRoot.innerHTML = `
      <style>${STYLES}</style>
      <fieldset>
        <legend>Period</legend>
        <div class="period-row">
          <div><label for="period-start">Start</label><input type="date" id="period-start" value="${periodStart}"></div>
          <div><label for="period-end">End</label><input type="date" id="period-end" value="${periodEnd}"></div>
        </div>
      </fieldset>

      <fieldset>
        <legend>Categories</legend>
        ${categories.map((category, index) => this.#renderCategory(category, index)).join('')}
        <button type="button" id="add-category">+ Add category</button>
      </fieldset>

      <fieldset>
        <legend>Paint</legend>
        <div class="paint-options">
          <label><input type="radio" name="paint" value="" ${this.#paintTool === null ? 'checked' : ''}> Off</label>
          ${categories.map((c) => `
            <label><input type="radio" name="paint" value="${c.id}" ${this.#paintTool === c.id ? 'checked' : ''}> ${escapeHtml(c.name)}</label>
          `).join('')}
          <label><input type="radio" name="paint" value="erase" ${this.#paintTool === 'erase' ? 'checked' : ''}> Erase</label>
        </div>
      </fieldset>

      <fieldset>
        <legend>Notes</legend>
        <textarea id="notes" rows="4">${escapeHtml(notes ?? '')}</textarea>
      </fieldset>
    `;

    this.#attachListeners();
  }

  #renderCategory(category, index) {
    const ranges = collapseDatesToRanges(category.dates);
    return `
      <div class="category" data-category-index="${index}">
        <div class="category-head">
          <input type="color" data-role="color" value="${category.color}">
          <input type="text" data-role="name" value="${escapeHtml(category.name)}">
          <button type="button" class="icon" data-role="move-up" title="Higher priority">↑</button>
          <button type="button" class="icon" data-role="move-down" title="Lower priority">↓</button>
          <button type="button" class="icon" data-role="delete-category" title="Delete category">✕</button>
        </div>
        ${ranges.map((range, rangeIndex) => `
          <div class="range-row" data-range-index="${rangeIndex}">
            <input type="date" data-role="range-start" value="${range.start}">
            <span>–</span>
            <input type="date" data-role="range-end" value="${range.end}">
            <button type="button" class="icon" data-role="delete-range" title="Remove range">✕</button>
          </div>
        `).join('')}
        <button type="button" data-role="add-range">+ Add range</button>
      </div>
    `;
  }

  #attachListeners() {
    const root = this.shadowRoot;

    root.getElementById('period-start').addEventListener('change', (e) => {
      this.#config.periodStart = e.target.value;
      this.#emitConfigChange();
    });
    root.getElementById('period-end').addEventListener('change', (e) => {
      this.#config.periodEnd = e.target.value;
      this.#emitConfigChange();
    });
    root.getElementById('notes').addEventListener('input', (e) => {
      this.#config.notes = e.target.value;
      this.#emitConfigChange();
    });
    root.getElementById('add-category').addEventListener('click', () => {
      this.#config.categories.push({
        id: `category-${Date.now()}-${nextCategorySeq++}`,
        name: 'New category',
        color: '#4488ff',
        dates: [],
      });
      this.#emitConfigChange();
      this.render();
    });

    root.querySelectorAll('input[name="paint"]').forEach((radio) => {
      radio.addEventListener('change', (e) => {
        this.#paintTool = e.target.value || null;
        this.#emitPaintToolChange();
      });
    });

    root.querySelectorAll('.category').forEach((categoryEl) => {
      const index = Number(categoryEl.dataset.categoryIndex);
      const category = this.#config.categories[index];

      categoryEl.querySelector('[data-role="color"]').addEventListener('input', (e) => {
        category.color = e.target.value;
        this.#emitConfigChange();
      });
      categoryEl.querySelector('[data-role="name"]').addEventListener('input', (e) => {
        category.name = e.target.value;
        this.#emitConfigChange();
      });
      categoryEl.querySelector('[data-role="delete-category"]').addEventListener('click', () => {
        this.#config.categories.splice(index, 1);
        this.#emitConfigChange();
        this.render();
      });
      categoryEl.querySelector('[data-role="move-up"]').addEventListener('click', () => {
        if (index === 0) return;
        const [moved] = this.#config.categories.splice(index, 1);
        this.#config.categories.splice(index - 1, 0, moved);
        this.#emitConfigChange();
        this.render();
      });
      categoryEl.querySelector('[data-role="move-down"]').addEventListener('click', () => {
        if (index === this.#config.categories.length - 1) return;
        const [moved] = this.#config.categories.splice(index, 1);
        this.#config.categories.splice(index + 1, 0, moved);
        this.#emitConfigChange();
        this.render();
      });
      categoryEl.querySelector('[data-role="add-range"]').addEventListener('click', () => {
        const today = new Date().toISOString().slice(0, 10);
        category.dates = [...new Set([...category.dates, today])].sort();
        this.#emitConfigChange();
        this.render();
      });

      categoryEl.querySelectorAll('.range-row').forEach((rowEl) => {
        const rangeIndex = Number(rowEl.dataset.rangeIndex);
        const startInput = rowEl.querySelector('[data-role="range-start"]');
        const endInput = rowEl.querySelector('[data-role="range-end"]');

        const commitRange = () => {
          const ranges = collapseDatesToRanges(category.dates);
          const oldRange = ranges[rangeIndex];
          const newStart = startInput.value;
          const newEnd = endInput.value;
          if (!newStart || !newEnd || newStart > newEnd) {
            this.#showRangeError(rowEl, 'Start must be on or before end.');
            return;
          }
          const oldDates = new Set(datesInRange(oldRange.start, oldRange.end));
          const withoutOldRange = category.dates.filter((d) => !oldDates.has(d));
          category.dates = [...new Set([...withoutOldRange, ...datesInRange(newStart, newEnd)])].sort();
          this.#emitConfigChange();
          this.render();
        };

        startInput.addEventListener('change', commitRange);
        endInput.addEventListener('change', commitRange);
      });

      categoryEl.querySelectorAll('[data-role="delete-range"]').forEach((btn, rangeIndex) => {
        btn.addEventListener('click', () => {
          const ranges = collapseDatesToRanges(category.dates);
          const range = ranges[rangeIndex];
          const removed = new Set(datesInRange(range.start, range.end));
          category.dates = category.dates.filter((d) => !removed.has(d));
          this.#emitConfigChange();
          this.render();
        });
      });
    });
  }

  #showRangeError(rowEl, message) {
    let errorEl = rowEl.nextElementSibling;
    if (!errorEl || !errorEl.classList.contains('range-error')) {
      errorEl = document.createElement('div');
      errorEl.className = 'range-error';
      rowEl.after(errorEl);
    }
    errorEl.textContent = message;
  }
}

customElements.define('calendar-config-form', CalendarConfigForm);
```

- [ ] **Step 2: Wire it into `index.html` for manual testing**

Replace the `<script type="module">` block in `index.html` with:

```html
  <div style="display: grid; grid-template-columns: 320px 1fr;">
    <div style="padding: 16px; border-right: 1px solid var(--color-border);">
      <calendar-config-form></calendar-config-form>
    </div>
    <div style="padding: 36px 44px 48px;">
      <calendar-heatmap></calendar-heatmap>
    </div>
  </div>
  <script type="module">
    import './js/calendar-heatmap.js';
    import './js/calendar-config-form.js';
    import { defaultConfig } from './js/default-config.js';

    const heatmap = document.querySelector('calendar-heatmap');
    const form = document.querySelector('calendar-config-form');
    heatmap.config = defaultConfig;
    form.config = defaultConfig;
    form.addEventListener('config-change', (e) => {
      console.log('config-change', e.detail);
      heatmap.config = e.detail;
    });
    form.addEventListener('paint-tool-change', (e) => console.log('paint-tool-change', e.detail));
  </script>
```

(This wiring is temporary — Task 5 replaces it with `<calendar-app>`.)

- [ ] **Step 3: Manually verify in a browser**

Run: `python3 -m http.server 8000`, open `http://localhost:8000/`, open devtools console, and confirm:
- Editing the period start/end updates the calendar.
- Editing a category's name or color (native color picker) updates the calendar immediately and logs a `config-change` event.
- Editing a range's start/end date updates the calendar's colored cells for the affected days.
- Typing an end date before the start date shows an inline error and does not update the calendar.
- "+ Add category" adds a new gray-blue category row with no ranges; "+ Add range" on it adds today; deleting the category or a range updates the calendar.
- Selecting a category under "Paint" and then "Off" logs two `paint-tool-change` events with the expected `categoryId`.

- [ ] **Step 4: Commit**

```bash
git add js/calendar-config-form.js index.html
git commit -m "feat(calendar-config-form): add gutter form for period and categories"
```

---

### Task 5: `<calendar-app>` shell — persistence, gutter toggle, click-to-paint

**Files:**
- Create: `js/calendar-app.js`
- Modify: `index.html`

**Interfaces:**
- Consumes: `defaultConfig` from `js/default-config.js`; `escapeHtml` from `js/html-utils.js` (Task 1); `<calendar-heatmap>` and `<calendar-config-form>` from Tasks 3–4 (their properties/events as documented there).
- Produces: custom element `<calendar-app>`, the app's sole top-level element.

- [ ] **Step 1: Implement `js/calendar-app.js`**

```js
import { defaultConfig } from './default-config.js';
import { escapeHtml } from './html-utils.js';
import './calendar-heatmap.js';
import './calendar-config-form.js';

const STORAGE_KEY = 'calendar-heatmap-config';

function isValidConfig(value) {
  return (
    value &&
    typeof value.periodStart === 'string' &&
    typeof value.periodEnd === 'string' &&
    Array.isArray(value.categories)
  );
}

function loadConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(defaultConfig);
    const parsed = JSON.parse(raw);
    return isValidConfig(parsed) ? parsed : structuredClone(defaultConfig);
  } catch (err) {
    console.warn('calendar-app: discarding invalid stored config', err);
    return structuredClone(defaultConfig);
  }
}

const STYLES = `
  :host { display: block; }
  .layout { display: grid; grid-template-columns: 320px 1fr; min-height: 100vh; }
  .layout.collapsed { grid-template-columns: 0 1fr; }
  .gutter {
    overflow: hidden; border-right: 1px solid var(--color-border);
    background: var(--color-panel); padding: 16px; box-sizing: border-box;
  }
  .layout.collapsed .gutter { padding: 0; border-right: none; }
  .main { padding: 36px 44px 48px; box-sizing: border-box; min-width: 0; }
  .notes { margin-top: 26px; font-size: 11.5px; line-height: 1.6; color: var(--color-muted); max-width: 900px; }
  .toggle {
    position: fixed; top: 12px; left: 12px; z-index: 10; font: inherit; cursor: pointer;
    border: 1px solid var(--color-border); background: var(--color-panel); border-radius: 3px; padding: 6px 10px;
  }
`;

export class CalendarApp extends HTMLElement {
  #config;
  #paintTool = null;
  #saveTimer = null;

  connectedCallback() {
    this.#config = loadConfig();
    if (!this.shadowRoot) this.attachShadow({ mode: 'open' });
    this.render();
  }

  render() {
    const collapsedClass = this.#config.gutterOpen ? '' : ' collapsed';
    this.shadowRoot.innerHTML = `
      <style>${STYLES}</style>
      <button class="toggle" id="toggle">${this.#config.gutterOpen ? 'Hide form' : 'Show form'}</button>
      <div class="layout${collapsedClass}">
        <div class="gutter"><calendar-config-form id="form"></calendar-config-form></div>
        <div class="main">
          <calendar-heatmap id="heatmap"></calendar-heatmap>
          ${this.#config.notes ? `<div class="notes">${escapeHtml(this.#config.notes)}</div>` : ''}
        </div>
      </div>
    `;
    this.#wireChildren();
  }

  #wireChildren() {
    const form = this.shadowRoot.getElementById('form');
    const heatmap = this.shadowRoot.getElementById('heatmap');

    form.config = this.#config;
    heatmap.config = this.#config;
    this.#syncPaintAttribute(heatmap);

    this.shadowRoot.getElementById('toggle').addEventListener('click', () => {
      this.#config.gutterOpen = !this.#config.gutterOpen;
      this.#persist();
      this.render();
    });

    form.addEventListener('config-change', (e) => {
      this.#config = e.detail;
      this.#persist();
      heatmap.config = this.#config;
    });

    form.addEventListener('paint-tool-change', (e) => {
      this.#paintTool = e.detail.categoryId;
      this.#syncPaintAttribute(heatmap);
    });

    heatmap.addEventListener('day-click', (e) => {
      this.#applyPaint(e.detail.date, form, heatmap);
    });
  }

  #syncPaintAttribute(heatmap) {
    if (this.#paintTool) heatmap.setAttribute('paint-active', '');
    else heatmap.removeAttribute('paint-active');
  }

  #applyPaint(dateStr, form, heatmap) {
    if (!this.#paintTool) return;
    for (const category of this.#config.categories) {
      category.dates = category.dates.filter((d) => d !== dateStr);
    }
    if (this.#paintTool !== 'erase') {
      const category = this.#config.categories.find((c) => c.id === this.#paintTool);
      if (category) category.dates = [...category.dates, dateStr].sort();
    }
    this.#persist();
    form.config = this.#config;
    heatmap.config = this.#config;
  }

  #persist() {
    clearTimeout(this.#saveTimer);
    this.#saveTimer = setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.#config));
    }, 200);
  }
}

customElements.define('calendar-app', CalendarApp);
```

- [ ] **Step 2: Replace `index.html`'s body with the final shell**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Calendar heatmap</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="./css/tokens.css">
</head>
<body>
  <calendar-app></calendar-app>
  <script type="module" src="./js/calendar-app.js"></script>
</body>
</html>
```

- [ ] **Step 3: Manually verify in a browser (full checklist from the spec)**

Run: `python3 -m http.server 8000`, open `http://localhost:8000/`, clear `localStorage` first (devtools → Application → Local Storage → delete `calendar-heatmap-config`, then reload) and confirm:
- Default example renders correctly (same visual check as Task 3), and the notes paragraph appears below the calendar.
- Editing period dates updates the month cards.
- Adding/editing/removing a category and its ranges updates cells, stats, and legend; an invalid range (start > end) is rejected inline.
- Selecting a category under "Paint", clicking a few blank/regular days on the calendar, paints them that category's color; the form's range list for that category updates to include the new day(s), merged into an adjacent range when contiguous.
- Selecting "Erase" and clicking a colored day clears it back to Weekend/Regular.
- Reloading the page after any of the above preserves the change (persisted via `localStorage`).
- Clicking "Hide form" collapses the gutter to a full-width calendar suitable for a screenshot; the button now reads "Show form" and clicking it again restores the gutter. Reloading preserves the open/closed state.

- [ ] **Step 4: Commit**

```bash
git add js/calendar-app.js index.html
git commit -m "feat(calendar-app): wire persistence, gutter toggle, and click-to-paint"
```
