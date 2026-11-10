(() => {
  'use strict';

  const Core = window.TetrisCore;
  const { COLS, ROWS, SHAPES, createBoard, createPiece } = Core;
  const BLOCK = 30;
  const NEXT_BLOCK = 24;

  const COLORS = {
    I: '#26c6da',
    O: '#ffca28',
    T: '#ab47bc',
    S: '#66bb6a',
    Z: '#ef5350',
    J: '#42a5f5',
    L: '#ffa726',
  };

  const boardCanvas = document.getElementById('board');
  const ctx = boardCanvas.getContext('2d');
  const nextCanvas = document.getElementById('next');
  const nextCtx = nextCanvas.getContext('2d');
  const scoreEl = document.getElementById('score');
  const linesEl = document.getElementById('lines');
  const levelEl = document.getElementById('level');
  const overlay = document.getElementById('overlay');
  const overlayTitle = document.getElementById('overlay-title');
  const overlayText = document.getElementById('overlay-text');
  const startBtn = document.getElementById('start-btn');
  const startLabel = document.getElementById('start-label');
  const musicBtn = document.getElementById('music-btn');
  const pauseBtn = document.getElementById('pause-btn');

  // 보드 배경/격자 색은 CSS 변수(라이트·다크 테마)에서 읽어옵니다.
  const theme = { bg: '#1d1b20', grid: 'rgba(255,255,255,0.05)' };
  function readTheme() {
    const s = getComputedStyle(document.documentElement);
    theme.bg = s.getPropertyValue('--board-bg').trim() || theme.bg;
    theme.grid = s.getPropertyValue('--board-grid').trim() || theme.grid;
  }

  let board, piece, nextPiece;
  let score, lines, level;
  let dropCounter, dropInterval, lastTime;
  let running = false;
  let paused = false;
  let rafId = null;

  function randomType() {
    const types = Object.keys(SHAPES);
    return types[Math.floor(Math.random() * types.length)];
  }

  // 현재 보드를 기준으로 TetrisCore의 순수 함수를 호출하는 래퍼
  function collide(p, offsetX = 0, offsetY = 0, matrix = p.matrix) {
    return Core.collide(board, p, offsetX, offsetY, matrix);
  }

  function rotate() {
    piece = Core.tryRotate(board, piece);
  }

  function merge() {
    piece.matrix.forEach((row, r) => {
      row.forEach((v, c) => {
        if (!v) return;
        const y = piece.y + r;
        if (y >= 0) board[y][piece.x + c] = piece.type;
      });
    });
  }

  function clearLines() {
    const result = Core.clearLines(board);
    board = result.board;
    if (result.cleared) {
      score += Core.lineScore(result.cleared, level);
      lines += result.cleared;
      level = Core.levelFor(lines);
      dropInterval = Core.dropIntervalFor(level);
      Music.setLevel(level);
    }
  }

  function isAboveTop() {
    return piece.matrix.some((row, r) => row.some(v => v && piece.y + r < 0));
  }

  function lockPiece() {
    merge();
    const toppedOut = isAboveTop();
    clearLines();
    if (toppedOut) {
      endGame();
      return;
    }
    spawn();
  }

  function spawn() {
    piece = nextPiece;
    nextPiece = createPiece(randomType());
    if (collide(piece)) {
      endGame();
    }
    updateStats();
  }

  function drop() {
    if (!collide(piece, 0, 1)) {
      piece.y++;
    } else {
      lockPiece();
    }
    dropCounter = 0;
  }

  function softDrop() {
    if (!collide(piece, 0, 1)) {
      piece.y++;
      score += 1;
      dropCounter = 0;
    } else {
      lockPiece();
    }
    updateStats();
  }

  function hardDrop() {
    let distance = 0;
    while (!collide(piece, 0, 1)) {
      piece.y++;
      distance++;
    }
    score += distance * 2;
    lockPiece();
    dropCounter = 0;
    updateStats();
  }

  function move(dir) {
    if (!collide(piece, dir, 0)) piece.x += dir;
  }

  // 키보드와 터치 버튼이 함께 쓰는 조작 함수
  function act(action) {
    if (!running || paused || !action) return;
    switch (action) {
      case 'left': move(-1); break;
      case 'right': move(1); break;
      case 'down': softDrop(); break;
      case 'rotate': rotate(); break;
      case 'drop': hardDrop(); break;
    }
    if (running) draw();
  }

  function ghostY() {
    let y = 0;
    while (!collide(piece, 0, y + 1)) y++;
    return piece.y + y;
  }

  // ---------- 그리기 ----------
  function roundRect(context, x, y, w, h, r) {
    context.beginPath();
    if (context.roundRect) {
      context.roundRect(x, y, w, h, r);
    } else {
      context.rect(x, y, w, h);
    }
  }

  // ghost=true면 착지 위치 표시용 외곽선만 그립니다.
  function drawCell(context, x, y, size, color, ghost = false) {
    const gap = 1.5;
    const px = x * size + gap;
    const py = y * size + gap;
    const s = size - gap * 2;
    const r = Math.max(2, size * 0.16);
    if (ghost) {
      roundRect(context, px + 1, py + 1, s - 2, s - 2, r);
      context.globalAlpha = 0.55;
      context.strokeStyle = color;
      context.lineWidth = 2;
      context.stroke();
      context.globalAlpha = 1;
      return;
    }
    roundRect(context, px, py, s, s, r);
    context.fillStyle = color;
    context.fill();
  }

  function drawGrid() {
    ctx.strokeStyle = theme.grid;
    ctx.lineWidth = 1;
    for (let x = 1; x < COLS; x++) {
      ctx.beginPath();
      ctx.moveTo(x * BLOCK + 0.5, 0);
      ctx.lineTo(x * BLOCK + 0.5, ROWS * BLOCK);
      ctx.stroke();
    }
    for (let y = 1; y < ROWS; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * BLOCK + 0.5);
      ctx.lineTo(COLS * BLOCK, y * BLOCK + 0.5);
      ctx.stroke();
    }
  }

  function drawMatrix(context, matrix, ox, oy, size, color, ghost) {
    matrix.forEach((row, r) => {
      row.forEach((v, c) => {
        if (v && oy + r >= 0) drawCell(context, ox + c, oy + r, size, color, ghost);
      });
    });
  }

  function draw() {
    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, boardCanvas.width, boardCanvas.height);
    drawGrid();

    board.forEach((row, y) => {
      row.forEach((type, x) => {
        if (type) drawCell(ctx, x, y, BLOCK, COLORS[type]);
      });
    });

    if (piece && running) {
      drawMatrix(ctx, piece.matrix, piece.x, ghostY(), BLOCK, COLORS[piece.type], true);
      drawMatrix(ctx, piece.matrix, piece.x, piece.y, BLOCK, COLORS[piece.type], false);
    }
  }

  function drawNext() {
    nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
    if (!nextPiece) return;
    const m = nextPiece.matrix;
    // 실제로 채워진 영역만 기준으로 가운데 정렬
    let minR = m.length, maxR = -1, minC = m.length, maxC = -1;
    m.forEach((row, r) => row.forEach((v, c) => {
      if (!v) return;
      minR = Math.min(minR, r); maxR = Math.max(maxR, r);
      minC = Math.min(minC, c); maxC = Math.max(maxC, c);
    }));
    const w = (maxC - minC + 1) * NEXT_BLOCK;
    const h = (maxR - minR + 1) * NEXT_BLOCK;
    const offX = (nextCanvas.width - w) / 2 - minC * NEXT_BLOCK;
    const offY = (nextCanvas.height - h) / 2 - minR * NEXT_BLOCK;
    nextCtx.save();
    nextCtx.translate(offX, offY);
    drawMatrix(nextCtx, m, 0, 0, NEXT_BLOCK, COLORS[nextPiece.type], false);
    nextCtx.restore();
  }

  function updateStats() {
    scoreEl.textContent = score.toLocaleString();
    linesEl.textContent = lines;
    levelEl.textContent = level;
    drawNext();
  }

  // ---------- 게임 흐름 ----------
  function showOverlay(title, text, buttonLabel) {
    overlayTitle.textContent = title;
    overlayText.textContent = text;
    startLabel.textContent = buttonLabel;
    startBtn.hidden = !buttonLabel;
    overlay.hidden = false;
  }

  function updateButtons() {
    musicBtn.setAttribute('aria-pressed', String(Music.isEnabled()));
    pauseBtn.disabled = !running;
    pauseBtn.classList.toggle('is-paused', paused);
    pauseBtn.setAttribute('aria-label', paused ? '계속하기' : '일시정지');
    pauseBtn.title = paused ? '계속하기 (P)' : '일시정지 (P)';
  }

  function toggleMusic() {
    Music.setEnabled(!Music.isEnabled());
    if (Music.isEnabled() && running && !paused) {
      Music.start();
    } else {
      Music.stop(false);
    }
    updateButtons();
  }

  function hideOverlay() {
    overlay.hidden = true;
  }

  function startGame() {
    board = createBoard();
    score = 0;
    lines = 0;
    level = 1;
    dropInterval = Core.dropIntervalFor(level);
    dropCounter = 0;
    lastTime = 0;
    nextPiece = createPiece(randomType());
    running = true;
    paused = false;
    spawn();
    hideOverlay();
    startBtn.blur();
    Music.stop(true);
    Music.setLevel(1);
    Music.start();
    updateButtons();
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(update);
  }

  function endGame() {
    running = false;
    paused = false;
    Music.stop(true);
    updateButtons();
    draw();
    showOverlay('게임 오버', `최종 점수: ${score.toLocaleString()}`, '다시 시작');
  }

  function togglePause() {
    if (!running) return;
    paused = !paused;
    if (paused) {
      showOverlay('일시정지', 'P 키 또는 상단의 재생 버튼으로 계속하기', '');
      Music.stop(false);
    } else {
      hideOverlay();
      lastTime = 0;
      Music.start();
    }
    updateButtons();
  }

  function update(time) {
    if (!running) return;
    if (!paused) {
      if (!lastTime) lastTime = time;
      dropCounter += time - lastTime;
      if (dropCounter > dropInterval) drop();
      if (!running) return;
      draw();
    }
    lastTime = time;
    rafId = requestAnimationFrame(update);
  }

  document.addEventListener('keydown', e => {
    const handled = ['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp', ' ', 'x', 'X', 'p', 'P', 'm', 'M'];
    if (!handled.includes(e.key)) return;
    e.preventDefault();

    if (e.key === 'm' || e.key === 'M') {
      if (!e.repeat) toggleMusic();
      return;
    }
    if (e.key === 'p' || e.key === 'P') {
      if (!e.repeat) togglePause();
      return;
    }
    const map = {
      ArrowLeft: 'left', ArrowRight: 'right', ArrowDown: 'down',
      ArrowUp: 'rotate', x: 'rotate', X: 'rotate', ' ': 'drop',
    };
    act(map[e.key]);
  });

  // ---------- 터치 조작 버튼 ----------
  // 이동/소프트 드롭 버튼은 누르고 있으면 반복 입력됩니다.
  document.querySelectorAll('.ctrl-btn').forEach(btn => {
    const action = btn.dataset.action;
    const repeat = btn.hasAttribute('data-repeat');
    let delayTimer = null;
    let repeatTimer = null;

    const release = () => {
      clearTimeout(delayTimer);
      clearInterval(repeatTimer);
      delayTimer = repeatTimer = null;
      btn.classList.remove('is-pressed');
    };

    btn.addEventListener('pointerdown', e => {
      e.preventDefault();
      release();
      btn.classList.add('is-pressed');
      if (btn.setPointerCapture) {
        try { btn.setPointerCapture(e.pointerId); } catch (err) { /* 무시 */ }
      }
      act(action);
      if (repeat) {
        delayTimer = setTimeout(() => {
          repeatTimer = setInterval(() => act(action), action === 'down' ? 40 : 60);
        }, 170);
      }
    });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type => {
      btn.addEventListener(type, release);
    });
    // 길게 누를 때 뜨는 메뉴 방지
    btn.addEventListener('contextmenu', e => e.preventDefault());
  });

  // 다른 앱/탭으로 전환하면 자동으로 일시정지
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && running && !paused) togglePause();
  });

  startBtn.addEventListener('click', startGame);
  musicBtn.addEventListener('click', () => { toggleMusic(); musicBtn.blur(); });
  pauseBtn.addEventListener('click', () => { togglePause(); pauseBtn.blur(); });

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    readTheme();
    draw();
  });

  // 초기 화면
  readTheme();
  updateButtons();
  board = createBoard();
  score = 0; lines = 0; level = 1;
  nextPiece = null;
  draw();
  updateStats();
})();
