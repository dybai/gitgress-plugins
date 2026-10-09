(() => {
  const vscode = acquireVsCodeApi();
  const status = document.querySelector('#status');
  const content = document.querySelector('#content');
  const branchName = document.querySelector('#branch-name');
  const commitList = document.querySelector('#commit-list');
  const switchBranch = document.querySelector('#switch-branch');
  const hoverCard = document.querySelector('#hover-card');
  let selectedButton;
  let hoveredButton;
  let hideHoverTimer;
  let lastPayload;
  let lastHasMore = false;
  let loadMoreSent = false;

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const MAX_LANES = 10;
  const LANE_WIDTH = 14;
  const PALETTE = [
    'var(--vscode-gitDecoration-modifiedResourceForeground)',
    'var(--vscode-gitDecoration-addedResourceForeground)',
    'var(--vscode-charts-purple)',
    'var(--vscode-charts-orange)',
    'var(--vscode-charts-blue)',
    'var(--vscode-charts-yellow)',
    'var(--vscode-charts-red)',
    'var(--vscode-charts-green)',
  ];

  const svgElement = (tag, attributes = {}) => {
    const element = document.createElementNS(SVG_NS, tag);
    for (const [name, value] of Object.entries(attributes)) {
      element.setAttribute(name, String(value));
    }
    return element;
  };

  const laneX = (lane) =>
    (Math.min(Math.max(0, lane), MAX_LANES - 1) + 0.5) * LANE_WIDTH;

  const graphWidth = (laneCount) =>
    Math.max(1, Math.min(laneCount, MAX_LANES)) * LANE_WIDTH;

  const edgeColor = (colorIndex) =>
    PALETTE[Math.abs(colorIndex) % PALETTE.length];

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

  const cancelHideHover = () => {
    if (hideHoverTimer) {
      clearTimeout(hideHoverTimer);
      hideHoverTimer = undefined;
    }
  };

  const hideHover = () => {
    cancelHideHover();
    hoveredButton?.removeAttribute('aria-describedby');
    hoveredButton = undefined;
    hoverCard.classList.add('hidden');
  };

  const scheduleHideHover = () => {
    cancelHideHover();
    hideHoverTimer = setTimeout(hideHover, 100);
  };

  const positionHover = () => {
    if (!hoveredButton || hoverCard.classList.contains('hidden')) return;

    const rowRect = hoveredButton.getBoundingClientRect();
    const cardRect = hoverCard.getBoundingClientRect();
    const gap = 8;
    const edge = 8;
    const anchorX = rowRect.left + rowRect.width / 2;
    const left = Math.min(
      window.innerWidth - cardRect.width - edge,
      Math.max(edge, anchorX - cardRect.width / 2),
    );
    const fitsBelow = rowRect.bottom + gap + cardRect.height <= window.innerHeight - edge;
    const top = fitsBelow
      ? rowRect.bottom + gap
      : Math.max(edge, rowRect.top - gap - cardRect.height);

    hoverCard.style.left = `${left}px`;
    hoverCard.style.top = `${top}px`;
    hoverCard.style.setProperty(
      '--caret-left',
      `${Math.max(8, Math.min(cardRect.width - 8, anchorX - left))}px`,
    );
    hoverCard.classList.toggle('caret-top', fitsBelow);
    hoverCard.classList.toggle('caret-bottom', !fitsBelow);
  };

  const showHover = (button, commit, branch) => {
    cancelHideHover();
    if (hoveredButton !== button) {
      hoveredButton?.removeAttribute('aria-describedby');
    }
    hoveredButton = button;
    button.setAttribute('aria-describedby', 'hover-card');

    const primary = document.createElement('p');
    primary.className = 'card-primary';
    primary.append(document.createTextNode(`${commit.authorName} · `));
    const time = document.createElement('span');
    time.textContent = formatTime(commit.authorDateIso);
    time.title = commit.authorDateIso;
    primary.append(time);

    const details = document.createElement('p');
    details.className = 'card-details';
    details.append(document.createTextNode(`${commit.id.slice(0, 7)} · `));
    appendTextElement(details, 'span', 'additions', `+${commit.additions}`);
    details.append(document.createTextNode(' / '));
    appendTextElement(details, 'span', 'deletions', `−${commit.deletions}`);

    const message = document.createElement('p');
    message.className = 'card-message';
    message.textContent = commit.fullMessage;

    const children = [primary, details, message];
    if (branch) {
      const branchLine = document.createElement('p');
      branchLine.className = 'card-branch';
      branchLine.textContent = branch;
      children.push(branchLine);
    }
    hoverCard.replaceChildren(...children);
    hoverCard.classList.remove('hidden');
    positionHover();
  };

  const createCommit = (commit, branch) => {
    const item = document.createElement('li');
    item.className = 'commit';

    const button = document.createElement('button');
    button.className = 'commit-button';
    button.type = 'button';
    button.dataset.commitId = commit.id;
    button.setAttribute('aria-label', `${commit.subject}, by ${commit.authorName}`);

    const graphCell = document.createElement('span');
    graphCell.className = 'graph-cell';
    graphCell.setAttribute('aria-hidden', 'true');
    const copy = document.createElement('span');
    copy.className = 'commit-copy';
    appendTextElement(copy, 'span', 'subject', commit.subject);
    button.append(graphCell, copy);

    button.addEventListener('click', () => {
      if (selectedButton) selectedButton.removeAttribute('aria-current');
      button.setAttribute('aria-current', 'true');
      selectedButton = button;
      vscode.postMessage({ type: 'commitSelected', commitId: commit.id });
    });

    item.addEventListener('mouseenter', () => showHover(button, commit, branch));
    item.addEventListener('mouseleave', scheduleHideHover);
    button.addEventListener('focus', () => showHover(button, commit, branch));
    button.addEventListener('blur', scheduleHideHover);

    item.append(button);
    return item;
  };

  const drawGraph = (message) => {
    const svg = commitList.querySelector('.commit-graph');
    if (!(svg instanceof SVGElement)) return;

    const buttons = [...commitList.querySelectorAll('.commit-button')];
    const lastCommit = commitList.querySelector('.commit:last-of-type');
    const height = lastCommit
      ? lastCommit.offsetTop + lastCommit.offsetHeight
      : 0;
    const width = graphWidth(message.laneCount);
    const rowY = buttons.map(
      (button) =>
        button.closest('.commit')?.offsetTop + button.offsetHeight / 2,
    );

    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.setAttribute('width', String(width));
    svg.setAttribute('height', String(height));

    const edges = svgElement('g', { class: 'graph-edges' });
    for (const edge of message.edges) {
      const fromY = rowY[edge.fromRow];
      const toY = edge.truncated ? height : rowY[edge.toRow];
      if (!Number.isFinite(fromY) || !Number.isFinite(toY)) continue;

      const fromX = laneX(edge.fromLane);
      const toX = laneX(edge.toLane);
      const path = svgElement('path', {
        class: edge.truncated ? 'graph-edge graph-edge-truncated' : 'graph-edge',
        d:
          fromX === toX
            ? `M ${fromX} ${fromY} V ${toY}`
            : `M ${fromX} ${fromY} V ${toY} H ${toX}`,
      });
      path.style.stroke = edgeColor(edge.colorIndex);
      edges.append(path);
    }

    const nodes = svgElement('g', { class: 'graph-nodes' });
    message.commits.forEach((commit, row) => {
      if (!Number.isFinite(rowY[row])) return;
      const node = svgElement('circle', {
        class: 'graph-node',
        cx: laneX(commit.lane),
        cy: rowY[row],
        r: 4,
      });
      node.style.stroke = edgeColor(commit.colorIndex);
      nodes.append(node);
    });

    svg.replaceChildren(edges, nodes);
  };

  const isGrowingReplacement = (message) =>
    message.mode === 'replace' &&
    lastPayload?.branch === message.branch &&
    message.commits.length > lastPayload.commits.length &&
    lastPayload.commits.every(
      (commit, index) => message.commits[index]?.id === commit.id,
    );

  const scrollContainer = () => document.scrollingElement || document.documentElement;

  const nearBottom = () => {
    const el = scrollContainer();
    return el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  const maybeRequestLoadMore = () => {
    if (!lastHasMore || loadMoreSent) return;
    if (!nearBottom()) return;
    loadMoreSent = true;
    vscode.postMessage({ type: 'loadMore' });
  };

  const showStatus = (message, retryable) => {
    hideHover();
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
    hideHover();
    const savedScrollTop = isGrowingReplacement(message)
      ? scrollContainer().scrollTop
      : null;
    selectedButton = undefined;
    branchName.textContent = message.branch;
    const width = graphWidth(message.laneCount);
    commitList.style.setProperty('--graph-width', `${width}px`);
    const svg = svgElement('svg', {
      class: 'commit-graph',
      'aria-hidden': 'true',
      focusable: 'false',
    });
    commitList.replaceChildren(
      svg,
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
    lastPayload = message;
    drawGraph(message);
    if (savedScrollTop !== null) {
      scrollContainer().scrollTop = savedScrollTop;
    }
  };

  const resizeObserver = new ResizeObserver(() => {
    if (lastPayload) drawGraph(lastPayload);
  });
  resizeObserver.observe(commitList);

  window.addEventListener(
    'scroll',
    () => {
      positionHover();
      if (!nearBottom()) {
        loadMoreSent = false;
        return;
      }
      maybeRequestLoadMore();
    },
    { passive: true },
  );

  window.addEventListener('resize', positionHover);
  hoverCard.addEventListener('mouseenter', cancelHideHover);
  hoverCard.addEventListener('mouseleave', scheduleHideHover);

  window.addEventListener('message', ({ data }) => {
    if (!data || typeof data !== 'object' || typeof data.type !== 'string') return;
    if (data.type === 'commitsLoaded' && Array.isArray(data.commits)) {
      renderCommits(data);
      lastHasMore = data.hasMore === true;
      loadMoreSent = false;
      maybeRequestLoadMore();
      return;
    }
    if (data.type === 'selectionCleared') {
      if (selectedButton) selectedButton.removeAttribute('aria-current');
      selectedButton = undefined;
      return;
    }
    if (data.type === 'empty') {
      lastHasMore = false;
      loadMoreSent = false;
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
