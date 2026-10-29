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

export function formatBlameAnnotation(
  author: string,
  authorTimeUnix: number,
  nowMs: number,
  locale: string,
): string {
  const relative = formatBlameRelativeTime(authorTimeUnix, nowMs, locale);
  const date = new Date(authorTimeUnix * 1000);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${author}, ${relative} (${mm}-${dd})`;
}
