import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml } from '../js/html-utils.js';

test('escapeHtml escapes the five HTML-significant characters', () => {
  assert.equal(escapeHtml(`<b>"a" & 'b'</b>`), '&lt;b&gt;&quot;a&quot; &amp; &#39;b&#39;&lt;/b&gt;');
});

test('escapeHtml coerces non-string input', () => {
  assert.equal(escapeHtml(42), '42');
});
