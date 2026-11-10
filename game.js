import { createYard } from './scene.js';

const library = 'https://ecnzifm6trb8.feishu.cn/docx/U9QkdPv2qo8rbqx0E6cc2g4YnYb';
const routes = [
  {
    name: '启蒙站', code: '01 / AI BASICS', anchor: 'doxcngrRFnCT1CW7KooQL3yl7pd',
    question: 'AI 给了你三个陌生的参考链接。先做什么？',
    answers: ['看起来专业，就直接引用', '逐个打开，核对来源和原文', '再问一次，相同就当作正确'],
    right: 1, hint: '输出看起来可靠，也可能包含打不开的链接。试试找到原始来源。',
    cleared: '信号恢复。把 AI 的回答当作起点，再用原始资料核对。',
  },
  {
    name: '造物站', code: '02 / VIBE CODING', anchor: 'doxcnrHvB35vsNu2PekftoAda0c',
    question: 'AI 生成的网页在手机上横向溢出。下一步怎么做？',
    answers: ['只修改标题的颜色', '再生成整个网站，直到看着顺眼', '复现问题，找出撑宽的元素，改完再测'],
    right: 2, hint: '先在同样的窄屏条件下复现。一次改一处，才能知道哪一步有效。',
    cleared: '信号恢复。你完成了复现、修改和回测，这就是一次小迭代。',
  },
  {
    name: '开源站', code: '03 / OPEN SOURCE', anchor: 'doxcniS1rQKjhAVPuObCEXLBpSh',
    question: '你发现开源仓库的教程有一个坏链接。怎样贡献？',
    answers: ['写清位置和复现步骤提 Issue，或提交小 PR', '贴一张截图，不说明是哪一页', '把整个仓库复制走，只改自己的版本'],
    right: 0, hint: '让维护者能找到问题并复现。小范围、可验证的修改最适合入门。',
    cleared: '信号恢复。定位准确的一条 Issue，也能成为有用的开源贡献。',
  },
];

const terminal = document.querySelector('#game');
const yard = document.querySelector('#yard');
const dispatch = document.querySelector('#dispatch');
const switches = [...document.querySelectorAll('[data-station]')];
const mapSwitches = [...document.querySelectorAll('[data-map-station]')];
const allSwitches = [...switches, ...mapSwitches];
const mapLines = [...document.querySelectorAll('[data-line]')];
const mapTrain = document.querySelector('#map-train');
const mapLengths = mapLines.map(path => path.getTotalLength());
const panel = document.querySelector('#control-main');
const challenge = document.querySelector('#challenge');
const question = document.querySelector('#question');
const answers = document.querySelector('#answers');
const feedback = document.querySelector('#feedback');
const motionButton = document.querySelector('#motion');
const audioButton = document.querySelector('#audio');
const nextButton = document.querySelector('#next');
const phaseLabel = document.querySelector('#phase-label');
const announcement = document.querySelector('#announcement');
const speedReadout = document.querySelector('#speed');
const distanceReadout = document.querySelector('#distance');
const yardName = document.querySelector('#yard-name');
const stationCode = document.querySelector('#station-code');
const resultActions = document.querySelector('#result-actions');
const mediaMotion = matchMedia('(prefers-reduced-motion: reduce)');
const STORAGE_KEY = 'tiedao-rail-protocol-v1';
const MAX_TIME = 5.4;
const SWITCH_LIMIT = .38;
const TRACK_METERS = 88;

const state = { route: 0, progress: 0, elapsed: 0, phase: 'ready' };
let completed = new Set();
try {
  const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  if (Array.isArray(stored)) completed = new Set(stored.filter(item => Number.isInteger(item) && item >= 0 && item < routes.length));
} catch { /* Progress is still available for this visit. */ }

let staticView = mediaMotion.matches;
let sound = false;
let audioContext;
let world;
let selectedLocked = false;
let previousFrame = performance.now();
const pad = (value, width = 3) => String(value).padStart(width, '0');

function ping(notes) {
  if (!sound || audioContext?.state !== 'running') return;
  notes.forEach((frequency, index) => {
    const oscillator = audioContext.createOscillator();
    const envelope = audioContext.createGain();
    const start = audioContext.currentTime + index * .105;
    oscillator.type = 'triangle';
    oscillator.frequency.value = frequency;
    envelope.gain.setValueAtTime(0, start);
    envelope.gain.linearRampToValueAtTime(.085, start + .023);
    envelope.gain.exponentialRampToValueAtTime(.001, start + .16);
    oscillator.connect(envelope).connect(audioContext.destination);
    oscillator.start(start);
    oscillator.stop(start + .17);
  });
}

