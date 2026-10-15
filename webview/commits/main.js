import {
  computePageStep,
  isCommitNavKey,
  nextCommitIndex,
} from '../../src/views/commits/commitKeyboardNav.ts';
import {
  foldRemoteLabel,
  orderedSecondaryRefs,
  primaryRef,
} from '../../src/views/commits/attachCommitRefs.ts';
import { formatCompactRelativeTime } from '../../src/views/commits/formatCompactRelativeTime.ts';
import { packRefPills } from '../../src/views/commits/packRefPills.ts';
import { repoShortName } from '../../src/views/commits/repoShortName.ts';
import { tipJumpTarget } from '../../src/views/commits/tipJump.ts';
import {
  anchoredScrollTop,
  chooseScrollAnchorId,
} from './scrollAnchor.js';

  const vscode = acquireVsCodeApi();
  const status = document.querySelector('#status');
  const content = document.querySelector('#content');
  const repoName = document.querySelector('#repo-name');
  const branchName = document.querySelector('#branch-name');
  const commitList = document.querySelector('#commit-list');
  const switchBranch = document.querySelector('#switch-branch');
  const hoverCard = document.querySelector('#hover-card');
  let selectedButton;
  let hoveredButton;
  let hideHoverTimer;
  let showHoverTimer;
  const HOVER_OPEN_DELAY_MS = 500;
  const HOVER_SWITCH_DELAY_MS = 200;
  let lastPayload;
  let lastHasMore = false;
  let lastHasNewer = false;
  let loadMoreSent = false;
  let loadNewerSent = false;
  let suppressEdgeRequestsUntilUserScroll = false;
  const refPillNodes = new WeakMap();
  const refPillsResizeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) {
      packPillRow(entry.target);
    }
  });

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

  const cancelShowHover = () => {
    if (showHoverTimer) {
      clearTimeout(showHoverTimer);
      showHoverTimer = undefined;
    }
  };

  const hideHover = () => {
    cancelHideHover();
    cancelShowHover();
    hoveredButton?.removeAttribute('aria-describedby');
    hoveredButton = undefined;
    hoverCard.classList.add('hidden');
  };

  const scheduleHideHover = () => {
    cancelShowHover();
    cancelHideHover();
    hideHoverTimer = setTimeout(hideHover, 100);
  };

  const positionHover = () => {
    if (!hoveredButton || hoverCard.classList.contains('hidden')) return;

    const rowRect = hoveredButton.getBoundingClientRect();
    if (rowRect.bottom < 0 || rowRect.top > window.innerHeight) {
      hideHover();
      return;
    }
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

  const pillClass = (kind) => {
    if (kind === 'tag') return 'ref-pill ref-pill-tag';
    if (kind === 'remote') return 'ref-pill ref-pill-remote';
    return 'ref-pill';
  };

  const appendOrderedPills = (parent, commit, message, includeJumpControls) => {
    const refs = Array.isArray(commit.refs) ? commit.refs : [];
    const isHead =
      typeof message.headCommitId === 'string' &&
      message.headCommitId.length > 0 &&
      commit.id === message.headCommitId;
    const isTip =
      Array.isArray(message.tipCommitIds) && message.tipCommitIds.includes(commit.id);
    const nodes = [];

    if (isHead) {
      nodes.push(appendTextElement(parent, 'span', 'ref-pill', 'HEAD'));
    }

    const primary = primaryRef(refs, message.branch);
    if (primary) {
      const folded = foldRemoteLabel(primary, refs);
      const compound = document.createElement('span');
      compound.className = `${pillClass(primary.kind)} tip-compound`;

      const names = document.createElement('span');
      names.className = 'tip-names';
      appendTextElement(names, 'span', 'tip-name', primary.name);
      if (folded) {
        appendTextElement(names, 'span', 'tip-remote', folded);
      }
      compound.append(names);

      if (includeJumpControls && isTip) {
        appendJumpControls(compound, commit.id, message);
      }

      parent.append(compound);
      nodes.push(compound);

      for (const ref of orderedSecondaryRefs(refs, primary, folded)) {
        nodes.push(
          appendTextElement(parent, 'span', pillClass(ref.kind), ref.name),
        );
      }
    } else if (includeJumpControls && isTip) {
      const compound = document.createElement('span');
      compound.className = 'ref-pill tip-compound';
      appendJumpControls(compound, commit.id, message);
      parent.append(compound);
      nodes.push(compound);
    }

    return nodes;
  };

  const showHover = (button, commit, hostMessage) => {
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
    const refs = Array.isArray(commit.refs) ? commit.refs : [];
    const isHead =
      typeof hostMessage.headCommitId === 'string' &&
      hostMessage.headCommitId.length > 0 &&
      commit.id === hostMessage.headCommitId;
    if (isHead || refs.length > 0) {
      const cardRefs = document.createElement('div');
      cardRefs.className = 'card-refs';
      appendOrderedPills(cardRefs, commit, hostMessage, false);
      children.push(cardRefs);
    }
    hoverCard.replaceChildren(...children);
    hoverCard.classList.remove('hidden');
    positionHover();
  };

  const scheduleShowHover = (button, commit, message) => {
    cancelShowHover();
    cancelHideHover();
    const delay = hoverCard.classList.contains('hidden')
      ? HOVER_OPEN_DELAY_MS
      : HOVER_SWITCH_DELAY_MS;
    showHoverTimer = setTimeout(() => {
      showHoverTimer = undefined;
      showHover(button, commit, message);
    }, delay);
  };

  const selectCommitButton = (button) => {
    if (!(button instanceof HTMLButtonElement)) return;
    const commitId = button.dataset.commitId;
    if (typeof commitId !== 'string' || commitId.length === 0) return;
    if (selectedButton) selectedButton.removeAttribute('aria-current');
    button.setAttribute('aria-current', 'true');
    selectedButton = button;
    vscode.postMessage({ type: 'commitSelected', commitId });
  };

  const commitIndexById = (message) => {
    const map = new Map();
    message.commits.forEach((entry, index) => {
      map.set(entry.id, index);
    });
    return map;
  };

  const jumpToTip = (targetId) => {
    const button = commitList.querySelector(
      `[data-commit-id="${CSS.escape(targetId)}"]`,
    );
    if (!(button instanceof HTMLButtonElement)) {
      return;
    }
    selectCommitButton(button);
    button.focus({ preventScroll: true });
    button.scrollIntoView({ block: 'nearest' });
  };

  const appendJumpControls = (parent, commitId, message) => {
    const tipIds = Array.isArray(message.tipCommitIds) ? message.tipCommitIds : [];
    const indexById = commitIndexById(message);
    const jump = document.createElement('span');
    jump.className = 'tip-jump';

    const device = document.createElement('span');
    device.className = 'tip-jump-device';
    device.setAttribute('aria-hidden', 'true');
    device.textContent = '⌂';
    jump.append(device);

    for (const direction of ['up', 'down']) {
      const target = tipJumpTarget(tipIds, commitId, direction, indexById);
      const control = document.createElement('button');
      control.type = 'button';
      control.className = `tip-jump-${direction}`;
      control.disabled = target === null;
      if (target) {
        const labelName =
          message.commits.find((entry) => entry.id === target.targetId)?.refs?.[0]
            ?.name ?? target.targetId.slice(0, 7);
        control.title = `Jump to ${labelName} · ${target.distance} away`;
        control.setAttribute(
          'aria-label',
          `Jump ${direction} to ${labelName}, ${target.distance} away`,
        );
        control.textContent =
          direction === 'up' ? `↑${target.distance}` : `↓${target.distance}`;
        control.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          jumpToTip(target.targetId);
        });
      } else {
        control.title = `No tip ${direction === 'up' ? 'above' : 'below'}`;
        control.setAttribute(
          'aria-label',
          `No tip ${direction === 'up' ? 'above' : 'below'}`,
        );
        control.textContent = direction === 'up' ? '↑' : '↓';
      }
      jump.append(control);
    }

    parent.append(jump);
  };

  function packPillRow(pills) {
    const nodes = refPillNodes.get(pills);
    if (!nodes) return;

    pills.querySelector('.ref-pill-more')?.remove();
    for (const node of nodes) {
      node.hidden = false;
    }

    const gap = Number.parseFloat(getComputedStyle(pills).columnGap) || 0;
    const widths = nodes.map((node, index) => {
      const previousFlex = node.style.flex;
      const previousMaxWidth = node.style.maxWidth;
      node.style.flex = '0 0 auto';
      node.style.maxWidth = 'none';
      const width = node.getBoundingClientRect().width;
      node.style.flex = previousFlex;
      node.style.maxWidth = previousMaxWidth;
      return width + (index > 0 ? gap : 0);
    });
    const more = document.createElement('span');
    more.className = 'ref-pill ref-pill-more';
    more.style.visibility = 'hidden';
    pills.append(more);
    const moreWidthFor = (hiddenCount) => {
      more.textContent = `+${hiddenCount}`;
      return more.getBoundingClientRect().width + gap;
    };
    const packed = packRefPills(widths, pills.clientWidth, moreWidthFor);
    more.remove();

    nodes.forEach((node, index) => {
      node.hidden = index >= packed.visibleCount;
    });
    if (packed.hiddenCount > 0) {
      more.style.removeProperty('visibility');
      more.textContent = `+${packed.hiddenCount}`;
      pills.append(more);
    }
  }

  const appendRefPills = (subjectRow, commit, message) => {
    const refs = Array.isArray(commit.refs) ? commit.refs : [];
    const isHead =
      typeof message.headCommitId === 'string' &&
      message.headCommitId.length > 0 &&
      commit.id === message.headCommitId;

    if (!isHead && refs.length === 0) {
      return [];
    }

    const pills = document.createElement('span');
    pills.className = 'ref-pills';
    const nodes = appendOrderedPills(pills, commit, message, true);

    subjectRow.append(pills);
    refPillNodes.set(pills, nodes);
    refPillsResizeObserver.observe(pills);
    const aria = [];
    if (isHead) {
      aria.push('HEAD');
    }
    for (const ref of refs) {
      aria.push(ref.name);
    }
    return aria;
  };

  const createCommit = (commit, message) => {
    const item = document.createElement('li');
    item.className = 'commit';

    const shortHash = commit.id.slice(0, 7);
    const ariaParts = [
      commit.subject,
      `by ${commit.authorName}`,
      shortHash,
    ];

    const button = document.createElement('button');
    button.className = 'commit-button';
    button.type = 'button';
    button.dataset.commitId = commit.id;

    const graphCell = document.createElement('span');
    graphCell.className = 'graph-cell';
    graphCell.setAttribute('aria-hidden', 'true');
    const copy = document.createElement('span');
    copy.className = 'commit-copy';

    const subjectRow = document.createElement('span');
    subjectRow.className = 'subject-row';
    appendTextElement(subjectRow, 'span', 'subject', commit.subject);
    ariaParts.push(...appendRefPills(subjectRow, commit, message));
    button.setAttribute('aria-label', ariaParts.join(', '));

    const metaRow = document.createElement('span');
    metaRow.className = 'meta-row';
    appendTextElement(
      metaRow,
      'span',
      'meta-left',
      `${shortHash} · ${commit.authorName}`,
    );
    appendTextElement(
      metaRow,
      'span',
      'meta-time',
      formatCompactRelativeTime(commit.authorDateIso),
    );

    copy.append(subjectRow, metaRow);
    button.append(graphCell, copy);

    button.addEventListener('click', () => selectCommitButton(button));

    item.addEventListener('mouseenter', () =>
      scheduleShowHover(button, commit, message),
    );
    item.addEventListener('mouseleave', scheduleHideHover);
    button.addEventListener('focus', () => showHover(button, commit, message));
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
      const viaX = laneX(edge.viaLane);
      const toX = laneX(edge.toLane);
      const path = svgElement('path', {
        class: edge.truncated ? 'graph-edge graph-edge-truncated' : 'graph-edge',
        d:
          fromX === viaX && viaX === toX
            ? `M ${fromX} ${fromY} V ${toY}`
            : `M ${fromX} ${fromY} H ${viaX} V ${toY} H ${toX}`,
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

  const scrollContainer = () => document.querySelector('#commit-scroll');

  const captureScrollAnchor = (message) => {
    if (message.mode !== 'replace') return null;

    const incomingIds = new Set(message.commits.map((commit) => commit.id));
    const rows = [...commitList.querySelectorAll('.commit-button')]
      .filter((button) => incomingIds.has(button.dataset.commitId))
      .map((button) => {
        const rect = button.getBoundingClientRect();
        return {
          id: button.dataset.commitId,
          top: rect.top,
          bottom: rect.bottom,
        };
      })
      .filter((row) => typeof row.id === 'string');
    const viewport = scrollContainer().getBoundingClientRect();
    const id = chooseScrollAnchorId(
      message.selectedCommitId,
      rows,
      viewport.top,
      viewport.bottom,
    );
    if (id === null) return null;

    const row = rows.find((candidate) => candidate.id === id);
    return row
      ? {
          id,
          top: row.top,
          scrollTop: scrollContainer().scrollTop,
        }
      : null;
  };

  const restoreScrollAnchor = (anchor) => {
    if (anchor === null) return false;
    const button = commitList.querySelector(
      `[data-commit-id="${CSS.escape(anchor.id)}"]`,
    );
    if (!(button instanceof HTMLButtonElement)) return false;

    const el = scrollContainer();
    if (!(el instanceof HTMLElement)) return false;
    const nextScrollTop = anchoredScrollTop(
      anchor.scrollTop,
      anchor.top,
      button.getBoundingClientRect().top,
    );
    const restored = nextScrollTop !== el.scrollTop;
    el.scrollTop = nextScrollTop;
    return restored;
  };

  const nearBottom = () => {
    const el = scrollContainer();
    if (!(el instanceof HTMLElement)) return false;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  const nearTop = () => {
    const el = scrollContainer();
    return el instanceof HTMLElement && el.scrollTop < 80;
  };

  const maybeRequestLoadMore = () => {
    if (!lastHasMore || loadMoreSent) return;
    if (!nearBottom()) return;
    loadMoreSent = true;
    vscode.postMessage({ type: 'loadMore' });
  };

  const maybeRequestLoadNewer = () => {
    if (!lastHasNewer || loadNewerSent) return;
    if (!nearTop()) return;
    loadNewerSent = true;
    vscode.postMessage({ type: 'loadNewer' });
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
    const scrollAnchor = captureScrollAnchor(message);
    refPillsResizeObserver.disconnect();
    selectedButton = undefined;
    const root =
      typeof message.repoRoot === 'string' && message.repoRoot.length > 0
        ? message.repoRoot
        : '';
    if (repoName instanceof HTMLButtonElement) {
      if (root) {
        repoName.hidden = false;
        repoName.textContent = repoShortName(root, []);
        repoName.title = root;
      } else {
        repoName.hidden = true;
        repoName.textContent = '';
        repoName.title = '';
      }
    }
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
      ...message.commits.map((commit) => createCommit(commit, message)),
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
    restoreScrollAnchor(scrollAnchor);
  };

  const resizeObserver = new ResizeObserver(() => {
    if (lastPayload) drawGraph(lastPayload);
  });
  resizeObserver.observe(commitList);

  scrollContainer().addEventListener(
    'scroll',
    () => {
      positionHover();
      if (suppressEdgeRequestsUntilUserScroll) return;
      if (!nearBottom()) {
        loadMoreSent = false;
      } else {
        maybeRequestLoadMore();
      }
      if (!nearTop()) {
        loadNewerSent = false;
      } else {
        maybeRequestLoadNewer();
      }
    },
    { passive: true },
  );

  const resumeEdgeRequestsForUserScroll = () => {
    suppressEdgeRequestsUntilUserScroll = false;
  };
  window.addEventListener('wheel', resumeEdgeRequestsForUserScroll, { passive: true });
  window.addEventListener('touchstart', resumeEdgeRequestsForUserScroll, {
    passive: true,
  });
  window.addEventListener('pointerdown', resumeEdgeRequestsForUserScroll, {
    passive: true,
  });
  window.addEventListener('keydown', (event) => {
    if (
      ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(
        event.key,
      )
    ) {
      resumeEdgeRequestsForUserScroll();
    }
  });

  window.addEventListener('resize', positionHover);
  hoverCard.addEventListener('mouseenter', cancelHideHover);
  hoverCard.addEventListener('mouseleave', scheduleHideHover);

  window.addEventListener('message', ({ data }) => {
    if (!data || typeof data !== 'object' || typeof data.type !== 'string') return;
    if (data.type === 'scanStatus') {
      const scanProgress = document.getElementById('scan-progress');
      if (scanProgress) {
        scanProgress.classList.toggle('hidden', data.status !== 'scanning');
      }
      return;
    }
    if (data.type === 'commitsLoaded' && Array.isArray(data.commits)) {
      const completedEdgeLoad = loadMoreSent || loadNewerSent;
      renderCommits(data);
      lastHasMore = data.hasMore === true;
      lastHasNewer = data.hasNewer === true;
      loadMoreSent = false;
      loadNewerSent = false;
      suppressEdgeRequestsUntilUserScroll = completedEdgeLoad;
      if (!completedEdgeLoad) {
        maybeRequestLoadMore();
        maybeRequestLoadNewer();
      }
      return;
    }
    if (data.type === 'selectionCleared') {
      if (selectedButton) selectedButton.removeAttribute('aria-current');
      selectedButton = undefined;
      return;
    }
    if (data.type === 'empty') {
      lastHasMore = false;
      lastHasNewer = false;
      loadMoreSent = false;
      loadNewerSent = false;
      const messages = {
        noRepo: 'Open a folder containing a Git repository.',
        noSelection: 'Select a repository to view commits.',
        noCommits: 'No commits found on this branch.',
        error: data.message || 'Unable to load commits.',
      };
      showStatus(messages[data.reason] || 'No commit data available.', data.reason === 'error');
    }
  });

  switchBranch.addEventListener('click', () => {
    vscode.postMessage({ type: 'switchBranch' });
  });

  if (repoName instanceof HTMLButtonElement) {
    repoName.addEventListener('click', () => {
      vscode.postMessage({ type: 'selectRepository' });
    });
  }

  window.addEventListener('keydown', (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (!isCommitNavKey(event.key)) return;
    if (!selectedButton) return;

    const buttons = [...commitList.querySelectorAll('.commit-button')];
    const currentIndex = buttons.indexOf(selectedButton);
    if (currentIndex < 0 || buttons.length === 0) return;

    event.preventDefault();
    event.stopPropagation();

    const row = selectedButton.closest('.commit');
    const rowHeight =
      (row instanceof HTMLElement ? row.offsetHeight : 0) ||
      selectedButton.offsetHeight ||
      0;
    const viewportHeight = scrollContainer().clientHeight;
    const pageStep = computePageStep(viewportHeight, rowHeight);
    const nextIndex = nextCommitIndex(currentIndex, event.key, {
      length: buttons.length,
      pageStep,
    });
    if (nextIndex === currentIndex) return;

    const nextButton = buttons[nextIndex];
    if (!(nextButton instanceof HTMLButtonElement)) return;
    selectCommitButton(nextButton);
    nextButton.focus({ preventScroll: true });
    nextButton.scrollIntoView({ block: 'nearest' });
  });

  vscode.postMessage({ type: 'ready' });
