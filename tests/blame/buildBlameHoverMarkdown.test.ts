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
});
