import { datesInRange, collapseDatesToRanges, formatDateLocal } from './date-utils.js';
import { escapeHtml, sanitizeColor } from './html-utils.js';

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

  /**
   * Resets the displayed paint-tool selection to "Off" without emitting a
   * `paint-tool-change` event. Used by the host app to reconcile the form
   * when the previously-active paint category is deleted out from under it.
   */
  resetPaintTool() {
    if (this.#paintTool === null) return;
    this.#paintTool = null;
    const offRadio = this.shadowRoot?.querySelector('input[name="paint"][value=""]');
    if (offRadio) offRadio.checked = true;
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
          <div><label for="period-start">Start</label><input type="date" id="period-start" value="${escapeHtml(periodStart)}"></div>
          <div><label for="period-end">End</label><input type="date" id="period-end" value="${escapeHtml(periodEnd)}"></div>
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
            <label><input type="radio" name="paint" value="${escapeHtml(c.id)}" ${this.#paintTool === c.id ? 'checked' : ''}> ${escapeHtml(c.name)}</label>
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
          <input type="color" data-role="color" value="${sanitizeColor(category.color)}">
          <input type="text" data-role="name" value="${escapeHtml(category.name)}">
          <button type="button" class="icon" data-role="move-up" title="Higher priority">↑</button>
          <button type="button" class="icon" data-role="move-down" title="Lower priority">↓</button>
          <button type="button" class="icon" data-role="delete-category" title="Delete category">✕</button>
        </div>
        ${ranges.map((range, rangeIndex) => `
          <div class="range-row" data-range-index="${rangeIndex}">
            <input type="date" data-role="range-start" value="${escapeHtml(range.start)}">
            <span>–</span>
            <input type="date" data-role="range-end" value="${escapeHtml(range.end)}">
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
        const today = formatDateLocal(new Date());
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
