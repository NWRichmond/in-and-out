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
