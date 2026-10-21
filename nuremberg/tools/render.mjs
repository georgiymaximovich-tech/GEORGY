// Покадровая запись 3D-сцены в MP4: node render.mjs <scene> <секунд> <out.mp4> [fps] [sub]
// Предпросмотр кадров:          node render.mjs <scene> preview <dir> 0,5,12.3
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');   // корень репозитория
const [scene, secs, out, fpsA, subA] = process.argv.slice(2);
const FPS = secs === 'preview' ? 30 : +(fpsA || 30), SUB = +(subA || 2);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript' };
const srv = http.createServer((q, r) => {
  const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]));
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
}).listen(0);
const port = srv.address().port;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
page.on('console', m => m.type() === 'error' && console.error('page:', m.text()));
page.on('pageerror', e => console.error('pageerror:', e.message));
await page.goto(`http://127.0.0.1:${port}/nuremberg/tools/satisfying3d/index.html?render&scene=${scene}`);
await page.waitForFunction('window.__ready', null, { timeout: 60000 });

if (secs === 'preview') {
  fs.mkdirSync(out, { recursive: true });
  const times = process.argv[5].split(',').map(Number); let t = 0;
  for (const tt of times) {
    while (t + 1 / FPS <= tt + 1e-9) { await page.evaluate(([d]) => window.__frame(d, 1), [1 / FPS]); t += 1 / FPS; }
    const b64 = await page.evaluate(() => window.__grab(.9));
    fs.writeFileSync(path.join(out, `${scene}_${tt}.jpg`), Buffer.from(b64, 'base64'));
  }
} else {
  const N = Math.round(+secs * FPS);
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '24', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const t0 = Date.now();
  for (let i = 0; i < N; i++) {
    const b64 = await page.evaluate(([d, s]) => { window.__frame(d, s); return window.__grab(.93); }, [1 / FPS, SUB]);
    if (!ff.stdin.write(Buffer.from(b64, 'base64'))) await new Promise(r => ff.stdin.once('drain', r));
    if (i % 150 === 0) console.log(`${scene}: ${i}/${N} кадров, ${((Date.now() - t0) / 1000).toFixed(0)} с`);
  }
  ff.stdin.end(); await new Promise(r => ff.on('close', r));
  console.log(`${scene}: готово → ${out}`);
}
await browser.close(); srv.close();
