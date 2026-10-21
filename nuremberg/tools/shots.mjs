// Снимки слайдов для PowerPoint: node shots.mjs <out_dir>
// slide_NN.png — слайд с пустой колонкой видео, over_NN.png — прозрачный оверлей «рилс» поверх видео.
import { createRequire } from 'node:module';
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = process.argv[2]; fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1.2 });
for (const mode of ['export', 'overlay']) {
  await p.goto('file://' + path.join(ROOT, 'index.html') + '?' + mode);
  await p.evaluate(() => document.fonts.ready);
  if (mode === 'export') fs.writeFileSync(path.join(out, 'reel.json'), JSON.stringify(await p.evaluate(() => { const r = document.getElementById('reel').getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; })));
  const n = await p.evaluate(() => document.querySelectorAll('.slide').length);
  for (let i = 0; i < n; i++) {
    await p.evaluate(i => window.__show(i), i); await p.waitForTimeout(250);
    const f = path.join(out, `${mode === 'export' ? 'slide' : 'over'}_${String(i + 1).padStart(2, '0')}.png`);
    if (mode === 'export') await p.screenshot({ path: f });
    else await p.locator('#reel').screenshot({ path: f, omitBackground: true });
  }
}
await b.close();
