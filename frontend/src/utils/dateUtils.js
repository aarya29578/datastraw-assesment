/**
 * Utility functions for calendar and date handling in the Roster system
 */

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const DAYS_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Returns total days in a month (month is 1-indexed: 1 = Jan, 11 = Nov)
 */
export function getDaysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

/**
 * Returns day name (e.g., 'Mon', 'Tue') for given year, month (1-indexed), and day
 */
export function getDayOfWeekShort(year, month, day) {
  const date = new Date(year, month - 1, day);
  return DAYS_SHORT[date.getDay()];
}

export function getDayOfWeekFull(year, month, day) {
  const date = new Date(year, month - 1, day);
  return DAYS_FULL[date.getDay()];
}

export function isSunday(year, month, day) {
  const date = new Date(year, month - 1, day);
  return date.getDay() === 0;
}

export function isSaturday(year, month, day) {
  const date = new Date(year, month - 1, day);
  return date.getDay() === 6;
}

export function isWeekend(year, month, day) {
  const date = new Date(year, month - 1, day);
  const dayOfWeek = date.getDay();
  return dayOfWeek === 0 || dayOfWeek === 6;
}

/**
 * Formats YYYY-MM-DD string
 */
export function formatDateKey(year, month, day) {
  const m = String(month).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}-${m}-${d}`;
}

/**
 * Parses YYYY-MM-DD into { year, month, day }
 */
export function parseDateKey(dateStr) {
  if (!dateStr) return { year: 2026, month: 11, day: 1 };
  const [y, m, d] = dateStr.split('-').map(Number);
  return { year: y, month: m, day: d };
}

/**
 * Returns formatted readable date: e.g. "Sun, Nov 15, 2026"
 */
export function formatReadableDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const dayName = DAYS_SHORT[date.getDay()];
  const monthName = MONTH_NAMES[m - 1].slice(0, 3);
  return `${dayName}, ${monthName} ${d}, ${y}`;
}

/**
 * Generates an array of day objects for the entire month
 */
export function getMonthDaysArray(year, month) {
  const totalDays = getDaysInMonth(year, month);
  const days = [];
  for (let d = 1; d <= totalDays; d++) {
    const dayOfWeek = getDayOfWeekShort(year, month, d);
    const fullDayOfWeek = getDayOfWeekFull(year, month, d);
    const dateKey = formatDateKey(year, month, d);
    const isSun = dayOfWeek === 'Sun';
    const isSat = dayOfWeek === 'Sat';

    days.push({
      day: d,
      dateKey,
      dayOfWeek,
      fullDayOfWeek,
      isWeekend: isSun || isSat,
      isSunday: isSun,
      isSaturday: isSat,
    });
  }
  return days;
}
