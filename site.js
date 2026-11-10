import './scene.js';

const root = document.documentElement;
const toggle = document.querySelector('.motion-toggle');
const mediaMotion = matchMedia('(prefers-reduced-motion: reduce)');
let manuallyPaused = false;

function setMotion() {
  const paused = manuallyPaused || mediaMotion.matches;
  root.toggleAttribute('data-motion-paused', paused);
  toggle.setAttribute('aria-pressed', String(paused));
  toggle.textContent = mediaMotion.matches ? '动效已减弱' : paused ? '恢复动效' : '暂停动效';
  toggle.disabled = mediaMotion.matches;
  window.dispatchEvent(new Event('site-motion-change'));
}
toggle.hidden = false;
toggle.addEventListener('click', () => {
  manuallyPaused = !manuallyPaused;
  setMotion();
});
mediaMotion.addEventListener('change', setMotion);
setMotion();

const interlocking = document.querySelector('.interlocking');
const buttons = [...interlocking.querySelectorAll('[data-route-select]')];
const cards = [...interlocking.querySelectorAll('.route-card')];
const lineStatus = document.querySelector('#line-status');
function selectRoute(index) {
  interlocking.dataset.route = String(index);
  lineStatus.textContent = `S0${index + 1}`;
  buttons.forEach((button, i) => button.setAttribute('aria-pressed', String(i === index)));
  cards.forEach((card, i) => { card.hidden = i !== index; });
}
buttons.forEach((button, i) => {
  button.disabled = false;
  button.addEventListener('click', () => selectRoute(i));
  button.addEventListener('keydown', event => {
    const direction = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (!direction) return;
    event.preventDefault();
    const target = (i + direction + buttons.length) % buttons.length;
    selectRoute(target);
    buttons[target].focus();
  });
});
selectRoute(0);
interlocking.dataset.enhanced = '';

const navigators = [...document.querySelectorAll('[data-nav]')];
const chapters = navigators.map(link => document.getElementById(link.dataset.nav));
const header = document.querySelector('.header');
const progress = document.querySelector('.scroll-track span');
let pending = false;
let current = -2;
function updatePosition() {
  pending = false;
  const total = Math.max(1, root.scrollHeight - innerHeight);
  progress.style.transform = `scaleX(${Math.max(0, Math.min(1, scrollY / total))})`;
  const readingLine = header.getBoundingClientRect().bottom + Math.min(110, innerHeight * .18);
  let next = -1;
  chapters.forEach((chapter, index) => {
    if (chapter.getBoundingClientRect().top <= readingLine) next = index;
  });
  if (total > 1 && scrollY >= total - 3) next = chapters.length - 1;
  if (current === next) return;
  current = next;
  navigators.forEach((link, index) => {
    if (index === current) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  });
}
function queuePosition() {
  if (pending) return;
  pending = true;
  requestAnimationFrame(updatePosition);
}
window.addEventListener('scroll', queuePosition, { passive: true });
window.addEventListener('resize', queuePosition);
document.querySelectorAll('.dispatch details').forEach(step => step.addEventListener('toggle', queuePosition));
queuePosition();

if ('IntersectionObserver' in window) {
  const visibility = new IntersectionObserver(entries => {
    entries.forEach(({ target, isIntersecting }) => {
      if (!isIntersecting) return;
      target.dataset.entered = '';
      visibility.unobserve(target);
    });
  }, { threshold: .12 });
  document.querySelectorAll('.reveal').forEach(section => visibility.observe(section));
  root.dataset.scrollMotion = '';
}
