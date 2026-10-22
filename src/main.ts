import './styles/tokens.css';
import './styles/base.css';
import './styles/screens.css';
import gsap from 'gsap';
import {
  ACCENT,
  ACCENT_COLORS,
  ACCESSORIES,
  ACCESSORY_BUBBLES,
  BODY_COLORS,
  COLOR_BUBBLES,
  FINISHES,
  GLOW_COLORS,
  INSTALL_LOG,
  MOVES,
  MOVE_BUBBLES,
  REVEAL,
  SLOTS,
  type Move,
  type Personality,
  type Slot,
} from './data/content';
import { cloneLook, decodeShare, DEFAULT_LOOK, encodeShare, isCustomized, score, type Look, type Screen } from './state';
import { setSound, sfx, soundOn } from './sound';
import { ICON } from './ui/icons';
import { confirmModal, renderScreen, screenTitle, shareModal, type View } from './ui/screens';
import { renderCard } from './ui/card';
import type { Stage } from './three/stage';

// ---------- state ----------

const shuffle = (n: number) => {
  const a = [...Array(n).keys()];
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const v: View = {
  screen: 'boot',
  qOrder: [],
  personality: null,
  mix: {},
  look: cloneLook(DEFAULT_LOOK),
  tab: 'color',
  slot: 'head',
  playing: null,
  shared: false,
};
let answers: Personality[] = [];
let computed: { winner: Personality; mix: View['mix'] } | null = null;
let stage: Stage | null = null;
let installTl: gsap.core.Timeline | null = null;
let playingTimer = 0;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- DOM ----------

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
  <header class="topbar">
    <a class="logo" href="./" data-action="home" aria-label="Roo — home"><span class="logo-mark" aria-hidden="true"></span>Roo</a>
    <div class="topbar-actions">
      <button class="icon-btn" data-action="home" aria-label="Home">${ICON.home}</button>
      <button class="icon-btn" data-action="sound" aria-label="Sound" aria-pressed="false">${ICON.soundOff}</button>
    </div>
  </header>
  <div class="stage" data-stage>
    <div class="glow" aria-hidden="true"></div>
    <div class="bubble" role="status" aria-live="polite" hidden></div>
  </div>
  <main class="content" data-content></main>
  <div class="overlay" data-overlay hidden></div>
  <div class="flash" aria-hidden="true"></div>
  <div class="toast" role="status" aria-live="polite"></div>
  <p class="sr-only" aria-live="polite" data-announce></p>
`;
const $ = <T extends HTMLElement>(sel: string) => app.querySelector<T>(sel)!;
const stageEl = $('[data-stage]');
const content = $('[data-content]');
const bubbleEl = $('.bubble');
const overlay = $('[data-overlay]');
const toastEl = $('.toast');
const announcer = $('[data-announce]');

// ---------- bubble & toast ----------

let bubbleTimer = 0;
/** Speech bubble; tinted with the option's (or current personality's) colour. */
function bubble(text: string | null, ms = 0, color?: string) {
  clearTimeout(bubbleTimer);
  if (!text) {
    bubbleEl.classList.remove('show');
    bubbleTimer = window.setTimeout(() => (bubbleEl.hidden = true), 200);
    return;
  }
  bubbleEl.hidden = false;
  bubbleEl.textContent = text;
  bubbleEl.style.setProperty('--bubble', color ?? (v.personality ? ACCENT[v.personality] : '#ffffff'));
  requestAnimationFrame(() => bubbleEl.classList.add('show'));
  if (ms) bubbleTimer = window.setTimeout(() => bubble(defaultBubble()), ms);
}

// what Roo says by default on the intro / reveal; both lines change after a moment
let introLine: 'hi' | 'ear' | null = 'hi'; // null while Roo is sulking
let revealLater = false;
let lineTimer = 0;

function defaultBubble(): string | null {
  if (v.screen === 'intro') return introLine === 'hi' ? 'Oh! A human. Hi.' : introLine === 'ear' ? 'Please do not pull my ear.' : null;
  if (v.screen === 'reveal' && v.personality) {
    const r = REVEAL[v.personality];
    return revealLater && r.later ? r.later : r.bubble;
  }
  return null;
}

/** Schedules the follow-up line ("Please do not pull my ear.", "Don't look at me, please."). */
function scheduleLines(delay: number) {
  clearTimeout(lineTimer);
  if (v.screen === 'intro' && introLine) {
    introLine = 'hi';
    lineTimer = window.setTimeout(() => {
      if (v.screen !== 'intro' || !introLine) return;
      introLine = 'ear';
      bubble(defaultBubble());
    }, delay + 3500);
  }
  if (v.screen === 'reveal' && v.personality) {
    revealLater = false;
    const p = v.personality;
    if (REVEAL[p].later)
      lineTimer = window.setTimeout(() => {
        if (v.screen !== 'reveal' || v.personality !== p) return;
        revealLater = true;
        bubble(defaultBubble());
      }, delay + 5000);
  }
}

let toastTimer = 0;
function toast(text: string) {
  toastEl.textContent = text;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toastEl.classList.remove('show'), 1800);
}

// ---------- rendering ----------

function syncStage() {
  stage?.sync({ screen: v.screen === 'share' ? 'customize' : v.screen, personality: v.personality, look: v.look });
  const accent = v.personality ? ACCENT[v.personality] : ACCENT.neutral;
  app.style.setProperty('--accent', accent);
  app.dataset.screen = v.screen;
}

/** Crossfade to a new screen (0.45 s ease-out). */
function go(screen: Screen) {
  const from = v.screen;
  v.screen = screen;
  installTl?.kill();
  syncStage();

  const sameShell = (from === 'customize' && screen === 'share') || (from === 'share' && screen === 'customize');
  if (sameShell) {
    renderOverlay();
    if (screen === 'customize') content.querySelector<HTMLElement>('[data-action="share"]')?.focus();
    return;
  }
  renderOverlay();

  const old = content.querySelector('.screen:not(.leaving)');
  const el = document.createElement('div');
  el.className = `screen screen-${screen === 'share' ? 'customize' : screen}`;
  el.innerHTML = renderScreen(v);
  content.appendChild(el);
  if (old) {
    old.classList.add('leaving');
    old.setAttribute('inert', '');
    old.setAttribute('aria-hidden', 'true');
    window.setTimeout(() => old.remove(), reduced ? 0 : 450);
  }
  requestAnimationFrame(() => el.classList.add('in'));

  // big reveal: the 3D build-up runs first, the name and the bubble land after it
  const big = screen === 'reveal' && (from === 'installing' || from === 'boot') && !reduced;
  if (big) el.classList.add('big');
  scheduleLines(big ? 2400 : 0);
  bubble(null);
  if (big) window.setTimeout(() => v.screen === 'reveal' && bubble(defaultBubble()), 2400);
  else bubble(defaultBubble());
  announcer.textContent = screenTitle(v);
  if (screen !== 'boot') el.querySelector<HTMLElement>('h1, h2')?.focus({ preventScroll: true });

  if (screen === 'boot') window.setTimeout(() => v.screen === 'boot' && go('intro'), 2200);
  if (screen === 'installing') runInstall(el);
}

/** Restarts the reveal's staged text animation (persona chips). */
function replayBigReveal() {
  const el = content.querySelector('.screen:not(.leaving)');
  if (!el || reduced) return;
  el.classList.remove('big');
  void (el as HTMLElement).offsetWidth;
  el.classList.add('big');
}

/** Re-render the current screen in place (no crossfade), keeping focus. */
function refresh() {
  const el = content.querySelector('.screen:not(.leaving)');
  if (!el) return;
  const active = document.activeElement as HTMLElement | null;
  const key = active?.dataset ? `[data-action="${active.dataset.action}"]${active.dataset.id ? `[data-id="${active.dataset.id}"]` : ''}${active.dataset.tab ? `[data-tab="${active.dataset.tab}"]` : ''}${active.dataset.slot ? `[data-slot="${active.dataset.slot}"]` : ''}${active.dataset.move ? `[data-move="${active.dataset.move}"]` : ''}${active.dataset.p ? `[data-p="${active.dataset.p}"]` : ''}` : '';
  const inside = active && el.contains(active);
  el.innerHTML = renderScreen(v);
  if (inside && key) el.querySelector<HTMLElement>(key)?.focus({ preventScroll: true });
}

function renderOverlay() {
  if (v.screen === 'share') {
    overlay.innerHTML = shareModal(shareLink());
    overlay.hidden = false;
    overlay.querySelector<HTMLElement>('h2')?.focus();
    void updateCard();
  } else if (!overlay.querySelector('[role="alertdialog"]')) {
    overlay.hidden = true;
    overlay.innerHTML = '';
  }
}

function shareLink() {
  return `${location.origin}${location.pathname}?${encodeShare(v.personality!, v.mix, v.look)}`;
}

async function cardBlob(): Promise<Blob | null> {
  if (!stage || !v.personality) return null;
  const c = await renderCard(stage.snapshot(), v.personality, v.mix);
  return new Promise((res) => c.toBlob(res, 'image/png'));
}

let cardUrl = '';
async function updateCard() {
  const img = overlay.querySelector<HTMLImageElement>('[data-card]');
  const blob = await cardBlob();
  if (!img || !blob) return;
  URL.revokeObjectURL(cardUrl);
  cardUrl = URL.createObjectURL(blob);
  img.src = cardUrl;
}

async function downloadCard() {
  const blob = await cardBlob();
  if (!blob) return;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `roo-${v.personality}.png`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ---------- flow ----------

function runInstall(el: Element) {
  const counter = el.querySelector<HTMLElement>('[data-counter]')!;
  const bar = el.querySelector<HTMLElement>('[data-bar]')!;
  const lines = [...el.querySelectorAll<HTMLElement>('[data-log]')];
  const prog = { v: 0 };
  const step = 3 / INSTALL_LOG.length;
  installTl = gsap.timeline();
  installTl.to(prog, {
    v: 100,
    duration: 3,
    ease: 'none',
    onUpdate: () => {
      counter.textContent = String(Math.round(prog.v));
      bar.style.width = `${prog.v}%`;
    },
  });
  lines.forEach((li, i) => {
    installTl!.call(
      () => {
        lines.forEach((l, j) => l.classList.toggle('done', j < i));
        li.classList.add('active');
        stage?.pulse();
        sfx.tick();
      },
      [],
      i * step,
    );
  });
  installTl.call(() => {
    lines.forEach((l) => l.classList.add('done'));
    if (!reduced) app.classList.add('flashing');
    window.setTimeout(() => app.classList.remove('flashing'), 600);
    go('reveal');
    sfx.reveal();
  }, [], 3);
}

function startQuiz() {
  answers = [];
  v.qOrder = [shuffle(4), shuffle(4), shuffle(4)];
  v.personality = null;
  go('q1');
}

function answer(p: Personality) {
  const i = Number(v.screen[1]) - 1;
  answers = answers.slice(0, i);
  answers[i] = p;
  stage?.preview(null);
  sfx.select();
  if (i < 2) return go(`q${i + 2}` as Screen);
  computed = score(answers);
  v.personality = computed.winner;
  v.mix = computed.mix;
  go('installing');
}

function goHome(force = false) {
  if (!force && isCustomized(v.look) && ['reveal', 'customize', 'share'].includes(v.screen) && !v.shared) {
    overlay.innerHTML = confirmModal();
    overlay.hidden = false;
    overlay.querySelector<HTMLElement>('[data-action="confirm-no"]')?.focus();
    return;
  }
  overlay.hidden = true;
  overlay.innerHTML = '';
  if (v.shared) history.replaceState(null, '', location.pathname);
  v.shared = false;
  v.look = cloneLook(DEFAULT_LOOK);
  v.personality = null;
  v.mix = {};
  v.tab = 'color';
  answers = [];
  go('intro');
}

function setLook(key: string, id: string) {
  const l = v.look as unknown as Record<string, string>;
  if (l[key] === id) return;
  l[key] = id;
  stage?.react();
  sfx.click();
  if (key === 'body') bubble(COLOR_BUBBLES[id] ?? null, 2500);
  syncStage();
  refresh();
}

function setAcc(slot: Slot, id: string) {
  v.look.acc[slot] = id;
  stage?.react();
  sfx.click();
  bubble(ACCESSORY_BUBBLES[id] ?? null, 2500);
  syncStage();
  refresh();
}

function playMove(m: Move) {
  const secs = stage?.move(m) ?? 1;
  sfx.move();
  v.playing = m;
  bubble(MOVE_BUBBLES[m], Math.max(1500, secs * 1000));
  clearTimeout(playingTimer);
  playingTimer = window.setTimeout(() => {
    v.playing = null;
    if (v.tab === 'moves') refresh();
  }, secs * 1000);
  if (v.tab === 'moves' && v.screen === 'customize') refresh();
}

function surprise() {
  const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
  v.look.body = pick(BODY_COLORS).id;
  v.look.accent = pick(ACCENT_COLORS).id;
  v.look.glow = pick(GLOW_COLORS).id;
  v.look.finish = pick(FINISHES).id;
  for (const s of SLOTS) v.look.acc[s] = pick(ACCESSORIES[s]).id;
  stage?.react();
  sfx.select();
  bubble('Ta-da!', 2000);
  syncStage();
  refresh();
}

// ---------- events ----------

app.addEventListener('click', (e) => {
  const t = (e.target as HTMLElement).closest<HTMLElement>('[data-action]');
  if (!t) return;
  const a = t.dataset.action!;
  if (a !== 'sound') sfx.click();
  switch (a) {
    case 'home':
      e.preventDefault();
      return goHome();
    case 'sound': {
      setSound(!soundOn);
      t.setAttribute('aria-pressed', String(soundOn));
      t.innerHTML = soundOn ? ICON.soundOn : ICON.soundOff;
      sfx.select();
      return;
    }
    case 'start':
      return startQuiz();
    case 'answer':
      return answer(t.dataset.p as Personality);
    case 'back':
      return go(v.screen === 'q3' ? 'q2' : 'q1');
    case 'customize':
      return go('customize');
    case 'share':
      return go('share');
    case 'restart':
      return goHome(true);
    case 'make-own':
      return goHome(true);
    case 'persona': {
      const p = t.dataset.p as Personality;
      if (p === v.personality) return;
      v.personality = p;
      v.mix = computed && computed.winner === p ? computed.mix : { [p]: 100 };
      syncStage();
      refresh();
      replayBigReveal();
      scheduleLines(reduced ? 0 : 2400);
      bubble(null);
      window.setTimeout(() => v.screen === 'reveal' && bubble(defaultBubble()), reduced ? 0 : 2400);
      announcer.textContent = screenTitle(v);
      sfx.reveal();
      return;
    }
    case 'close-customize':
      return go('reveal');
    case 'close-share':
      return go('customize');
    case 'tab':
      v.tab = t.dataset.tab as View['tab'];
      return refresh();
    case 'slot':
      v.slot = t.dataset.slot as Slot;
      return refresh();
    case 'look':
      return setLook(t.dataset.key!, t.dataset.id!);
    case 'acc':
      return setAcc(t.dataset.slot as Slot, t.dataset.id!);
    case 'unequip':
      return setAcc(t.dataset.slot as Slot, DEFAULT_LOOK.acc[t.dataset.slot as Slot]);
    case 'move':
      return playMove(t.dataset.move as Move);
    case 'reset':
      v.look = cloneLook(DEFAULT_LOOK);
      stage?.react();
      syncStage();
      return refresh();
    case 'surprise':
      return surprise();
    case 'snapshot':
      void downloadCard();
      return toast('Snapshot saved');
    case 'copy':
      return void copyLink();
    case 'download':
      return void downloadCard();
    case 'confirm-yes':
      return goHome(true);
    case 'confirm-no':
      overlay.hidden = true;
      overlay.innerHTML = '';
      return;
  }
});

async function copyLink() {
  const url = shareLink();
  const mobile = matchMedia('(pointer: coarse)').matches;
  if (mobile && navigator.share) {
    try {
      await navigator.share({ title: 'My Roo', text: REVEAL[v.personality!].name, url });
      return;
    } catch {
      /* cancelled — fall back to copying */
    }
  }
  try {
    await navigator.clipboard.writeText(url);
  } catch {
    overlay.querySelector<HTMLInputElement>('input')?.select();
    document.execCommand?.('copy');
  }
  toast('Link copied');
}

// hover / focus preview on answers
const previewOn = (e: Event) => {
  const t = (e.target as HTMLElement).closest<HTMLElement>('.answer');
  if (!t || t.closest('.leaving')) return;
  const qi = Number(v.screen[1]) - 1;
  stage?.preview(t.dataset.p as Personality, `q${qi + 1}_${t.dataset.p}`);
  bubble(t.dataset.bubble ?? null, 0, ACCENT[t.dataset.p as Personality]);
  app.style.setProperty('--preview', ACCENT[t.dataset.p as Personality]);
  app.classList.add('previewing');
  sfx.hover();
};
const previewOff = (e: Event) => {
  const t = (e.target as HTMLElement).closest('.answer');
  const to = (e as PointerEvent | FocusEvent).relatedTarget as HTMLElement | null;
  if (!t || to?.closest?.('.answer')) return;
  stage?.preview(null);
  app.classList.remove('previewing');
  bubble(null);
};
content.addEventListener('pointerover', previewOn);
content.addEventListener('focusin', previewOn);
content.addEventListener('pointerout', previewOff);
content.addEventListener('focusout', previewOff);

addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const tag = (e.target as HTMLElement).tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;
  const k = e.key;
  if (k === 'Escape') {
    if (overlay.querySelector('[role="alertdialog"]')) {
      overlay.hidden = true;
      overlay.innerHTML = '';
      return;
    }
    if (v.screen === 'share') return go('customize');
    if (v.screen === 'customize') return go('reveal');
    if (v.screen === 'q2') return go('q1');
    if (v.screen === 'q3') return go('q2');
    if (v.screen === 'q1') return go('intro');
    return;
  }
  if (/^q[123]$/.test(v.screen)) {
    const idx = 'abcd'.indexOf(k.toLowerCase());
    if (idx >= 0 && k.length === 1) {
      const btn = content.querySelectorAll<HTMLElement>('.screen:not(.leaving) .answer')[idx];
      btn?.click();
    }
    return;
  }
  if ((v.screen === 'reveal' || v.screen === 'customize') && !v.shared && /^[1-6]$/.test(k)) {
    playMove(MOVES[Number(k) - 1]);
    return;
  }
  if (k === 'Enter' && v.screen === 'intro' && (e.target as HTMLElement).tagName !== 'BUTTON') startQuiz();
});

// ---------- boot ----------

const shared = decodeShare(location.search);
if (shared) {
  v.shared = true;
  v.personality = shared.p;
  v.mix = shared.mix;
  v.look = shared.look;
  go('reveal');
} else {
  go('boot');
}

import('./three/stage')
  .then(({ Stage }) => {
    stage = new Stage(stageEl);
    stage.attachBubble(bubbleEl);
    stage.onPoke = () => sfx.poke();
    stage.onSay = (text, ms, color) => bubble(text, ms, color);
    stage.onSulk = (on) => {
      introLine = on ? null : 'ear';
    };
    stage.onDrag = (on) => {
      app.classList.toggle('dragging', on);
      if (on) sfx.poke();
    };
    syncStage();
  })
  .catch((err) => console.error('3D stage failed to load', err));

// test hook
declare global {
  interface Window {
    __roo: { view: View; answers: () => Personality[]; look: () => Look; stage: () => Stage | null };
  }
}
window.__roo = { view: v, answers: () => answers, look: () => v.look, stage: () => stage };
