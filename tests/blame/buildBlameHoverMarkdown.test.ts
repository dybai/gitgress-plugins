import { describe, expect, it } from 'vitest';
import { buildBlameHoverMarkdown } from '../../src/blame/buildBlameHoverMarkdown';

describe('buildBlameHoverMarkdown', () => {
  it('includes subject, stats, and both command links', () => {
    const md = buildBlameHoverMarkdown({
      commitId: 'a'.repeat(40),
      authorName: 'dybai',
      authorTimeUnix: Math.floor(Date.parse('2026-10-26T00:00:00+08:00') / 1000),
      summary: 'docs: example',
      fullMessage: 'docs: example\n\nbody\n',
      additions: 3,
      deletions: 1,
      nowMs: Date.parse('2026-10-29T12:00:00+08:00'),
      locale: 'en',
    });
    expect(md).toContain('docs: example');
    expect(md).toContain('body');
    expect(md).toContain('+3 −1');
    expect(md).toContain('gitgress.revealFromBlame');
    expect(md).toContain('gitgress.copyBlameHash');
  });

  it('encodes the commitId argument for both command links', () => {
    const commitId = 'b'.repeat(40);
    const md = buildBlameHoverMarkdown({
      commitId,
      authorName: 'dybai',
      authorTimeUnix: 1000,
      summary: 's',
      fullMessage: 's',
      additions: 0,
      deletions: 0,
      nowMs: 2000,
      locale: 'en',
    });
    const args = encodeURIComponent(JSON.stringify([commitId]));
    expect(md).toContain(`command:gitgress.revealFromBlame?${args}`);
    expect(md).toContain(`command:gitgress.copyBlameHash?${args}`);
  });

  it('falls back to the summary time and zero stats shape when details are absent', () => {
    const md = buildBlameHoverMarkdown({
      commitId: 'c'.repeat(40),
      authorName: 'Ann',
      authorTimeUnix: 1000,
      summary: 'only subject',
      fullMessage: 'only subject',
      additions: 0,
      deletions: 0,
      nowMs: 2000,
      locale: 'en',
    });
    expect(md).toContain('only subject');
    expect(md).toContain('Ann');
    expect(md).toContain('+0 −0');
  });

  it('renders the reveal action merged with the short hash and keeps copy beside it', () => {
    const commitId = 'd'.repeat(40);
    const md = buildBlameHoverMarkdown({
      commitId,
      authorName: 'dybai',
      authorTimeUnix: Math.floor(Date.parse('2026-09-02T18:18:00') / 1000),
      summary: 's',
      fullMessage: 's',
      additions: 0,
      deletions: 0,
      nowMs: Date.parse('2026-09-03T18:18:00'),
      locale: 'en',
    });
    const args = encodeURIComponent(JSON.stringify([commitId]));
    const actionLine = md.split('\n').at(-1);
    expect(actionLine).toBe(
      `[$(git-commit) ${commitId.slice(0, 7)}](command:gitgress.revealFromBlame?${args} "Reveal in GitGress") ` +
        `[$(copy)](command:gitgress.copyBlameHash?${args} "Copy Hash")`,
    );
    // The footer is escaped as a whole, so the parentheses around the date
    // appear backslash-escaped in the raw markdown (they render as plain parens).
    expect(md).toContain('\\(September 2nd, 2026 6:18 PM\\)');
  });

  it('keeps codicon tokens unescaped so the icons render', () => {
    const md = buildBlameHoverMarkdown({
      commitId: 'e'.repeat(40),
      authorName: 'dybai',
      authorTimeUnix: 1000,
      summary: 's',
      fullMessage: 's',
      additions: 0,
      deletions: 0,
      nowMs: 2000,
      locale: 'en',
    });
    expect(md).toContain('$(git-commit)');
    expect(md).toContain('$(copy)');
    // The escaped form would break codicon rendering; guard against regressions.
    expect(md).not.toContain('\\$\\(git\\-commit\\)');
    expect(md).not.toContain('\\$\\(copy\\)');
  });
});
