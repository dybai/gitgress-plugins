import { repoShortName } from './repoShortName.js';

export const SELECT_REPOSITORY_LABEL = 'Select repository';
export const SELECT_REPOSITORY_TITLE = 'Select a repository';

export type CommitsHeaderReason =
  | 'commitsLoaded'
  | 'noRepo'
  | 'noSelection'
  | 'noCommits'
  | 'noBranch'
  | 'error';

export type CommitsHeaderInput = {
  reason: CommitsHeaderReason;
  repoRoot?: string | null;
  branch?: string | null;
};

export type CommitsHeaderState = {
  showRepo: boolean;
  repoLabel: string;
  repoTitle: string;
  showBranch: boolean;
  branchLabel: string;
};

const HIDDEN_HEADER: CommitsHeaderState = {
  showRepo: false,
  repoLabel: '',
  repoTitle: '',
  showBranch: false,
  branchLabel: '',
};

/**
 * Decide the Commits header controls for both a loaded list and every empty
 * state. `noRepo` means the workspace index has no repository at all, so both
 * controls would be dead ends and stay hidden; every other reason keeps the
 * repo control visible so the user can pick or change a repository.
 */
export function resolveCommitsHeader(input: CommitsHeaderInput): CommitsHeaderState {
  if (input.reason === 'noRepo') {
    return HIDDEN_HEADER;
  }
  const root = typeof input.repoRoot === 'string' ? input.repoRoot : '';
  const branch = typeof input.branch === 'string' ? input.branch : '';
  const hasRoot = root !== '';
  return {
    showRepo: true,
    repoLabel: hasRoot ? repoShortName(root, []) : SELECT_REPOSITORY_LABEL,
    repoTitle: hasRoot ? root : SELECT_REPOSITORY_TITLE,
    showBranch: branch !== '',
    branchLabel: branch,
  };
}
