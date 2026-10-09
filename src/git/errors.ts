export class GitNotFoundError extends Error {
  constructor() {
    super('Git executable was not found');
    this.name = 'GitNotFoundError';
  }
}

export class NotARepositoryError extends Error {
  constructor(repoRoot: string) {
    super(`Not a Git repository: ${repoRoot}`);
    this.name = 'NotARepositoryError';
  }
}

export class GitCommandFailedError extends Error {
  constructor(
    readonly args: string[],
    readonly stderr: string,
    readonly exitCode?: number | null,
  ) {
    super(stderr || `Git command failed with exit code ${String(exitCode)}`);
    this.name = 'GitCommandFailedError';
    this.args = [...args];
  }
}
