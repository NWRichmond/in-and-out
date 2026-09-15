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

const HEX_COLOR_RE = /^#[0-9a-f]{6}$/i;

export function isValidHexColor(value) {
  return typeof value === 'string' && HEX_COLOR_RE.test(value);
}

/**
 * Returns `value` if it's a well-formed `#rrggbb` color, otherwise a safe
 * fallback. Used to keep untrusted color strings (e.g. round-tripped through
 * localStorage) out of `style` attributes even when they've already passed
 * schema validation elsewhere.
 */
export function sanitizeColor(value, fallback = '#888888') {
  return isValidHexColor(value) ? value : fallback;
}
