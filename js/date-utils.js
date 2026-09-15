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