function setPhase(phase, label) {
  state.phase = phase;
  yard.dataset.phase = phase;
  phaseLabel.lastChild.textContent = ` ${label}`;
}

function updatePassport() {
  document.querySelector('#score').textContent = `${pad(completed.size, 2)} / 03`;
  document.querySelectorAll('[data-stamp]').forEach(stamp => {
    const done = completed.has(Number(stamp.dataset.stamp));
    stamp.toggleAttribute('data-done', done);
    stamp.setAttribute('aria-label', `${stamp.textContent.trim()} ${done ? '已点亮' : '未点亮'}`);
  });
  terminal.toggleAttribute('data-complete', completed.size === routes.length);
  document.querySelector('#complete-flag').hidden = completed.size !== routes.length;
}

function updateMapPosition() {
  const path = mapLines[state.route];
  const commonLength = 46;
  const distance = state.progress <= SWITCH_LIMIT
    ? commonLength * state.progress / SWITCH_LIMIT
    : commonLength + (mapLengths[state.route] - commonLength) * (state.progress - SWITCH_LIMIT) / (1 - SWITCH_LIMIT);
  const point = path.getPointAtLength(distance);
  mapTrain.setAttribute('cx', point.x.toFixed(1));
  mapTrain.setAttribute('cy', point.y.toFixed(1));
}

function updateDestination() {
  yard.dataset.route = String(state.route);
  switches.forEach((button, index) => button.setAttribute('aria-pressed', String(index === state.route)));
  mapSwitches.forEach((button, index) => button.setAttribute('aria-pressed', String(index === state.route)));
  updateMapPosition();
  if (state.phase !== 'ready') {
    yardName.textContent = routes[state.route].name;
    stationCode.textContent = routes[state.route].code;
  }
}

function selectRoute(route, announce = true) {
  if (selectedLocked || !['ready', 'travel', 'paused'].includes(state.phase)) return;
  state.route = route;
  updateDestination();
  if (announce) {
    announcement.textContent = `道岔已切换到${routes[route].name}`;
    ping([420 + route * 95]);
  }
}

function drive() {
  if (state.phase === 'ready' || state.phase === 'paused') {
    const starting = state.phase === 'ready';
    setPhase('travel', '列车运行');
    updateDestination();
    dispatch.firstElementChild.textContent = '暂停列车';
    if (starting) {
      document.querySelector('#control-title').textContent = '列车已出发';
      document.querySelector('#control-help').textContent = '道岔尚未锁定，仍可切换支线。';
      // On narrow displays, keep the rail viewport visible during the journey.
      if (innerWidth <= 700) yard.scrollIntoView({ behavior: staticView ? 'instant' : 'smooth', block: 'start' });
      ping([295, 443]);
    }
    announcement.textContent = `列车开往${routes[state.route].name}`;
  } else if (state.phase === 'travel') {
    setPhase('paused', '列车暂停');
    dispatch.firstElementChild.textContent = '继续行驶';
    speedReadout.textContent = '000';
    announcement.textContent = '列车已暂停';
  }
}

function answer(index) {
  if (state.phase !== 'challenge') return;
  const route = routes[state.route];
  const buttons = [...answers.children];
  if (index !== route.right) {
    buttons[index].dataset.wrong = '';
    feedback.textContent = route.hint;
    ping([180, 135]);
    return;
  }
  setPhase('cleared', '信号已恢复');
  buttons[index].dataset.right = '';
  buttons.forEach(button => { button.disabled = true; });
  completed.add(state.route);
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...completed])); } catch { /* Storage is optional. */ }
  updatePassport();
  feedback.textContent = completed.size === routes.length ? `${route.cleared} 三站信号已点亮，全线通车！` : route.cleared;
  resultActions.hidden = false;
  document.querySelector('#route-resource').focus({ preventScroll: true });
  ping([440, 554, 659, 880]);
}

function arrive() {
  setPhase('challenge', '到站 · 信号待修');
  const route = routes[state.route];
  speedReadout.textContent = '000';
  panel.hidden = true;
  challenge.hidden = false;
  resultActions.hidden = true;
  feedback.textContent = '选择一种处理方式，点亮本站信号。';
  document.querySelector('#question-code').textContent = `${route.code} / SIGNAL CHECK`;
  question.textContent = route.question;
  document.querySelector('#route-resource').href = `${library}#${route.anchor}`;
  answers.replaceChildren(...route.answers.map((label, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = `${'ABC'[index]}　${label}`;
    button.addEventListener('click', () => answer(index));
    return button;
  }));
  const box = terminal.getBoundingClientRect();
  if (box.top < innerHeight && box.bottom > 0) question.focus({ preventScroll: innerWidth > 700 });
  announcement.textContent = `抵达${route.name}，请选择信号谜题答案`;
  ping([390, 523]);
}

