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
