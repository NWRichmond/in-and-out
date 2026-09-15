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
