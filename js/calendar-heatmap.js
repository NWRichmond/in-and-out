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
