export type TipFingerprintInput = {
  name: string;
  kind: string;
  commitId: string;
};

/** Stable fingerprint of tip refs so remote-only moves can be detected cheaply. */
export function tipsFingerprint(tips: readonly TipFingerprintInput[]): string {
  return [...tips]
    .map((tip) => `${tip.kind}\t${tip.name}\t${tip.commitId}`)
    .sort()
    .join('\n');
}
