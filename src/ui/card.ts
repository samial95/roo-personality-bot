import { ACCENT, LABEL, REVEAL, type Personality } from '../data/content';
import { mixEntries, type Mix } from '../state';

const W = 1200;
const H = 630;

/** Offscreen 1200×630 share card: robot pose, name, quote, mix and a small wordmark. */
export async function renderCard(robot: HTMLCanvasElement, p: Personality, mix: Mix): Promise<HTMLCanvasElement> {
  // Copy the WebGL frame synchronously, before the browser clears the drawing buffer.
  const shot = document.createElement('canvas');
  shot.width = robot.width;
  shot.height = robot.height;
  shot.getContext('2d')!.drawImage(robot, 0, 0);

  await Promise.all([document.fonts.load('600 64px Geist'), document.fonts.load('400 20px "Geist Mono"')]).catch(() => {});

  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  const accent = ACCENT[p];

  g.fillStyle = '#09090B';
  g.fillRect(0, 0, W, H);
  const glow = g.createRadialGradient(330, 330, 0, 330, 330, 420);
  glow.addColorStop(0, accent + '66');
  glow.addColorStop(1, accent + '00');
  g.fillStyle = glow;
  g.fillRect(0, 0, W, H);

  // robot: crop the centre of the stage frame, keep its aspect
  const crop = Math.min(shot.width, shot.height) * 0.9;
  const sx = (shot.width - crop) / 2;
  const sy = (shot.height - crop) / 2;
  g.drawImage(shot, sx, sy, crop, crop, 40, 15, 600, 600);

  const r = REVEAL[p];
  const x = 640;
  g.fillStyle = '#FAFAFA';
  g.font = '600 64px Geist, sans-serif';
  const words = r.name.replace(/^Roo the /, 'The ').split(' ');
  const line2 = words.splice(Math.ceil(words.length / 2)).join(' ');
  g.fillText(words.join(' '), x, 240);
  g.fillText(line2, x, 310);

  g.fillStyle = 'rgba(255,255,255,0.62)';
  g.font = '400 24px Geist, sans-serif';
  g.fillText(`"${r.quote}"`, x, 360, W - x - 40);

  g.font = '500 18px "Geist Mono", monospace';
  mixEntries(mix, p).forEach(([k, n], i) => {
    const y = 410 + i * 32;
    g.fillStyle = ACCENT[k];
    g.beginPath();
    g.arc(x + 6, y - 6, 6, 0, Math.PI * 2);
    g.fill();
    g.fillText(`${LABEL[k].toUpperCase()} ${n}%`, x + 22, y);
  });

  // wordmark
  g.fillStyle = '#FAFAFA';
  g.beginPath();
  g.roundRect(48, H - 64, 28, 22, 7);
  g.fill();
  g.fillStyle = '#09090B';
  g.beginPath();
  g.roundRect(55, H - 58, 14, 9, 4);
  g.fill();
  g.fillStyle = '#FAFAFA';
  g.font = '600 24px Geist, sans-serif';
  g.fillText('roo', 86, H - 45);
  return c;
}
