import { defaultConfig } from './default-config.js';
import { isValidHexColor } from './html-utils.js';
import './calendar-heatmap.js';
import './calendar-config-form.js';

const STORAGE_KEY = 'calendar-heatmap-config';

function isValidCategory(value) {
  return (
    value &&
    typeof value === 'object' &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    isValidHexColor(value.color) &&
    Array.isArray(value.dates) &&
    value.dates.every((d) => typeof d === 'string')
  );
}

function isValidConfig(value) {
  return (
    value &&
    typeof value === 'object' &&
    typeof value.periodStart === 'string' &&
    typeof value.periodEnd === 'string' &&
    Array.isArray(value.categories) &&
    value.categories.every(isValidCategory)
  );
}

function loadConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(defaultConfig);
    const parsed = JSON.parse(raw);
    if (!isValidConfig(parsed)) {
      console.warn('calendar-app: discarding invalid or schema-mismatched stored config', parsed);
      return structuredClone(defaultConfig);
    }
    if (typeof parsed.gutterOpen !== 'boolean') parsed.gutterOpen = true;
    return parsed;
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

  /** Builds the shell DOM once. Never called again after connectedCallback. */
  render() {
    this.shadowRoot.innerHTML = `
      <style>${STYLES}</style>
      <button class="toggle" id="toggle"></button>
      <div class="layout" id="layout">
        <div class="gutter"><calendar-config-form id="form"></calendar-config-form></div>
        <div class="main">
          <calendar-heatmap id="heatmap"></calendar-heatmap>
        </div>
      </div>
    `;
    this.#wireChildren();
    this.#applyGutterState();
    this.#renderNotes();
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
      this.#applyGutterState();
    });

    form.addEventListener('config-change', (e) => {
      this.#config = e.detail;
      this.#reconcilePaintTool(form, heatmap);
      this.#persist();
      heatmap.config = this.#config;
      this.#renderNotes();
    });

    form.addEventListener('paint-tool-change', (e) => {
      this.#paintTool = e.detail.categoryId;
      this.#syncPaintAttribute(heatmap);
    });

    heatmap.addEventListener('day-click', (e) => {
      this.#applyPaint(e.detail.date, form, heatmap);
    });
  }

  /** Flips the gutter's collapsed state without touching its children. */
  #applyGutterState() {
    const layout = this.shadowRoot.getElementById('layout');
    const toggle = this.shadowRoot.getElementById('toggle');
    layout.classList.toggle('collapsed', !this.#config.gutterOpen);
    toggle.textContent = this.#config.gutterOpen ? 'Hide form' : 'Show form';
  }

  /** Creates/updates/removes the `.notes` element to match `this.#config.notes`. */
  #renderNotes() {
    const main = this.shadowRoot.querySelector('.main');
    let notesEl = main.querySelector('.notes');
    const notes = this.#config.notes;
    if (notes) {
      if (!notesEl) {
        notesEl = document.createElement('div');
        notesEl.className = 'notes';
        main.appendChild(notesEl);
      }
      notesEl.textContent = notes;
    } else if (notesEl) {
      notesEl.remove();
    }
  }

  /**
   * If the active paint tool no longer refers to an existing category
   * (e.g. it was just deleted via the form), turns paint mode off and
   * resets the form's displayed selection to "Off" to match.
   */
  #reconcilePaintTool(form, heatmap) {
    if (this.#paintTool === null || this.#paintTool === 'erase') return;
    const stillExists = this.#config.categories.some((c) => c.id === this.#paintTool);
    if (!stillExists) {
      this.#paintTool = null;
      this.#syncPaintAttribute(heatmap);
      form.resetPaintTool();
    }
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
