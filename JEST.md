# Jest 유닛 테스트 도입 가이드

Node.js가 없는 현재 환경(WSL Ubuntu)에서 Node.js 설치부터 Jest로 이 게임의 테스트를 작성하고 실행하는 방법까지 정리했습니다.

> Node.js와 Jest는 **개발할 때 테스트를 돌리는 용도**로만 씁니다. 게임은 지금처럼 빌드 없이 브라우저에서 바로 실행되고, GitHub Pages 배포 방식도 바뀌지 않습니다.

---

## 1. Node.js 설치 (nvm 사용)

Ubuntu 기본 저장소(`apt install nodejs`)의 Node.js는 버전이 오래된 경우가 많습니다. 버전 관리 도구 **nvm**으로 설치하는 것을 권장합니다. nvm은 sudo 없이 홈 디렉터리에 설치됩니다.

### 1-1. 준비 패키지 설치

```bash
sudo apt update
sudo apt install -y curl ca-certificates build-essential
```

### 1-2. nvm 설치

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
```

> 최신 nvm 버전은 https://github.com/nvm-sh/nvm 의 README에서 확인할 수 있습니다. 위 주소의 `v0.40.3` 부분만 바꾸면 됩니다.

설치가 끝나면 터미널을 새로 열거나 아래 명령으로 설정을 다시 불러옵니다.

```bash
source ~/.bashrc
command -v nvm   # "nvm"이 출력되면 성공
```

### 1-3. Node.js LTS 설치

```bash
nvm install --lts
nvm alias default 'lts/*'
node -v
npm -v
```

`node -v`, `npm -v`가 버전 번호를 출력하면 준비 완료입니다.

---

## 2. 프로젝트에 Jest 설치

GitHub Pages로 배포하는 폴더(`~/work/tetris`) 기준입니다.

```bash
cd ~/work/tetris
npm init -y
npm install --save-dev jest jest-environment-jsdom
```

- `jest`: 테스트 실행 도구
- `jest-environment-jsdom`: 브라우저의 `document`, `window`를 흉내 내는 환경 (DOM 테스트에 필요)

`package.json`의 `"scripts"`를 아래처럼 바꿉니다.

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  }
}
```

`node_modules`는 저장소에 올리지 않도록 `.gitignore`에 추가합니다.

```bash
printf 'node_modules/\ncoverage/\n' >> .gitignore
```

> `package.json`과 `package-lock.json`은 커밋합니다. 다른 PC에서는 `npm install`(또는 `npm ci`) 한 번으로 같은 환경이 갖춰집니다.

---

## 3. 테스트하기 쉬운 구조로 나누기

지금 `game.js`는 전체가 즉시 실행 함수 `(() => { ... })()`로 감싸져 있고, 불러오자마자 DOM과 캔버스에 접근합니다. 이 상태로는 충돌 검사나 줄 삭제 같은 로직만 따로 불러와 테스트할 수 없습니다.

그래서 **DOM과 상관없는 순수 로직**을 `tetris-core.js`로 분리하는 것을 권장합니다.

| 파일 | 역할 | 테스트 |
| --- | --- | --- |
| `tetris-core.js` (신규) | 블록 모양, 충돌 검사, 회전, 줄 삭제, 점수·레벨 계산 | Jest 유닛 테스트 (쉬움) |
| `game.js` | 화면 그리기, 키보드·터치 입력, 게임 루프 | jsdom 테스트 (선택) |
| `music.js` | 배경음악 | Web Audio가 필요해 유닛 테스트 대상에서 제외 |

### 3-1. `tetris-core.js` 예시

브라우저에서는 `<script>`로 불러 전역 `TetrisCore`로 쓰고, Jest(Node.js)에서는 `require()`로 불러올 수 있게 마지막에 두 가지 방식으로 내보냅니다. 빌드 도구가 없어도 됩니다.

```js
// tetris-core.js
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
  const dropIntervalFor = level => Math.max(100, 1000 - (level - 1) * 100);

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
```

### 3-2. `game.html`과 `game.js` 수정

`game.html`에서 `game.js`보다 먼저 불러옵니다.

```html
<script src="music.js"></script>
<script src="tetris-core.js"></script>
<script src="game.js"></script>
```

`game.js`에서는 같은 이름의 기존 함수를 지우고 `TetrisCore`의 함수를 씁니다. 보드를 인자로 넘기는 형태로 바뀝니다.

```js
const { createBoard, createPiece, collide, tryRotate, clearLines,
        lineScore, levelFor, dropIntervalFor } = TetrisCore;

// 예: 기존 collide(piece, 0, 1)  →  collide(board, piece, 0, 1)
// 예: 기존 rotate()              →  piece = tryRotate(board, piece);
// 예: 줄 삭제
const result = clearLines(board);
board = result.board;
if (result.cleared) {
  score += lineScore(result.cleared, level);
  lines += result.cleared;
  level = levelFor(lines);
  dropInterval = dropIntervalFor(level);
}
```

---

## 4. 유닛 테스트 작성

`tests/tetris-core.test.js`:

