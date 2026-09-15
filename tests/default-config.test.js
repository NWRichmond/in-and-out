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
