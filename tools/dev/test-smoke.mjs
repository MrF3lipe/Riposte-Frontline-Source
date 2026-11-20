// Arranque sin pantalla: el HTML compilado abre en español, sin pageerror, con los modos y sistemas del fork y sin Supremo ni armas 5.16.
import { chromium } from '/workspace/riposte-merge/node_modules_p/node_modules/playwright-core/index.mjs';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..', 'dist');
const port = +(process.env.PORT || 18758);
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.mp3': 'audio/mpeg', '.json': 'application/json', '.wasm': 'application/wasm' };

const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://127.0.0.1');
  let f = path.normalize(path.join(root, decodeURIComponent(u.pathname === '/' ? '/riposte-frontline.html' : u.pathname)));
  if (!f.startsWith(root)) { res.writeHead(403); return res.end(); }
  fs.readFile(f, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('no'); }
    res.writeHead(200, { 'content-type': mime[path.extname(f)] || 'application/octet-stream' });
    res.end(buf);
  });
});
await new Promise((r) => server.listen(port, '127.0.0.1', r));

const b = await chromium.launch({
  executablePath: '/usr/bin/google-chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required']
});
const pg = await b.newPage({ viewport: { width: 1280, height: 720 } });
pg.setDefaultTimeout(180000);
await pg.addInitScript(() => {
  Object.defineProperty(navigator, 'language', { get: () => 'es-VE' });
  Object.defineProperty(navigator, 'languages', { get: () => ['es-VE', 'es'] });
  try { localStorage.setItem('dc_settings', JSON.stringify({ quality: 'low', sv: 9 })); } catch (e) {}
});
const errors = [];
pg.on('pageerror', (e) => errors.push(String(e.stack || e).slice(0, 800)));
pg.on('console', (m) => { if (m.type() === 'error' && !/ERR_FAILED|404|501|peerjs|favicon/i.test(m.text())) errors.push('console ' + m.text().slice(0, 300)); });
await pg.route('**/*', (r) => {
  const u = r.request().url();
  if (/fonts\.g|onestore|vercel|playriposte|peerjs|jsdelivr/.test(u)) return r.abort();
  return r.continue();
});

const fails = [];
const fail = (m) => { fails.push(m); console.log('FAIL', m); };
try {
  await pg.goto('http://127.0.0.1:' + port + '/riposte-frontline.html', { waitUntil: 'domcontentloaded', timeout: 120000 });
  await pg.waitForFunction("typeof MATCH!=='undefined' && typeof LANG!=='undefined' && (MATCH.state==='menu' || MATCH.state==='loading')", null, { timeout: 180000 });
  // el menú a veces tarda en texturizar; basta con que el JS haya arrancado
  await pg.waitForTimeout(2500);
  for (let i = 0; i < 4; i++) {
    const id = await pg.evaluate(() => {
      const shown = (x) => { const el = document.getElementById(x); return !!(el && !el.classList.contains('hidden')); };
      if (shown('whatsnew')) return 'wnOk';
      if (shown('ecoAsk')) return 'ecoOff';
      return '';
    });
    if (!id) break;
    await pg.locator('#' + id).click({ timeout: 8000 }).catch(() => {});
    await pg.waitForTimeout(200);
  }
  const info = await pg.evaluate(() => {
    const modes = (typeof MODE_IDS !== 'undefined') ? MODE_IDS.slice() : Object.keys(typeof MODES === 'object' ? MODES : {});
    return {
      lang: typeof LANG !== 'undefined' ? LANG : '',
      state: typeof MATCH !== 'undefined' ? MATCH.state : '',
      modes,
      nades: typeof NADE_TYPES === 'object' ? Object.keys(NADE_TYPES) : [],
      ks: typeof KS_IDS !== 'undefined' ? KS_IDS.slice() : [],
      perks: typeof PERKS !== 'undefined' ? PERKS.map((p) => p.id) : [],
      gg: typeof GG_ORDERS !== 'undefined' ? GG_ORDERS.slice() : [],
      ggDefault: typeof Settings !== 'undefined' ? Settings.ggOrder : '',
      field: typeof FIELD_IDS !== 'undefined' ? FIELD_IDS.slice() : [],
      posture: typeof POSTURE !== 'undefined',
      mo: typeof MO_HP !== 'undefined',
      jugg: typeof KSDEF !== 'undefined' && !!KSDEF.jugg,
      last: typeof PERK_BY !== 'undefined' && !!PERK_BY.last,
      supremo: typeof SUPREMO !== 'undefined' || (typeof window !== 'undefined' && !!window.SUPREMO),
      w516: typeof WEAPONS !== 'undefined' && ['aug','m16a4','fal','p90','bizon','uzi','intervention','spas12'].filter((id) => WEAPONS[id])
    };
  });
  console.log('INFO', JSON.stringify(info));
  if (info.lang !== 'es') fail('idioma ' + info.lang + ' (se esperaba es)');
  for (const id of ['gun', 'coop', 'inf', 'kc', 'hp', 'ctf']) if (!info.modes.includes(id)) fail('falta modo ' + id);
  for (const id of ['semtex', 'stun', 'c4']) if (!info.nades.includes(id)) fail('falta granada ' + id);
  if (!info.ks.includes('cuav') || !info.ks.includes('jugg')) fail('faltan rachas cuav/jugg');
  if (!info.perks.includes('last') || !info.perks.includes('over')) fail('faltan atouts last/over');
  if (!info.gg.includes('mix') || info.ggDefault !== 'mix') fail('orden de armas');
  if (!info.field.includes('ammo') || !info.field.includes('trophy')) fail('mejoras de campo');
  if (!info.posture || !info.mo || !info.jugg || !info.last) fail('sistemas posture/mo/jugg/last');
  if (info.supremo) fail('Supremo no debía estar');
  if (info.w516 && info.w516.length) fail('armas 5.16 presentes: ' + info.w516.join(','));
  if (errors.length) fail('pageerror/console: ' + errors[0]);
} catch (e) {
  fail('excepción: ' + String(e && e.stack || e).slice(0, 800));
} finally {
  await b.close().catch(() => {});
  server.close();
}
if (fails.length) {
  console.log('SMOKE FAIL', fails.length);
  process.exit(1);
}
console.log('SMOKE OK');
