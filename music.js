// 배경음악: 러시아 민요 "코로베이니키"(퍼블릭 도메인)를 Web Audio API로 직접 합성해 반복 재생합니다.
// 선율(사각파)과 베이스(삼각파) 두 성부의 간단한 자체 편곡입니다.
const Music = (() => {
  'use strict';

  const NOTE_INDEX = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const STORAGE_KEY = 'blocks.music';

  function freq(name) {
    const m = /^([A-G])(#?)(\d)$/.exec(name);
    const midi = 12 * (Number(m[3]) + 1) + NOTE_INDEX[m[1]] + (m[2] ? 1 : 0);
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  // [음, 길이(8분음표 단위)] — null은 쉼표. 한 마디 = 8
  const MELODY = [
    ['E5', 2], ['B4', 1], ['C5', 1], ['D5', 2], ['C5', 1], ['B4', 1],
    ['A4', 2], ['A4', 1], ['C5', 1], ['E5', 2], ['D5', 1], ['C5', 1],
    ['B4', 3], ['C5', 1], ['D5', 2], ['E5', 2],
    ['C5', 2], ['A4', 2], ['A4', 2], [null, 2],
    [null, 1], ['D5', 2], ['F5', 1], ['A5', 2], ['G5', 1], ['F5', 1],
    ['E5', 3], ['C5', 1], ['E5', 2], ['D5', 1], ['C5', 1],
    ['B4', 2], ['B4', 1], ['C5', 1], ['D5', 2], ['E5', 2],
    ['C5', 2], ['A4', 2], ['A4', 2], [null, 2],
  ];

  // 마디별 베이스 근음 — 8분음표로 낮은 옥타브/높은 옥타브를 번갈아 연주
  const BASS_ROOTS = ['E', 'A', 'E', 'A', 'D', 'C', 'E', 'A'];

  // 8분음표 한 칸(step)마다 시작하는 음 목록으로 미리 펼쳐 둡니다.
  const TOTAL_STEPS = BASS_ROOTS.length * 8;
  const STEPS = Array.from({ length: TOTAL_STEPS }, () => []);
  (() => {
    let s = 0;
    for (const [note, len] of MELODY) {
      if (note) STEPS[s].push({ f: freq(note), len, type: 'square', gain: 0.06 });
      s += len;
    }
    BASS_ROOTS.forEach((root, bar) => {
      for (let i = 0; i < 8; i++) {
        const note = root + (i % 2 === 0 ? '2' : '3');
        STEPS[bar * 8 + i].push({ f: freq(note), len: 1, type: 'triangle', gain: 0.22 });
      }
    });
  })();

  let ctx = null;
  let master = null;
  let timer = null;
  let playing = false;
  let step = 0;
  let nextTime = 0;
  let bpm = 144;
  let enabled = loadEnabled();

  function loadEnabled() {
    try {
      return localStorage.getItem(STORAGE_KEY) !== 'off';
    } catch (e) {
      return true;
    }
  }

  function saveEnabled() {
    try {
      localStorage.setItem(STORAGE_KEY, enabled ? 'on' : 'off');
    } catch (e) { /* 저장 불가 환경은 무시 */ }
  }

  function ensureContext() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
    }
    if (!master) {
      master = ctx.createGain();
      master.gain.value = 0.6;
      master.connect(ctx.destination);
    }
    return true;
  }

  function playNote(f, t, dur, type, vol) {
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = type;
    osc.frequency.value = f;
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    env.gain.setValueAtTime(vol, t + dur * 0.7);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(env).connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function schedule() {
    const ahead = ctx.currentTime + 0.15;
    while (nextTime < ahead) {
      const eighth = 60 / bpm / 2;
      for (const n of STEPS[step]) {
        playNote(n.f, nextTime, n.len * eighth * 0.92, n.type, n.gain);
      }
      nextTime += eighth;
      step = (step + 1) % TOTAL_STEPS;
    }
  }

  function start() {
    if (!enabled || playing) return;
    if (!ensureContext()) return;
    if (ctx.state === 'suspended') ctx.resume();
    nextTime = ctx.currentTime + 0.06;
    playing = true;
    schedule();
    timer = setInterval(schedule, 25);
  }

  // reset=true면 곡 처음으로, false면 멈춘 위치부터 다시 재생
  function stop(reset) {
    if (timer) clearInterval(timer);
    timer = null;
    playing = false;
    if (reset) step = 0;
    if (master) {
      const old = master;
      old.gain.setTargetAtTime(0, ctx.currentTime, 0.02);
      setTimeout(() => old.disconnect(), 200);
      master = null;
    }
  }

  function setLevel(level) {
    bpm = Math.min(144 + (level - 1) * 6, 204);
  }

  function setEnabled(value) {
    enabled = value;
    saveEnabled();
  }

  return {
    start,
    stop,
    setLevel,
    setEnabled,
    isEnabled: () => enabled,
  };
})();
