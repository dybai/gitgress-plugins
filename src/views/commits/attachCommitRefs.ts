import type { CommitRefDto } from '../../protocol/messages';

export type TipRef = {
  name: string;
  kind: 'local' | 'remote';
  commitId: string;
};

export function attachCommitRefs(
  commitIds: readonly string[],
  tips: readonly TipRef[],
): { refsById: Map<string, CommitRefDto[]>; tipCommitIds: string[] } {
  const refsById = new Map<string, CommitRefDto[]>();
  for (const tip of tips) {
    const existing = refsById.get(tip.commitId) ?? [];
    existing.push({ name: tip.name, kind: tip.kind });
    refsById.set(tip.commitId, existing);
  }

  const tipCommitIds: string[] = [];
  for (const id of commitIds) {
    const refs = refsById.get(id);
    if (refs !== undefined && refs.length > 0) {
      tipCommitIds.push(id);
    }
  }

  return { refsById, tipCommitIds };
}

export function primaryRef(
  refs: readonly CommitRefDto[],
  displayBranch: string,
): CommitRefDto | null {
  if (refs.length === 0) {
    return null;
  }
  const matchingDisplay = refs.find((ref) => ref.name === displayBranch);
  if (matchingDisplay) {
    return matchingDisplay;
  }
  const firstLocal = refs.find((ref) => ref.kind === 'local');
  if (firstLocal) {
    return firstLocal;
  }
  return refs[0] ?? null;
}

/** Remote short label (e.g. "origin") when a remote shares the primary basename on the same tip. */
export function foldRemoteLabel(
  primary: CommitRefDto,
  refs: readonly CommitRefDto[],
): string | null {
  if (primary.kind !== 'local') {
    return null;
  }
  const base = primary.name;
  for (const ref of refs) {
    if (ref.kind !== 'remote') {
      continue;
    }
    const slash = ref.name.indexOf('/');
    if (slash <= 0) {
      continue;
    }
    const remote = ref.name.slice(0, slash);
    const branch = ref.name.slice(slash + 1);
    if (branch === base) {
      return remote;
    }
  }
  return null;
}

export function secondaryRefs(
  refs: readonly CommitRefDto[],
  primary: CommitRefDto,
  foldedRemote: string | null,
): CommitRefDto[] {
  return refs.filter((ref) => {
    if (ref.name === primary.name && ref.kind === primary.kind) {
      return false;
    }
    if (
      foldedRemote !== null &&
      ref.kind === 'remote' &&
      ref.name === `${foldedRemote}/${primary.name}`
    ) {
      return false;
    }
    return true;
  });
}
