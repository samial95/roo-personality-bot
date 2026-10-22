// Tiles shots/<project>/*.png into one image for quick review: node scripts/contact-sheet.mjs desktop 4
import { chromium } from '@playwright/test';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const [project = 'desktop', cols = '4'] = process.argv.slice(2);
const dir = resolve('shots', project);
const files = readdirSync(dir).filter((f) => /^\d\d-.*\.png$/.test(f)).sort();
const html = `<body style="margin:0;background:#222;display:grid;grid-template-columns:repeat(${cols},1fr);gap:4px;font:12px sans-serif;color:#fff">
${files.map((f) => `<figure style="margin:0"><img src="data:image/png;base64,${readFileSync(resolve(dir, f)).toString('base64')}" style="width:100%;display:block"><figcaption>${f}</figcaption></figure>`).join('')}</body>`;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: project === 'mobile' ? 1400 : 1800, height: 600 } });
await page.setContent(html);
await page.waitForLoadState('load');
await page.screenshot({ path: resolve('shots', `${project}-sheet.png`), fullPage: true });
await browser.close();
