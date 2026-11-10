// 테스트 가능한 순수 게임 로직 (DOM에 접근하지 않음)
// 브라우저에서는 전역 TetrisCore로, Node.js(Jest)에서는 require()로 사용합니다.
(function (root) {
  'use strict';

  const COLS = 10;
  const ROWS = 20;
  const LINE_SCORES = [0, 100, 300, 500, 800];

  const SHAPES = {
    I: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
    O: [[1, 1], [1, 1]],
    T: [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
    S: [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
    Z: [[1, 1, 0], [0, 1, 1], [0, 0, 0]],
    J: [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
    L: [[0, 0, 1], [1, 1, 1], [0, 0, 0]],
  };

  function createBoard() {
    return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  }

  function createPiece(type) {
    const matrix = SHAPES[type].map(row => row.slice());
    return {
      type,
      matrix,
      x: Math.floor((COLS - matrix[0].length) / 2),
      y: type === 'I' ? -1 : 0,
    };
  }

  function collide(board, piece, dx = 0, dy = 0, matrix = piece.matrix) {
    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < matrix[r].length; c++) {
        if (!matrix[r][c]) continue;
        const x = piece.x + c + dx;
        const y = piece.y + r + dy;
        if (x < 0 || x >= COLS || y >= ROWS) return true;
        if (y >= 0 && board[y][x]) return true;
      }
    }
    return false;
  }

  function rotateMatrix(matrix) {
    const n = matrix.length;
    return matrix.map((row, r) => row.map((_, c) => matrix[n - 1 - c][r]));
  }

  // 회전에 성공하면 새 조각을, 막히면 원래 조각을 돌려줍니다 (벽에서 밀어내기 포함)
  function tryRotate(board, piece) {
    if (piece.type === 'O') return piece;
    const rotated = rotateMatrix(piece.matrix);
    for (const kick of [0, -1, 1, -2, 2]) {
      if (!collide(board, piece, kick, 0, rotated)) {
        return { ...piece, matrix: rotated, x: piece.x + kick };
      }
    }
    return piece;
  }

  // 꽉 찬 줄을 지운 새 보드와 지운 줄 수를 돌려줍니다 (원래 보드는 바꾸지 않음)
  function clearLines(board) {
    const kept = board.filter(row => !row.every(Boolean));
    const cleared = ROWS - kept.length;
    const empty = Array.from({ length: cleared }, () => Array(COLS).fill(null));
    return { board: empty.concat(kept.map(row => row.slice())), cleared };
  }

  const lineScore = (cleared, level) => LINE_SCORES[cleared] * level;
  const levelFor = lines => Math.floor(lines / 10) + 1;
  // 낙하 간격(ms): 레벨마다 이전 레벨보다 20%씩 빨라지고, 50ms보다 빨라지지는 않습니다.
  // 레벨 1: 1000, 2: 800, 3: 640, 5: 410, 10: 134, 14: 55, 15 이상: 50
  const BASE_INTERVAL = 1000;
  const SPEED_UP = 0.8;
  const MIN_INTERVAL = 50;
  const dropIntervalFor = level =>
    Math.max(MIN_INTERVAL, Math.round(BASE_INTERVAL * Math.pow(SPEED_UP, level - 1)));

  const api = {
    COLS, ROWS, SHAPES,
    createBoard, createPiece, collide, rotateMatrix, tryRotate,
    clearLines, lineScore, levelFor, dropIntervalFor,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;      // Node.js / Jest
  } else {
    root.TetrisCore = api;     // 브라우저
  }
})(typeof window !== 'undefined' ? window : globalThis);
