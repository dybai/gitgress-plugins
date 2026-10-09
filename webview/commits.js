(() => {
  const vscode = acquireVsCodeApi();
  const status = document.querySelector('#status');
  const content = document.querySelector('#content');
  const branchName = document.querySelector('#branch-name');
  const commitList = document.querySelector('#commit-list');
  const switchBranch = document.querySelector('#switch-branch');
  let selectedButton;

  const appendTextElement = (parent, tag, className, text) => {
    const element = document.createElement(tag);
    element.className = className;
    element.textContent = text;
    parent.append(element);
    return element;
  };

  const formatTime = (iso) => {
    const timestamp = Date.parse(iso);
    if (Number.isNaN(timestamp)) {
      return iso;
    }
    const elapsedMinutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
    if (elapsedMinutes < 1) return 'just now';
    if (elapsedMinutes < 60) return `${elapsedMinutes}m ago`;
    const hours = Math.floor(elapsedMinutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(timestamp);
  };

  const appendMeta = (card, label, value) => {
    const term = document.createElement('dt');
    term.textContent = label;
    const detail = document.createElement('dd');
    detail.textContent = value;
    card.append(term, detail);
    return detail;
  };

  const createCommit = (commit, branch) => {
    const item = document.createElement('li');
    item.className = 'commit';

    const button = document.createElement('button');
    button.className = 'commit-button';
    button.type = 'button';
    button.dataset.commitId = commit.id;
    button.setAttribute('aria-label', `${commit.subject}, by ${commit.authorName}`);

    const node = document.createElement('span');
    node.className = 'node';
    node.setAttribute('aria-hidden', 'true');
    const copy = document.createElement('span');
    copy.className = 'commit-copy';
    appendTextElement(copy, 'span', 'subject', commit.subject);
    button.append(node, copy);

    const card = document.createElement('aside');
    card.className = 'hover-card';
    appendTextElement(card, 'p', 'card-message', commit.fullMessage);
    const meta = document.createElement('dl');
    meta.className = 'card-meta';
    appendMeta(meta, 'Author', commit.authorName);
    const time = appendMeta(meta, 'Time', formatTime(commit.authorDateIso));
    time.title = commit.authorDateIso;
    const changes = appendMeta(meta, 'Changes', '');
    appendTextElement(changes, 'span', 'additions', `+${commit.additions}`);
    appendTextElement(changes, 'span', 'deletions', `−${commit.deletions}`);
    appendMeta(meta, 'Branch', branch);
    appendMeta(meta, 'Commit', commit.id);
    card.append(meta);

    button.addEventListener('click', () => {
      if (selectedButton) selectedButton.removeAttribute('aria-current');
      button.setAttribute('aria-current', 'true');
      selectedButton = button;
      vscode.postMessage({ type: 'commitSelected', commitId: commit.id });
    });

    item.append(button, card);
    return item;
  };

  const showStatus = (message, retryable) => {
    selectedButton = undefined;
    content.classList.add('hidden');
    status.classList.remove('hidden');
    status.replaceChildren(document.createTextNode(message));
    if (retryable) {
      const retry = document.createElement('button');
      retry.className = 'quiet-button';
      retry.type = 'button';
      retry.textContent = 'Retry';
      retry.addEventListener('click', () => vscode.postMessage({ type: 'retry' }));
      status.append(retry);
    }
  };

  const renderCommits = (message) => {
    selectedButton = undefined;
    branchName.textContent = message.branch;
    commitList.replaceChildren(
      ...message.commits.map((commit) => createCommit(commit, message.branch)),
    );
    const selectedId = message.selectedCommitId;
    if (typeof selectedId === 'string' && selectedId.length > 0) {
      const button = commitList.querySelector(
        `[data-commit-id="${CSS.escape(selectedId)}"]`,
      );
      if (button instanceof HTMLButtonElement) {
        button.setAttribute('aria-current', 'true');
        selectedButton = button;
      }
    }
    status.classList.add('hidden');
    content.classList.remove('hidden');
  };

  window.addEventListener('message', ({ data }) => {
    if (!data || typeof data !== 'object' || typeof data.type !== 'string') return;
    if (data.type === 'commitsLoaded' && Array.isArray(data.commits)) {
      renderCommits(data);
      return;
    }
    if (data.type === 'selectionCleared') {
      if (selectedButton) selectedButton.removeAttribute('aria-current');
      selectedButton = undefined;
      return;
    }
    if (data.type === 'empty') {
      const messages = {
        noRepo: 'Open a folder containing a Git repository.',
        noCommits: 'No commits found on this branch.',
        error: data.message || 'Unable to load commits.',
      };
      showStatus(messages[data.reason] || 'No commit data available.', data.reason === 'error');
    }
  });

  switchBranch.addEventListener('click', () => {
    vscode.postMessage({ type: 'switchBranch' });
  });

  vscode.postMessage({ type: 'ready' });
})();
