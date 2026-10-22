import { CanvasTexture, SRGBColorSpace } from 'three';

export const EXPRESSIONS = [
  'default',
  'happy',
  'curious',
  'surprised',
  'sleepy',
  'shy',
  'playful',
  'dramatic',
  'calm',
  'wink',
  'dizzy',
  'off',
  'angry',
] as const;
export type Expression = (typeof EXPRESSIONS)[number];

const SIZE = 512;
const EYE_DX = 64; // eye centers at 256 ± EYE_DX
const MORPH_MS = 80;
const BLINK_MS = 120;

type Ctx = CanvasRenderingContext2D;

/** Draws one eye centered at (0,0). `side` is -1 (left) or 1 (right). */
function eye(ctx: Ctx, expr: Expression, side: -1 | 1) {
  const pill = (w: number, h: number) => {
    ctx.beginPath();
    ctx.roundRect(-w / 2, -h / 2, w, h, w / 2);
    ctx.fill();
  };
  const arc = (up: boolean, w = 52, lw = 16) => {
    ctx.lineWidth = lw;
    ctx.beginPath();
    if (up) ctx.arc(0, 14, w / 2, Math.PI * 1.1, Math.PI * 1.9);
    else ctx.arc(0, -14, w / 2, Math.PI * 0.1, Math.PI * 0.9);
    ctx.stroke();
  };
  const line = (x1: number, y1: number, x2: number, y2: number) => {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  };
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 16;
  switch (expr) {
    case 'default':
      return pill(30, 76);
    case 'happy':
      return arc(true);
    case 'curious':
      return side < 0 ? pill(28, 70) : arc(true, 48);
    case 'surprised':
      ctx.beginPath();
      ctx.arc(0, 0, 22, 0, Math.PI * 2);
      return ctx.fill();
    case 'sleepy':
      return pill(44, 14);
    case 'shy':
      ctx.translate(side * -6, 18); // eyes glance down and in
      return pill(24, 40);
    case 'playful': // > <
      ctx.lineWidth = 15;
      ctx.beginPath();
      ctx.moveTo(-side * 20, -24);
      ctx.lineTo(side * 20, 0);
      ctx.lineTo(-side * 20, 24);
      return ctx.stroke();
    case 'dramatic': // big eyes with a sparkle highlight
      ctx.beginPath();
      ctx.ellipse(0, 0, 28, 40, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(-9, -14, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    case 'calm':
      return arc(false, 50, 14);
    case 'wink':
      return side < 0 ? pill(30, 76) : pill(46, 14);
    case 'dizzy':
      ctx.lineWidth = 14;
      line(-20, -20, 20, 20);
      return line(-20, 20, 20, -20);
    case 'off':
      return;
    case 'angry': // furious slanted slits, inner corners down
      ctx.rotate(side * 0.5);
      return pill(48, 18);
  }
}

export interface FaceState {
  expr: Expression;
  color: string;
  lookX: number; // -1..1
  lookY: number; // -1..1
  blush: boolean;
}

/** Canvas-texture face with 80 ms crossfade morphs and Y-squash blinks. */
export class Face {
  readonly texture: CanvasTexture;
  private ctx: Ctx;
  private prev: Expression = 'off';
  private cur: Expression = 'off';
  private morphStart = 0;
  private blinkStart = -1e9;
  private blinkMs = BLINK_MS;
  private last = '';
  glitch = 0; // 0..1 RGB split amount

  constructor() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = SIZE;
    this.ctx = canvas.getContext('2d')!;
    this.texture = new CanvasTexture(canvas);
    this.texture.colorSpace = SRGBColorSpace;
  }

  set(expr: Expression, now: number) {
    if (expr === this.cur) return;
    this.prev = this.cur;
    this.cur = expr;
    this.morphStart = now;
  }

  get expression() {
    return this.cur;
  }

  blink(now: number, ms = BLINK_MS) {
    this.blinkStart = now;
    this.blinkMs = ms;
  }

  /** Redraws only when something visible changed. */
  update(s: FaceState, now: number) {
    const morph = Math.min(1, (now - this.morphStart) / MORPH_MS);
    const bt = (now - this.blinkStart) / this.blinkMs;
    const blink = bt >= 0 && bt < 1 ? 0.1 : 1;
    const key = `${this.cur}|${morph.toFixed(2)}|${blink}|${s.color}|${s.lookX.toFixed(2)}|${s.lookY.toFixed(2)}|${s.blush}|${this.glitch.toFixed(2)}`;
    if (key === this.last) return;
    this.last = key;

    const ctx = this.ctx;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#050506';
    ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.beginPath();
    ctx.roundRect(96, 128, 84, 12, 6);
    ctx.fill();

    const drawSet = (expr: Expression, alpha: number, color: string, dx = 0) => {
      if (alpha <= 0) return;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = ctx.strokeStyle = color;
      for (const side of [-1, 1] as const) {
        ctx.save();
        // pupils follow the cursor up to ~14px
        ctx.translate(256 + side * EYE_DX + s.lookX * 14 + dx, 256 + s.lookY * 10);
        ctx.scale(1, blink);
        eye(ctx, expr, side);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    };

    if (this.glitch > 0) {
      const d = 4 * this.glitch;
      ctx.globalCompositeOperation = 'lighter';
      drawSet(this.cur, 0.8, '#ff2a2a', -d);
      drawSet(this.cur, 0.8, '#2affff', d);
      ctx.globalCompositeOperation = 'source-over';
    }
    drawSet(this.prev, 1 - morph, s.color);
    drawSet(this.cur, morph, s.color);

    if (s.blush) {
      ctx.fillStyle = 'rgba(255,143,177,0.55)';
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(256 + side * 112, 306, 26, 11, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    this.texture.needsUpdate = true;
  }

  dispose() {
    this.texture.dispose();
  }
}
