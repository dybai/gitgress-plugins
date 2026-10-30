function toMs(isoOrUnixSeconds: string | number): number {
  if (typeof isoOrUnixSeconds === 'number') {
    return isoOrUnixSeconds * 1000;
  }
  const asNumber = Number(isoOrUnixSeconds);
  if (Number.isFinite(asNumber) && !isoOrUnixSeconds.includes('-') && !isoOrUnixSeconds.includes('T')) {
    return asNumber * 1000;
  }
  return Date.parse(isoOrUnixSeconds);
}

export function formatBlameRelativeTime(
  isoOrUnixSeconds: string | number,
  nowMs: number,
  locale: string,
): string {
  const thenMs = toMs(isoOrUnixSeconds);
  if (Number.isNaN(thenMs)) {
    return String(isoOrUnixSeconds);
  }
  const diffSec = Math.round((thenMs - nowMs) / 1000);
  const abs = Math.abs(diffSec);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  if (abs < 60) return rtf.format(diffSec, 'second');
  const minutes = Math.round(diffSec / 60);
  if (Math.abs(minutes) < 60) return rtf.format(minutes, 'minute');
  const hours = Math.round(diffSec / 3600);
  if (Math.abs(hours) < 24) return rtf.format(hours, 'hour');
  const days = Math.round(diffSec / 86400);
  if (Math.abs(days) < 30) return rtf.format(days, 'day');
  const months = Math.round(diffSec / (30 * 86400));
  if (Math.abs(months) < 12) return rtf.format(months, 'month');
  return rtf.format(Math.round(diffSec / (365 * 86400)), 'year');
}

function ordinal(n: number): string {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

export function formatBlameFullDate(unixSeconds: number, locale: string): string {
  const date = new Date(unixSeconds * 1000);
  if (Number.isNaN(date.getTime())) {
    return String(unixSeconds);
  }
  const lang = (locale || 'en').toLowerCase();
  if (lang.startsWith('zh')) {
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${hh}:${mm}`;
  }
  if (lang.startsWith('en')) {
    const month = date.toLocaleString('en-US', { month: 'long' });
    const ampm = date.getHours() < 12 ? 'AM' : 'PM';
    const h12 = date.getHours() % 12 === 0 ? 12 : date.getHours() % 12;
    const min = String(date.getMinutes()).padStart(2, '0');
    return `${month} ${ordinal(date.getDate())}, ${date.getFullYear()} ${h12}:${min} ${ampm}`;
  }
  return `${new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(date)} ${new Intl.DateTimeFormat(locale, { timeStyle: 'short' }).format(date)}`;
}

export function formatBlameAnnotation(
  author: string,
  authorTimeUnix: number,
  nowMs: number,
  locale: string,
  // Defaults to '' so the hover footer (a 4-arg caller we must not touch)
  // keeps rendering `author, time (MM-DD)` unchanged.
  summary: string = '',
): string {
  const relative = formatBlameRelativeTime(authorTimeUnix, nowMs, locale);
  const date = new Date(authorTimeUnix * 1000);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const prefix = `${author}, ${relative} (${mm}-${dd})`;
  const trimmed = summary.trim();
  if (trimmed === '') {
    return prefix;
  }
  const message = trimmed.length > 50 ? `${trimmed.slice(0, 47)}…` : trimmed;
  return `${prefix} • ${message}`;
}
