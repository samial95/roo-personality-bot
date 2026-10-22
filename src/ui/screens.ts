import {
  ACCENT,
  ACCENT_COLORS,
  ACCESSORIES,
  BODY_COLORS,
  FINISHES,
  GLOW_COLORS,
  INSTALL_LOG,
  LABEL,
  MOVES,
  PERSONALITIES,
  QUESTIONS,
  REVEAL,
  SLOTS,
  SLOT_LABEL,
  type Move,
  type Option,
  type Personality,
  type Slot,
} from '../data/content';
import { mixEntries, DEFAULT_LOOK, type Look, type Mix, type Screen, type Tab } from '../state';
import { ACC_ICON, ICON } from './icons';

export interface View {
  screen: Screen;
  qOrder: number[][];
  personality: Personality | null;
  mix: Mix;
  look: Look;
  tab: Tab;
  slot: Slot;
  playing: Move | null;
  shared: boolean;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const LETTERS = ['A', 'B', 'C', 'D'];

export function screenTitle(v: View): string {
  switch (v.screen) {
    case 'boot':
      return 'Roo is waking up';
    case 'intro':
      return "Hi. I'm Roo. I don't have a personality yet.";
    case 'q1':
    case 'q2':
    case 'q3': {
      const i = Number(v.screen[1]) - 1;
      return `Question ${i + 1} of 3. ${QUESTIONS[i].title.join(' ')}`;
    }
    case 'installing':
      return 'Installing personality';
    case 'reveal':
      return v.personality ? REVEAL[v.personality].name : '';
    case 'customize':
      return 'Customize Roo';
    case 'share':
      return 'Share your Roo';
  }
}

export function renderScreen(v: View): string {
  switch (v.screen) {
    case 'boot':
      return '';
    case 'intro':
      return intro();
    case 'q1':
    case 'q2':
    case 'q3':
      return question(Number(v.screen[1]) - 1, v.qOrder);
    case 'installing':
      return installing();
    case 'reveal':
      return reveal(v);
    case 'customize':
    case 'share':
      return customize(v);
  }
}

function intro() {
  return `
    <h1 tabindex="-1">Hi. I'm Roo.<br />I don't have a personality yet.</h1>
    <p class="body">3 questions. A whole new me.</p>
    <button class="btn btn-primary" data-action="start">Give me a personality ${ICON.arrow}</button>`;
}

function question(i: number, orders: number[][]) {
  const q = QUESTIONS[i];
  const order = orders[i] ?? [0, 1, 2, 3];
  return `
    <div class="progress" role="progressbar" aria-label="Question ${i + 1} of 3" aria-valuemin="1" aria-valuemax="3" aria-valuenow="${i + 1}">
      ${[0, 1, 2].map((n) => `<span class="${n <= i ? 'on' : ''}"></span>`).join('')}
    </div>
    <h1 tabindex="-1" class="q-title">${esc(q.title[0])}<br />${esc(q.title[1])}</h1>
    <div class="answers" role="group" aria-label="Answers">
      ${order
        .map((idx, pos) => {
          const a = q.answers[idx];
          return `<button class="answer" data-action="answer" data-p="${a.p}" data-bubble="${esc(a.bubble)}" aria-keyshortcuts="${LETTERS[pos]}">
            <span class="key" aria-hidden="true">${LETTERS[pos]}</span><span class="answer-text">${esc(a.text)}</span><span class="answer-arrow">${ICON.arrow}</span>
          </button>`;
        })
        .join('')}
    </div>
    ${i > 0 ? `<button class="btn-text back" data-action="back">${ICON.back} Back</button>` : ''}`;
}

function installing() {
  return `
    <p class="label live-dot">Installing personality</p>
    <div class="counter" aria-hidden="true"><span data-counter>0</span>%</div>
    <div class="install-bar"><span data-bar></span></div>
    <ul class="log" aria-hidden="true">
      ${INSTALL_LOG.map((l, i) => `<li data-log="${i}"><span class="log-icon"></span>${esc(l)}</li>`).join('')}
    </ul>`;
}

function mixBar(mix: Mix, p: Personality) {
  const entries = mixEntries(mix, p);
  return `
    <div class="mix" aria-label="Personality mix: ${entries.map(([k, n]) => `${LABEL[k]} ${n}%`).join(', ')}">
      <div class="mix-bar">${entries.map(([k, n]) => `<span style="flex:${n};background:${ACCENT[k]}"></span>`).join('')}</div>
      <div class="mix-legend label" aria-hidden="true">${entries
        .map(([k, n]) => `<span><i style="background:${ACCENT[k]}"></i>${LABEL[k]} ${n}%</span>`)
        .join('')}</div>
    </div>`;
}

function reveal(v: View) {
  const p = v.personality!;
  const r = REVEAL[p];
  const [first, ...rest] = r.name.split(' ');
  const name = `${first} ${rest[0]}<br />${rest.slice(1).join(' ')}`;
  const actions = v.shared
    ? `<button class="btn btn-primary" data-action="make-own">Make your own ${ICON.arrow}</button>`
    : `<button class="btn btn-primary" data-action="customize">Customize Roo ${ICON.arrow}</button>
       <button class="btn btn-secondary" data-action="share">Share</button>
       <button class="btn-text" data-action="restart">Try again</button>`;
  return `
    <h1 tabindex="-1" class="reveal-name">${name}</h1>
    <p class="quote">"${esc(r.quote)}"</p>
    ${mixBar(v.mix, p)}
    <ul class="chips traits">${r.traits.map((t) => `<li class="chip">${esc(t)}</li>`).join('')}</ul>
    <div class="actions">${actions}</div>
    ${
      v.shared
        ? ''
        : `<div class="divider"></div>
    <div class="chips persona" role="radiogroup" aria-label="Try another personality">
      ${PERSONALITIES.map(
        (k) =>
          `<button class="chip chip-btn ${k === p ? 'active' : ''}" role="radio" aria-checked="${k === p}" data-action="persona" data-p="${k}"><i style="background:${ACCENT[k]}"></i>${LABEL[k]}</button>`,
      ).join('')}
    </div>`
    }`;
}

function swatches(group: string, opts: Option[], current: string, autoHex?: string) {
  return `<div class="swatches" role="radiogroup" aria-label="${group}">
    ${opts
      .map((o) => {
        const hex = o.hex ?? autoHex ?? '#fff';
        const on = o.id === current;
        return `<button class="swatch ${on ? 'on' : ''}" role="radio" aria-checked="${on}" aria-label="${esc(o.label)}" title="${esc(o.label)}" data-action="look" data-key="${group}" data-id="${o.id}" style="--c:${hex}"></button>`;
      })
      .join('')}
  </div>`;
}

const labelOf = (opts: Option[], id: string) => opts.find((o) => o.id === id)?.label ?? '';

function colorTab(v: View) {
  const l = v.look;
  const auto = v.personality ? ACCENT[v.personality] : '#ffffff';
  return `
    <div class="group"><div class="group-head label"><span>Body</span><span>${labelOf(BODY_COLORS, l.body)}</span></div>${swatches('body', BODY_COLORS, l.body)}</div>
    <div class="group"><div class="group-head label"><span>Accent · Joints</span><span>${labelOf(ACCENT_COLORS, l.accent)}</span></div>${swatches('accent', ACCENT_COLORS, l.accent)}</div>
    <div class="group"><div class="group-head label"><span>Face glow</span><span>${labelOf(GLOW_COLORS, l.glow)}</span></div>${swatches('glow', GLOW_COLORS, l.glow, auto)}</div>
    <div class="group"><div class="group-head label"><span>Finish</span><span>${labelOf(FINISHES, l.finish)}</span></div>
      <div class="segmented" role="radiogroup" aria-label="Finish">
        ${FINISHES.map((f) => `<button role="radio" aria-checked="${f.id === l.finish}" class="${f.id === l.finish ? 'on' : ''}" data-action="look" data-key="finish" data-id="${f.id}">${f.label}</button>`).join('')}
      </div>
    </div>`;
}

function movesTab(v: View) {
  return `<div class="moves">
    ${MOVES.map((m, i) => {
      const on = v.playing === m;
      const name = m[0].toUpperCase() + m.slice(1);
      return `<button class="move ${on ? 'on' : ''}" data-action="move" data-move="${m}" aria-keyshortcuts="${i + 1}" aria-pressed="${on}">
        <span>${name}</span>${on ? `<span class="playing label">${ICON.note}Playing</span>` : `<span class="key">${i + 1}</span>`}
      </button>`;
    }).join('')}
  </div>`;
}

function accessoriesTab(v: View) {
  const l = v.look;
  const equipped = SLOTS.filter((s) => l.acc[s] !== DEFAULT_LOOK.acc[s]);
  return `
    <div class="subtabs" role="tablist" aria-label="Accessory slot">
      ${SLOTS.map((s) => `<button role="tab" aria-selected="${s === v.slot}" class="${s === v.slot ? 'on' : ''}" data-action="slot" data-slot="${s}">${SLOT_LABEL[s]}</button>`).join('')}
    </div>
    <div class="group-head label"><span>${SLOT_LABEL[v.slot]}</span><span>${labelOf(ACCESSORIES[v.slot], l.acc[v.slot])}</span></div>
    <div class="acc-grid" role="radiogroup" aria-label="${SLOT_LABEL[v.slot]}">
      ${ACCESSORIES[v.slot]
        .map((o) => {
          const on = l.acc[v.slot] === o.id;
          return `<button class="acc ${on ? 'on' : ''}" role="radio" aria-checked="${on}" data-action="acc" data-slot="${v.slot}" data-id="${o.id}">${ACC_ICON[o.id] ?? ''}<span>${esc(o.label)}</span></button>`;
        })
        .join('')}
    </div>
    <div class="equipped">
      <p class="label">Equipped · ${equipped.length}</p>
      <div class="chips">
        ${equipped
          .map(
            (s) =>
              `<button class="chip chip-btn removable" data-action="unequip" data-slot="${s}" aria-label="Remove ${esc(labelOf(ACCESSORIES[s], l.acc[s]))}"><span class="muted">${SLOT_LABEL[s]}</span> ${esc(labelOf(ACCESSORIES[s], l.acc[s]))} ${ICON.close}</button>`,
          )
          .join('')}
      </div>
    </div>`;
}

function customize(v: View) {
  const tabs: [Tab, string][] = [
    ['color', 'Color'],
    ['moves', 'Moves'],
    ['accessories', 'Accessories'],
  ];
  const body = v.tab === 'color' ? colorTab(v) : v.tab === 'moves' ? movesTab(v) : accessoriesTab(v);
  return `
    <section class="panel" aria-labelledby="cz-title">
      <div class="panel-head">
        <div><h2 id="cz-title" tabindex="-1">Customize Roo</h2><span class="accent-dot"></span></div>
        <button class="icon-btn" data-action="close-customize" aria-label="Close customize">${ICON.close}</button>
      </div>
      <div class="tabs" role="tablist" aria-label="Customize">
        ${tabs.map(([t, n]) => `<button role="tab" aria-selected="${t === v.tab}" class="${t === v.tab ? 'on' : ''}" data-action="tab" data-tab="${t}">${n}</button>`).join('')}
      </div>
      <div class="panel-body" role="tabpanel">${body}</div>
      <div class="panel-foot">
        <button class="btn-text" data-action="reset">Reset</button>
        <button class="btn btn-secondary" data-action="surprise">Surprise me</button>
        <button class="btn btn-secondary" data-action="snapshot">Snapshot</button>
        <button class="btn btn-primary" data-action="share">Share ${ICON.arrow}</button>
      </div>
    </section>`;
}

export function shareModal(link: string) {
  return `
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="share-title">
      <div class="modal-head">
        <h2 id="share-title" tabindex="-1">Share your Roo</h2>
        <button class="icon-btn" data-action="close-share" aria-label="Close share">${ICON.close}</button>
      </div>
      <img class="card" data-card alt="Snapshot card of your Roo" />
      <div class="link-field">
        <input readonly value="${esc(link)}" aria-label="Share link" />
        <button class="btn btn-primary sm" data-action="copy">Copy link</button>
      </div>
      <div class="modal-actions">
        <button class="btn btn-secondary" data-action="download">Download PNG</button>
        <button class="btn btn-secondary" data-action="restart">Start over</button>
      </div>
    </div>`;
}

export function confirmModal() {
  return `
    <div class="modal modal-sm" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title">
      <h2 id="confirm-title" tabindex="-1">Start over?</h2>
      <p class="body">Your custom Roo will be reset.</p>
      <div class="modal-actions">
        <button class="btn btn-secondary" data-action="confirm-no">Keep editing</button>
        <button class="btn btn-primary" data-action="confirm-yes">Start over</button>
      </div>
    </div>`;
}