```js
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

  test('레벨이 오를수록 빨라지고 100ms보다 빨라지지는 않는다', () => {
    expect(dropIntervalFor(1)).toBe(1000);
    expect(dropIntervalFor(2)).toBe(900);
    expect(dropIntervalFor(20)).toBe(100);
  });
});
```

---

## 5. 테스트 실행

```bash
npm test                 # 전체 테스트 한 번 실행
npm run test:watch       # 파일을 저장할 때마다 자동으로 다시 실행
npm run test:coverage    # 커버리지 보고서 (coverage/ 폴더에 생성)
npx jest -t "clearLines" # 이름에 "clearLines"가 들어간 테스트만 실행
```

성공하면 다음과 비슷하게 출력됩니다.

```
 PASS  tests/tetris-core.test.js
  createBoard
    ✓ 20×10 크기의 빈 보드를 만든다
  collide
    ✓ 빈 보드 가운데에서는 충돌하지 않는다
  ...
Tests:       19 passed, 19 total
```

---

## 6. (선택) DOM 테스트: jsdom

화면 동작(시작 버튼, 점수 표시 등)까지 테스트하려면 jsdom 환경을 씁니다. jsdom은 캔버스 그리기를 지원하지 않으므로 `jest-canvas-mock`도 함께 설치합니다.

```bash
npm install --save-dev jest-canvas-mock
```

`tests/game.dom.test.js`:

```js
/**
 * @jest-environment jsdom
 */
require('jest-canvas-mock');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

// game.js는 document에 키 입력 리스너를 등록하므로 파일당 한 번만 불러옵니다.
beforeAll(() => {
  // game.html의 <body>만 넣고 스크립트를 순서대로 실행
  const html = fs.readFileSync(path.join(root, 'game.html'), 'utf8');
  document.body.innerHTML = html.match(/<body[^>]*>([\s\S]*)<\/body>/)[1];

  window.matchMedia = window.matchMedia || (() => ({ matches: false, addEventListener() {} }));
  window.requestAnimationFrame = () => 0;
  window.cancelAnimationFrame = () => {};
  window.Music = { start() {}, stop() {}, setLevel() {}, setEnabled() {}, isEnabled: () => true };

  for (const file of ['tetris-core.js', 'game.js']) {
    const code = fs.readFileSync(path.join(root, file), 'utf8');
    window.eval(code); // 전역 범위에서 실행 (브라우저의 <script>와 같은 효과)
  }
});

test('시작 → 일시정지 → 계속하기 흐름', () => {
  const overlay = document.getElementById('overlay');
  const pauseBtn = document.getElementById('pause-btn');

  // 시작하기를 누르면 안내 화면이 사라지고 일시정지 버튼이 켜진다
  document.getElementById('start-btn').click();
  expect(overlay.hidden).toBe(true);
  expect(pauseBtn.disabled).toBe(false);
  expect(document.getElementById('score').textContent).toBe('0');

  // P 키를 누르면 일시정지 화면이 나타난다
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'p' }));
  expect(overlay.hidden).toBe(false);
  expect(document.getElementById('overlay-title').textContent).toBe('일시정지');

  // 한 번 더 누르면 계속한다
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'p' }));
  expect(overlay.hidden).toBe(true);
});
```

> `music.js`는 Web Audio API가 필요해서 위 예시처럼 가짜 `Music` 객체로 바꿔 넣고 테스트합니다.

---

## 7. (선택) GitHub에 push할 때마다 자동으로 테스트

`.github/workflows/test.yml`:

```yaml
name: test
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: lts/*
          cache: npm
      - run: npm ci
      - run: npm test
```

push하면 저장소의 **Actions** 탭에서 테스트 결과를 볼 수 있습니다. GitHub Pages 배포(브랜치에서 배포)와는 따로 동작합니다.

---

## 8. 정리: 최종 폴더 구조

```
tetris/
├── index.html
├── game.html
├── style.css
├── game.js
├── tetris-core.js        # 신규: 테스트 가능한 순수 로직
├── music.js
├── package.json          # 신규
├── package-lock.json     # 신규
├── .gitignore            # node_modules/, coverage/ 추가
└── tests/
    ├── tetris-core.test.js
    └── game.dom.test.js  # 선택
```

## 문제 해결

| 증상 | 해결 |
| --- | --- |
| `nvm: command not found` | 터미널을 새로 열거나 `source ~/.bashrc`를 실행하세요. |
| `Cannot find module '../tetris-core'` | `tetris-core.js` 마지막의 `module.exports` 부분이 있는지, 테스트 파일 경로가 맞는지 확인하세요. |
| `document is not defined` | DOM 테스트 파일 맨 위에 `@jest-environment jsdom` 주석이 있는지, `jest-environment-jsdom`을 설치했는지 확인하세요. |
| `HTMLCanvasElement.prototype.getContext ... not implemented` | `jest-canvas-mock`을 설치하고 테스트 파일에서 `require('jest-canvas-mock')`를 하세요. |
| 브라우저에서 `TetrisCore is not defined` | `game.html`에서 `tetris-core.js`를 `game.js`보다 먼저 불러오는지 확인하세요. |
