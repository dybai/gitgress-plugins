import { formatBlameFullDate, formatBlameRelativeTime } from './relativeTime';

export type BlameHoverMarkdownInput = {
  commitId: string;
  authorName: string;
  authorTimeUnix: number;
  summary: string;
  fullMessage: string;
  additions: number;
  deletions: number;
  nowMs: number;
  locale: string;
};

function commandLink(command: string, commitId: string): string {
  return `command:${command}?${encodeURIComponent(JSON.stringify([commitId]))}`;
}

/**
 * Build the trusted-markdown body for the editor blame hover.
 * Returned as a plain string; `BlameHoverProvider` wraps it in
 * `new vscode.MarkdownString(text, true)`.
 */
export function buildBlameHoverMarkdown(input: BlameHoverMarkdownInput): string {
  const {
    commitId,
    authorName,
    authorTimeUnix,
    summary,
    fullMessage,
    additions,
    deletions,
    nowMs,
    locale,
  } = input;

  const body = fullMessage.trim() !== '' ? fullMessage.trim() : summary;
  const bodyLines = body.split('\n');
  const subject = bodyLines[0] !== undefined && bodyLines[0].trim() !== '' ? bodyLines[0].trim() : summary;
  const restLines = bodyLines.slice(1);
  const bodyText = restLines.join('\n').trim();

  const lines: string[] = [];
  lines.push(`**${escapeMarkdownText(subject)}**`);
  if (bodyText !== '') {
    lines.push('');
    lines.push(bodyText);
  }
  lines.push('');
  lines.push('---');
  lines.push('');
  const footer = `${authorName}, ${formatBlameRelativeTime(
    authorTimeUnix,
    nowMs,
    locale,
  )} (${formatBlameFullDate(authorTimeUnix, locale)})`;
  lines.push(`${escapeMarkdownText(footer)} · \u002B${additions} \u2212${deletions}`);
  lines.push('');
  lines.push(
    `[$(git-commit) ${commitId.slice(0, 7)}](${commandLink('gitgress.revealFromBlame', commitId)} "Reveal in GitGress") ` +
      `[$(copy)](${commandLink('gitgress.copyBlameHash', commitId)} "Copy Hash")`,
  );
  return lines.join('\n');
}

/**
 * Escape text meant to be shown verbatim outside code spans. Only the
 * characters markdown treats specially outside links are escaped.
 */
function escapeMarkdownText(text: string): string {
  return text.replace(/([\\`*_{}[\]()#+!])/g, '\\$1');
}
