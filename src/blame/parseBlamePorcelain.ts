export type LineBlame = {
  commitId: string;
  authorName: string;
  authorTimeUnix: number;
  summary: string;
};

const ZERO = '0'.repeat(40);

export function parseBlamePorcelain(stdout: string): LineBlame | null {
  const lines = stdout.split('\n');
  if (lines.length === 0 || lines[0].trim() === '') {
    return null;
  }
  const header = lines[0].split(' ');
  const commitId = header[0] ?? '';
  if (commitId.length !== 40 || commitId === ZERO) {
    return null;
  }
  let authorName = '';
  let authorTimeUnix = NaN;
  let summary = '';
  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.startsWith('\t') || line.startsWith('filename ')) {
      break;
    }
    if (line.startsWith('author ')) {
      authorName = line.slice('author '.length);
    } else if (line.startsWith('author-time ')) {
      authorTimeUnix = Number.parseInt(line.slice('author-time '.length), 10);
    } else if (line.startsWith('summary ')) {
      summary = line.slice('summary '.length);
    }
  }
  if (authorName === '' || !Number.isFinite(authorTimeUnix)) {
    return null;
  }
  return { commitId, authorName, authorTimeUnix, summary };
}