function returnToDepot() {
  const following = routes.findIndex((_, index) => !completed.has(index));
  state.elapsed = state.progress = 0;
  selectedLocked = false;
  setPhase('ready', '待发车');
  yardName.textContent = '铁大站';
  stationCode.textContent = '站台 / DEPOT';
  speedReadout.textContent = distanceReadout.textContent = '000';
  panel.hidden = false;
  challenge.hidden = true;
  document.querySelector('#control-title').textContent = '选择一条支线';
  document.querySelector('#control-help').textContent = '选站后发车。列车经过道岔前，你仍可切换目的地。';
  dispatch.firstElementChild.textContent = '发车';
  allSwitches.forEach(button => { button.disabled = false; });
  selectRoute(following < 0 ? (state.route + 1) % routes.length : following, false);
  dispatch.focus();
}

function tick(now) {
  const dt = Math.min(.055, (now - previousFrame) / 1000);
  previousFrame = now;
  if (state.phase === 'travel') {
    state.elapsed = Math.min(MAX_TIME, state.elapsed + dt);
    const t = state.elapsed / MAX_TIME;
    state.progress = t * t * (3 - 2 * t);
    updateMapPosition();
    speedReadout.textContent = pad(Math.round(t * (1 - t) * 6 * TRACK_METERS / MAX_TIME * 3.6));
    distanceReadout.textContent = pad(Math.round(state.progress * TRACK_METERS));
    if (state.progress >= SWITCH_LIMIT && !selectedLocked) {
      selectedLocked = true;
      allSwitches.forEach(button => { button.disabled = true; });
      document.querySelector('#control-help').textContent = `道岔已锁定，列车正在开往${routes[state.route].name}。`;
      announcement.textContent = '已通过道岔，目的地锁定';
      ping([580]);
    }
    if (t === 1) arrive();
  }
  // Static mode keeps the camera at the depot and updates the HUD normally.
  world?.render(staticView ? { ...state, progress: 0 } : state, now);
  requestAnimationFrame(tick);
}

allSwitches.forEach(button => {
  button.disabled = false;
  button.addEventListener('click', () => selectRoute(Number(button.dataset.station ?? button.dataset.mapStation)));
});
dispatch.disabled = false;
dispatch.addEventListener('click', drive);
nextButton.addEventListener('click', returnToDepot);
document.addEventListener('keydown', event => {
  if (event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
  if (event.target.closest?.('input, textarea, select, [contenteditable="true"]')) return;
  const box = terminal.getBoundingClientRect();
  if (box.bottom < 0 || box.top >= innerHeight) return;
  if (/^[123]$/.test(event.key)) selectRoute(Number(event.key) - 1);
  if (event.code === 'Space' && !event.target.closest?.('a,button,summary')) {
    if (['ready', 'travel', 'paused'].includes(state.phase)) {
      event.preventDefault();
      drive();
    }
  }
});

if (window.AudioContext) {
  audioButton.hidden = false;
  audioButton.addEventListener('click', async () => {
    if (!sound) {
      try {
        audioContext ??= new AudioContext();
        await audioContext.resume();
      } catch { return; }
    }
    sound = !sound;
    audioButton.setAttribute('aria-pressed', String(sound));
    audioButton.querySelector('strong').textContent = sound ? '开' : '关';
    ping([480, 640]);
  });
}

function updateMotion() {
  motionButton.setAttribute('aria-pressed', String(staticView));
  motionButton.textContent = staticView ? '恢复运镜' : '静止画面';
  document.querySelector('#view-mode').textContent = staticView ? '静止视角' : '实时 3D';
  world?.resetPointer();
}
motionButton.addEventListener('click', () => {
  staticView = !staticView;
  updateMotion();
});
mediaMotion.addEventListener('change', () => {
  staticView = mediaMotion.matches;
  if (world) updateMotion();
});

function fallback() {
  motionButton.hidden = true;
  document.querySelector('#view-mode').textContent = '线路视图';
}
try {
  world = createYard(yard, () => staticView, fallback);
  if (world) {
    motionButton.hidden = false;
    updateMotion();
  }
} catch { fallback(); }

updatePassport();
requestAnimationFrame(tick);
