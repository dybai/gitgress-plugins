export function formatCompactRelativeTime(iso: string, nowMs: number = Date.now()): string {
  const timestamp = Date.parse(iso);
  if (Number.isNaN(timestamp)) {
    return iso;
  }
  const elapsedMinutes = Math.max(0, Math.floor((nowMs - timestamp) / 60000));
  if (elapsedMinutes < 1) {
    return 'just now';
  }
  if (elapsedMinutes < 60) {
    return `${elapsedMinutes}m`;
  }
  const hours = Math.floor(elapsedMinutes / 60);
  if (hours < 24) {
    return `${hours}h`;
  }
  const days = Math.floor(hours / 24);
  if (days < 30) {
    return `${days}d`;
  }
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(timestamp);
}
