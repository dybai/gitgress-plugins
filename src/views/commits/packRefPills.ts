export function packRefPills(
  widths: readonly number[],
  availableWidth: number,
  moreWidthFor: (hiddenCount: number) => number,
): { visibleCount: number; hiddenCount: number } {
  const n = widths.length;
  if (n === 0) {
    return { visibleCount: 0, hiddenCount: 0 };
  }

  for (let v = n; v >= 1; v--) {
    let sum = 0;
    for (let i = 0; i < v; i++) {
      sum += widths[i]!;
    }
    const more = v < n ? moreWidthFor(n - v) : 0;
    if (sum + more <= availableWidth) {
      return { visibleCount: v, hiddenCount: n - v };
    }
  }

  return { visibleCount: Math.min(1, n), hiddenCount: n - Math.min(1, n) };
}
