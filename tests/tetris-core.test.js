const {
  COLS, ROWS, createBoard, createPiece, collide, rotateMatrix,
  tryRotate, clearLines, lineScore, levelFor, dropIntervalFor,
} = require('../tetris-core');

describe('createBoard', () => {
  test('20×10 크기의 빈 보드를 만든다', () => {
    const board = createBoard();
    expect(board).toHaveLength(ROWS);
    board.forEach(row => {
      expect(row).toHaveLength(COLS);
      expect(row.every(cell => cell === null)).toBe(true);
    });
  });
});

describe('collide', () => {
  test('빈 보드 가운데에서는 충돌하지 않는다', () => {
    expect(collide(createBoard(), createPiece('T'))).toBe(false);
  });

  test('왼쪽·오른쪽 벽 밖으로 나가면 충돌한다', () => {
    const board = createBoard();
    const piece = { ...createPiece('O'), x: 0 };
    expect(collide(board, piece, -1, 0)).toBe(true);
    expect(collide(board, { ...piece, x: COLS - 2 }, 1, 0)).toBe(true);
  });

  test('바닥 아래로 내려가면 충돌한다', () => {
    const piece = { ...createPiece('O'), y: ROWS - 2 };
    expect(collide(createBoard(), piece, 0, 1)).toBe(true);
  });

  test('이미 쌓인 블록과 겹치면 충돌한다', () => {
    const board = createBoard();
    board[2][4] = 'Z';
    const piece = { ...createPiece('O'), x: 4, y: 0 };
    expect(collide(board, piece, 0, 1)).toBe(true);
  });

  test('보드 위쪽(y < 0)은 충돌로 보지 않는다', () => {
    const piece = { ...createPiece('O'), y: -1 };
    expect(collide(createBoard(), piece)).toBe(false);
  });
});

describe('회전', () => {
  test('rotateMatrix는 시계 방향으로 90도 돌린다', () => {
    expect(rotateMatrix([[1, 0, 0], [1, 1, 1], [0, 0, 0]]))
      .toEqual([[0, 1, 1], [0, 1, 0], [0, 1, 0]]);
  });

  test('네 번 돌리면 원래 모양으로 돌아온다', () => {
    const m = createPiece('L').matrix;
    let r = m;
    for (let i = 0; i < 4; i++) r = rotateMatrix(r);
    expect(r).toEqual(m);
  });

  test('O 블록은 회전해도 그대로다', () => {
    const piece = createPiece('O');
    expect(tryRotate(createBoard(), piece)).toBe(piece);
  });

  test('벽에 붙어 있으면 안쪽으로 밀어서 회전한다', () => {
    // 세로로 선 I 블록을 오른쪽 벽에 붙여 둔다
    const vertical = rotateMatrix(createPiece('I').matrix);
    const piece = { type: 'I', matrix: vertical, x: COLS - 3, y: 5 };
    const rotated = tryRotate(createBoard(), piece);
    expect(rotated.matrix).not.toEqual(vertical);
    expect(collide(createBoard(), rotated)).toBe(false);
  });
});

describe('clearLines', () => {
  test('꽉 찬 줄만 지우고 위에 빈 줄을 채운다', () => {
    const board = createBoard();
    board[ROWS - 1].fill('I');
    board[ROWS - 2].fill('J');
    board[ROWS - 3][0] = 'T';

    const result = clearLines(board);

    expect(result.cleared).toBe(2);
    expect(result.board).toHaveLength(ROWS);
    expect(result.board[ROWS - 1][0]).toBe('T');   // 남은 블록이 아래로 내려옴
    expect(result.board[0].every(c => c === null)).toBe(true);
  });

  test('원래 보드는 바꾸지 않는다', () => {
    const board = createBoard();
    board[ROWS - 1].fill('I');
    clearLines(board);
    expect(board[ROWS - 1].every(Boolean)).toBe(true);
  });
});

describe('점수와 레벨', () => {
  test.each([
    [1, 1, 100],
    [2, 1, 300],
    [3, 1, 500],
    [4, 1, 800],
    [4, 3, 2400],
  ])('%i줄을 레벨 %i에서 지우면 %i점', (cleared, level, expected) => {
    expect(lineScore(cleared, level)).toBe(expected);
  });

  test('10줄마다 레벨이 오른다', () => {
    expect(levelFor(0)).toBe(1);
    expect(levelFor(9)).toBe(1);
    expect(levelFor(10)).toBe(2);
    expect(levelFor(25)).toBe(3);
  });

  test('레벨마다 20%씩 빨라지고 50ms보다 빨라지지는 않는다', () => {
    expect(dropIntervalFor(1)).toBe(1000);
    expect(dropIntervalFor(2)).toBe(800);
    expect(dropIntervalFor(3)).toBe(640);
    expect(dropIntervalFor(10)).toBe(134);
    expect(dropIntervalFor(14)).toBe(55);
    expect(dropIntervalFor(15)).toBe(50);
    expect(dropIntervalFor(30)).toBe(50);
  });

  test('최저 속도에 닿기 전까지는 레벨이 오를 때마다 항상 더 빨라진다', () => {
    for (let level = 1; level < 14; level++) {
      expect(dropIntervalFor(level + 1)).toBeLessThan(dropIntervalFor(level));
    }
  });
});
