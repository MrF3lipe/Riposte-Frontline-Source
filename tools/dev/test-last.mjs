// Última batalla: en el suelo solo la pistola, y al levantarte vuelve el arma de antes.
import { chromium } from '/workspace/riposte-merge/node_modules_p/node_modules/playwright-core/index.mjs';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..', 'dist');
const port = +(process.env.PORT || 18759);
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
const ignore = (t) => /ERR_FAILED|\b404\b|\b501\b|Failed to load resource|peerjs|favicon|net::ERR/i.test(t);
pg.on('pageerror', (e) => errors.push(String(e.stack || e).slice(0, 800)));
pg.on('console', (m) => { if (m.type() === 'error' && !ignore(m.text())) errors.push('console ' + m.text().slice(0, 300)); });
await pg.route('**/*', (r) => {
  const u = r.request().url();
  if (/fonts\.g|onestore|vercel|playriposte|peerjs|jsdelivr/.test(u)) return r.abort();
  return r.continue();
});

const fails = [];
const fail = (m) => { fails.push(m); console.log('FAIL', m); };
const step = (m) => console.log('STEP', m);

try {
  step('menú');
  await pg.goto('http://127.0.0.1:' + port + '/riposte-frontline.html', { waitUntil: 'domcontentloaded', timeout: 120000 });
  await pg.waitForFunction("typeof MATCH!=='undefined' && typeof LANG!=='undefined' && (MATCH.state==='menu' || MATCH.state==='loading')", null, { timeout: 180000 });
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

  step('partida');
  const started = await pg.evaluate(async () => {
    Settings.map = 'sable';
    if ('mapRnd' in Settings) Settings.mapRnd = false;
    Settings.mode = 'tdm';
    await mapEnsure('sable');
    startMatch({});
    MATCH.limit = 99999;
    MATCH.timeLeft = 99999;
    return { state: MATCH.state, mode: MATCH.mode, bots: entities.filter((e) => !e.isPlayer && e.alive).length };
  });
  console.log('STARTED', JSON.stringify(started));
  if (!started || started.state !== 'playing') fail('partida ' + JSON.stringify(started));

  step('bloqueo');
  const last = await pg.evaluate(() => {
    const problems = [];
    const M = {};
    const check = (name, cond, detail) => { M[name] = detail; if (!cond) problems.push(name + ' ' + JSON.stringify(detail)); };
    MATCH.limit = 99999;
    MATCH.timeLeft = 99999;
    const i = (PL.classIdx != null) ? PL.classIdx : (Settings.loadout || 0);
    const c = CLASSES[i];
    if (c) {
      if (!c.pk) perkClean(c);
      if (c.pk[1].indexOf('last') < 0) {
        if (c.pk[1].length >= 2) c.pk[1].pop();
        c.pk[1].push('last');
      }
    }
    const e = PL.ent;
    e.alive = true;
    e.health = 40;
    e.protT = 0;
    e.downed = false;
    e.downT = 0;
    const A = e.arms;
    let prim = 0;
    const pist = A.slots.findIndex((s) => s.def && s.def.cat === 'pistol');
    A.cur = prim;
    A.switching = 0;
    A.reload = null;
    const beforeKey = A.slots[prim] && A.slots[prim].def && A.slots[prim].def.key;
    check('hasPerk', typeof perkHas === 'function' && perkHas(e, 'last'), { pk: c && c.pk, pist });
    const foe = entities.find((o) => !o.isPlayer && o.alive && o.team !== e.team) || entities.find((o) => !o.isPlayer && o.alive);
    applyDamage(e, 80, foe, 'M4A1', false, new V3(0, 0, -1));
    const cat0 = A.slots[A.cur] && A.slots[A.cur].def && A.slots[A.cur].def.cat;
    const cur0 = A.cur;
    check('downPistol', e.alive && e.downed && cat0 === 'pistol', { alive: e.alive, downed: e.downed, hp: e.health, cur0, cat0, beforeKey, _lsSlot: e._lsSlot });
    if (typeof switchWeapon === 'function') switchWeapon(prim);
    if (typeof quickSwap === 'function') quickSwap();
    if (typeof ctlSwitch === 'function') ctlSwitch(e, prim);
    if (typeof swapWithDrop === 'function') swapWithDrop();
    for (let n = 0; n < 20; n++) ctlWeapon(e, 0.05, MATCH.time + n * 0.05);
    const after = { cur: A.cur, cat: A.slots[A.cur] && A.slots[A.cur].def && A.slots[A.cur].def.cat, switching: A.switching, key: A.slots[A.cur] && A.slots[A.cur].def && A.slots[A.cur].def.key };
    check('locked', after.cat === 'pistol' && after.cur === cur0 && !(A.switching > 0), { after, cur0 });
    const ally = entities.find((o) => !o.isPlayer && o.alive && o.team === e.team);
    if (e.downed) lastUp(e);
    const keyR = A.slots[A.cur] && A.slots[A.cur].def && A.slots[A.cur].def.key;
    const catR = A.slots[A.cur] && A.slots[A.cur].def && A.slots[A.cur].def.cat;
    check('restore', !e.downed && keyR === beforeKey && catR !== 'pistol', { cur: A.cur, keyR, catR, beforeKey, hp: e.health, ally: !!ally });
    return { problems, M };
  });
  console.log('LAST', JSON.stringify(last && last.M));
  if (!last) fail('sin medida last');
  else for (const p of last.problems) fail('last ' + p);
  const bad = errors.filter((t) => !ignore(t));
  if (bad.length) fail('pageerror/console: ' + bad[0]);
} catch (e) {
  fail('excepción: ' + String(e && e.stack || e).slice(0, 800));
} finally {
  await b.close().catch(() => {});
  server.close();
}
if (fails.length) {
  console.log('LAST FAIL', fails.length);
  process.exit(1);
}
console.log('LAST OK');
