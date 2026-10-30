/**
 * Character position that anchors an `after` decoration at the END of a
 * line: VS Code renders `after` content following the range end, so the
 * zero-width range must end at the line's last character (its length), not
 * at column 0 — otherwise the annotation is injected before the code.
 */
export function lineEndCharacter(lineText: string): number {
  return lineText.length;
}
