/* Objectifs (solo et hôte) : basse confirmée (kc), point chaud (hp), capture du drapeau (ctf).
   L'hôte simule et publie {t:'ob'}. Une build ancienne ignore ce type, et aussi l'événement {k:'ob'}.
   Un id de mode inconnu retombe sur tdm dans netCfg (09c-net.js). Le menu ne propose ces modes
   qu'en solo et à l'hôte (l'invité voit le mode choisi, sans le changer). */
MODES.kc = {
  name: _t('Basse confirmée'),
  btn: _t('Basse confirmée'),
  sub: _t('Ramassez la plaque de l\u0027ennemi'),
  teams: _t('8 contre 8, plaques à ramasser'),
  lim: _t('Confirmations'),
  unit: _t('confirmations'),
  limits: [30, 50, 65, 75],
  key: 'limitKc',
  respawn: 4,
  botRespawn: 5,
  prot: 2,
  hint: _t('À sa mort, un soldat lâche sa plaque. L\u0027ennemi qui la ramasse marque le point. Un allié la refuse.')
};
MODES.hp = {
  name: _t('Point chaud'),
  btn: _t('Point chaud'),
  sub: _t('Une zone qui tourne chaque minute'),
  teams: _t('8 contre 8, une zone active'),
  lim: _t('Points de zone'),
  unit: _t('points'),
  limits: [75, 100, 150, 200],
  key: 'limitHp',
  respawn: 4,
  botRespawn: 4.5,
  prot: 2,
  hint: _t('La zone change toutes les 60 s. Votre équipe marque 1 point par seconde si elle est seule à l\u0027intérieur.')
};
MODES.ctf = {
  name: _t('Capture du drapeau'),
  btn: _t('Capture du drapeau'),
  sub: _t('Portez le drapeau ennemi jusqu\u0027à votre base'),
  teams: _t('8 contre 8, deux drapeaux'),
  lim: _t('Captures'),
  unit: _t('captures'),
  limits: [3, 5, 7, 9],
  key: 'limitCtf',
  respawn: 4,
  botRespawn: 5,
  prot: 2,
  hint: _t('Portez le drapeau ennemi à votre base pendant que le vôtre y est. Si vous mourez, vous le lâchez. Un allié le ramène en le touchant. Il rentre seul au bout de 30 s.')
};
(function () {
  const i = MODE_IDS.indexOf('snd');
  let at = i >= 0 ? i + 1 : MODE_IDS.length;
  for (const id of ['kc', 'hp', 'ctf']) {
    if (MODE_IDS.includes(id)) continue;
    MODE_IDS.splice(at, 0, id);
    at++;
  }
})();
if (Settings.limitKc === undefined) Settings.limitKc = 50;
if (Settings.limitHp === undefined) Settings.limitHp = 150;
if (Settings.limitCtf === undefined) Settings.limitCtf = 3;

const OBJ = {
  on: false,
  tags: [],
  flags: [],
  spots: [],
  zi: 0,
  left: 60,
  hold: -1,
  acc: [0, 0],
  rad: 5.5,
  dy: 2.8,
  capR: 7.5,
  pickR: 3,
  retT: 30,
  seq: 1,
  rev: 1,
  planAt: [-1, -1],
  dirty: false,
  pubT: -1,
  mks: [],
  seen: {},
  stat: null,
  zoneG: null,
  zoneMat: null,
  end: false
};
const _objV = new V3();
function objBlank() {
  return { conf: 0, deny: 0, secs: [0, 0], caps: 0, grabs: 0, rets: 0 };
}
function objMode() {
  return MATCH.mode === 'kc' || MATCH.mode === 'hp' || MATCH.mode === 'ctf';
}
function objAuth() {
  return !MATCH.online || NET.role === 'host';
}
function objIn(e) {
  return !!(e && e.alive && !e.off && !e.isZombie && (!MATCH.online || e.isPlayer || e.isRemote || e.netBot));
}
function objNum(v, lo, hi) {
  const n = +v;
  return isFinite(n) ? clamp(n, lo, hi) : null;
}
function objGround(x, y, z) {
  const y0 = y > -2 ? y : gy0(x, z);
  const id = typeof navNode === 'function' ? navNode(x, y0, z) : -1;
  if (id >= 0) return { x: NAV.nx[id], y: NAV.ny[id], z: NAV.nz[id] };
  return { x: x, y: gy0(x, z), z: z };
}
function objHome(team) {
  const S = SPAWNS[team];
  let x = 0,
    z = team === 0 ? 24 : -24;
  if (S && S.length) {
    x = 0;
    z = 0;
    for (const p of S) {
      x += p[0];
      z += p[1];
    }
    x /= S.length;
    z /= S.length;
  } else if (CURMAP.def && CURMAP.def.dom && CURMAP.def.dom.length) {
    const d = CURMAP.def.dom,
      p = d[team === 0 ? 0 : d.length - 1];
    x = p[0];
    z = p[1];
  }
  return objGround(x, gy0(x, z), z);
}
function objSpots() {
  const defs = (CURMAP.def && CURMAP.def.dom) || [];
  const out = [];
  for (let i = 0; i < defs.length; i++) {
    const p = defs[i],
      x = p[0],
      z = p[1],
      y0 = p[2] !== undefined ? p[2] : gy0(x, z),
      id = navNode(x, y0, z);
    out.push({
      i: i,
      name: 'ABC'[i] || String(i + 1),
      x: x,
      z: z,
      y: id >= 0 ? NAV.ny[id] : y0
    });
  }
  return out;
}
function objFree(o) {
  if (!o) return;
  if (o.parent) o.parent.remove(o);
  o.traverse((n) => {
    if (n.geometry) n.geometry.dispose();
    if (n.material && n.material.dispose) n.material.dispose();
  });
}
function objClear() {
  for (const t of OBJ.tags) objFree(t.mesh);
  OBJ.tags = [];
  for (const f of OBJ.flags) objFree(f.mesh);
  OBJ.flags = [];
  objFree(OBJ.zoneG);
  OBJ.zoneG = null;
  OBJ.zoneMat = null;
  OBJ.spots = [];
  for (const el of OBJ.mks) el.remove();
  OBJ.mks = [];
  const row = $('objRow');
  if (row) row.classList.add('hidden');
  const cap = $('objCap');
  if (cap) cap.classList.remove('show');
  OBJ.on = false;
  OBJ.end = false;
  OBJ.hold = -1;
}
function objCss() {
  if ($('objCss')) return;
  const st = document.createElement('style');
  st.id = 'objCss';
  st.textContent =
    '#objRow{grid-area:d;display:flex;justify-content:center;gap:8px;margin-top:6px;font:700 max(14px,calc(15 * var(--hu)))/1.15 var(--hud);letter-spacing:.06em;text-transform:uppercase;color:var(--paper);text-shadow:0 1px 3px #000}' +
    '#objCap{position:absolute;left:50%;top:calc(50% + 118 * var(--hu, 1px));transform:translateX(-50%);width:min(420px,70vw);text-align:center;font:700 max(14px,calc(16 * var(--hu)))/1.2 var(--hud);letter-spacing:.05em;text-transform:uppercase;color:var(--paper);text-shadow:0 1px 4px #000;pointer-events:none;opacity:0}' +
    '#objCap.show{opacity:1}#objCap.ally{color:var(--ally)}#objCap.enemy{color:var(--enemy)}#objCap.hot{color:var(--acc)}';
  document.head.appendChild(st);
  const row = document.createElement('div');
  row.id = 'objRow';
  row.className = 'hidden';
  const host = $('domRow');
  if (host && host.parentNode) host.parentNode.insertBefore(row, host.nextSibling);
  const cap = document.createElement('div');
  cap.id = 'objCap';
  const hud = $('hud');
  if (hud) hud.appendChild(cap);
}
function objPlate() {
  const g = new THREE.Group();
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.045, 0.18),
    new THREE.MeshBasicMaterial({ color: 0xffe08a })
  );
  m.position.y = 0.12;
  m.frustumCulled = false;
  g.add(m);
  g.frustumCulled = false;
  return g;
}
function objFlagMesh(team) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.05, 1.7, 6),
    new THREE.MeshBasicMaterial({ color: 0x2a2a26 })
  );
  pole.position.y = 0.85;
  pole.frustumCulled = false;
  const mat = new THREE.MeshBasicMaterial({ color: team === 0 ? 0x8fd16a : 0xef5543, side: THREE.DoubleSide });
  const geo = new THREE.PlaneGeometry(0.72, 0.42);
  geo.translate(0.36, 0, 0);
  const flag = new THREE.Mesh(geo, mat);
  flag.position.y = 1.45;
  flag.frustumCulled = false;
  g.add(pole);
  g.add(flag);
  g.frustumCulled = false;
  g.userData.flag = flag;
  return g;
}
function objAddMesh(o) {
  if (typeof mapAdd === 'function') mapAdd(o);
  else if (typeof scene !== 'undefined') scene.add(o);
}
function objBegin() {
  objClear();
  OBJ.stat = objBlank();
  OBJ.seen = {};
  OBJ.seq = 1;
  OBJ.rev = 1;
  OBJ.planAt = [-1, -1];
  OBJ.acc = [0, 0];
  OBJ.dirty = true;
  OBJ.pubT = -1;
  OBJ.hold = -1;
  OBJ.end = false;
  objCss();
  if (!objMode()) return;
  OBJ.on = true;
  if (MATCH.mode === 'hp') {
    OBJ.spots = objSpots();
    OBJ.zi = OBJ.spots.length > 2 ? 1 : 0;
    OBJ.left = 60;
    if (OBJ.spots.length) {
      const g = new THREE.Group();
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(Math.max(0.4, OBJ.rad - 0.35), OBJ.rad, 48),
        new THREE.MeshBasicMaterial({ color: 0xf6c445, transparent: true, opacity: 0.92, side: THREE.DoubleSide, depthWrite: false })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.08;
      ring.frustumCulled = false;
      const veil = new THREE.Mesh(
        new THREE.CylinderGeometry(OBJ.rad, OBJ.rad, 1.3, 28, 1, true),
        new THREE.MeshBasicMaterial({ color: 0xf6c445, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false })
      );
      veil.position.y = 0.7;
      veil.frustumCulled = false;
      g.add(ring);
      g.add(veil);
      g.frustumCulled = false;
      OBJ.zoneMat = [ring.material, veil.material];
      OBJ.zoneG = g;
      objAddMesh(g);
      objMoveZone();
    }
  }
  if (MATCH.mode === 'ctf') {
    OBJ.flags = [0, 1].map((team) => {
      const h = objHome(team);
      const f = { team: team, st: 'home', who: null, whoId: '', x: h.x, y: h.y, z: h.z, home: h, t: 0, mesh: objFlagMesh(team) };
      objAddMesh(f.mesh);
      return f;
    });
  }
  const row = $('objRow');
  if (row) row.classList.remove('hidden');
}
function objMoveZone() {
  const p = OBJ.spots[OBJ.zi];
  if (!p || !OBJ.zoneG) return;
  OBJ.zoneG.position.set(p.x, p.y, p.z);
}
function objDropTag(v, pos) {
  if (!v || v.off) return;
  const g = objGround(pos.x, pos.y, pos.z);
  const tag = { id: OBJ.seq++, team: v.team === 1 ? 1 : 0, x: g.x, y: g.y, z: g.z, mesh: objPlate() };
  objAddMesh(tag.mesh);
  OBJ.tags.push(tag);
  while (OBJ.tags.length > 36) {
    const old = OBJ.tags.shift();
    objFree(old.mesh);
  }
  OBJ.dirty = true;
  objEmit(v, 'tag', { id: tag.id, tm: tag.team });
  if (aAliveNudge) aAliveNudge(tag);
  const near = objNearest(tag.x, tag.y, tag.z, OBJ.pickR);
  if (near) objTakeTag(tag, near);
}
let objLastKiller = null;
function objOnDeath(v, a, pos) {
  if (!OBJ.on || !objAuth() || MATCH.over || MATCH.fin) return;
  objLastKiller = a && a !== v ? a : null;
  const p = pos || { x: v.pos.x, y: v.pos.y, z: v.pos.z };
  if (MATCH.mode === 'kc') objDropTag(v, p);
  else if (MATCH.mode === 'ctf') objDropCarried(v, p);
}
function aAliveNudge(tag) {
  const a = objLastKiller;
  if (!a || !a.alive || a.isPlayer || a.isRemote || allied(a, { team: tag.team })) return;
  if (hyp(a.pos.x - tag.x, a.pos.z - tag.z) > 24) return;
  if (a.visible && a.target && a.target.alive && hyp(a.pos.x - a.target.pos.x, a.pos.z - a.target.pos.z) < 11) return;
  a.tactic = 'roam';
  a.goal = null;
  a.path = null;
  a.holdT = 0;
  a.objRole = '';
  objSetRole(a, 'tag' + tag.id);
}
function objRemoveTag(tag) {
  const i = OBJ.tags.indexOf(tag);
  if (i >= 0) OBJ.tags.splice(i, 1);
  objFree(tag.mesh);
  OBJ.dirty = true;
}
function objNearest(x, y, z, rad, pred) {
  let best = null,
    bd = rad;
  for (const e of entities) {
    if (!objIn(e) || (pred && !pred(e))) continue;
    if (Math.abs(e.pos.y - y) > OBJ.dy) continue;
    const d = hyp(e.pos.x - x, e.pos.z - z);
    if (d < bd) {
      bd = d;
      best = e;
    }
  }
  return best;
}
function objAdd(team, n) {
  if (!objAuth() || MATCH.fin || MATCH.over || MATCH.state === 'finish') return;
  MATCH.score[team] += n;
  OBJ.dirty = true;
  if (MATCH.score[0] >= MATCH.limit || MATCH.score[1] >= MATCH.limit) OBJ.end = true;
}
function objTakeTag(tag, e) {
  const mine = e.team === tag.team;
  objRemoveTag(tag);
  if (mine) {
    OBJ.stat.deny++;
    e.score += 50;
    if (e.isPlayer) {
      xpPopup('+50', _t('Plaque refusée'), 'small');
      hudMsg(_t('Plaque refusée'), 'ally', 1.3);
    }
    objEmit(e, 'deny', { tm: tag.team });
  } else {
    OBJ.stat.conf++;
    e.score += 100;
    if (e.isPlayer) {
      xpPopup('+100', _t('Basse confirmée'));
      hudMsg(_t('Basse confirmée'), 'xp', 1.3);
    }
    objEmit(e, 'ok', { tm: e.team });
    objAdd(e.team, 1);
  }
}
function objSimKc() {
  for (const tag of OBJ.tags.slice()) {
    const e = objNearest(tag.x, tag.y, tag.z, OBJ.pickR);
    if (e) objTakeTag(tag, e);
  }
}
function objZoneHere() {
  return OBJ.spots[OBJ.zi] || null;
}
function objCounts(p) {
  const n = [0, 0];
  if (!p) return n;
  for (const e of entities) {
    if (!objIn(e) || Math.abs(e.pos.y - p.y) > OBJ.dy || hyp(e.pos.x - p.x, e.pos.z - p.z) > OBJ.rad) continue;
    n[e.team === 1 ? 1 : 0]++;
  }
  return n;
}
function objSimHp(dt) {
  const p = objZoneHere();
  if (!p) return;
  const n = objCounts(p);
  const solo = n[0] > 0 && n[1] === 0 ? 0 : n[1] > 0 && n[0] === 0 ? 1 : -1;
  if (solo !== OBJ.hold) {
    OBJ.hold = solo;
    OBJ.dirty = true;
    if (solo === PL.ent.team) hudMsg(_t('Votre équipe tient la zone'), 'ally', 1.4);
    else if (solo >= 0) hudMsg(_t('L\u0027ennemi tient la zone'), 'enemy', 1.4);
  }
  if (solo >= 0) {
    OBJ.acc[solo] += dt;
    OBJ.stat.secs[solo] += dt;
    while (OBJ.acc[solo] >= 1) {
      OBJ.acc[solo] -= 1;
      objAdd(solo, 1);
    }
  }
  OBJ.left -= dt;
  if (OBJ.left <= 0) {
    OBJ.zi = OBJ.spots.length ? (OBJ.zi + 1) % OBJ.spots.length : 0;
    OBJ.left = 60;
    OBJ.hold = -1;
    OBJ.dirty = true;
    objMoveZone();
    for (const e of entities) if (!e.isPlayer && !e.isRemote) e.objRole = '';
    const q = objZoneHere();
    hudMsg(q ? _t('Point chaud : {0}', q.name) : _t('Point chaud'), 'xp', 1.8);
    objEmit(PL.ent, 'zone', { i: OBJ.zi });
  }
}
function objHeld(e) {
  for (const f of OBJ.flags) if (f.st === 'carry' && f.who === e) return true;
  return false;
}
function objPlaceFlag(f, p) {
  f.x = p.x;
  f.y = p.y;
  f.z = p.z;
}
function objReturnFlag(f, by) {
  f.st = 'home';
  f.who = null;
  f.whoId = '';
  f.t = 0;
  objPlaceFlag(f, f.home);
  OBJ.stat.rets++;
  OBJ.dirty = true;
  objSoon();
  if (by && by.isPlayer) {
    by.score += 50;
    xpPopup('+50', _t('Drapeau rendu'), 'small');
  }
  if (by && by.team === PL.ent.team) hudMsg(_t('Drapeau récupéré'), 'ally', 1.4);
  objEmit(by || PL.ent, 'ret', { tm: f.team });
}
function objGrab(f, e) {
  f.st = 'carry';
  f.who = e;
  f.whoId = '';
  f.t = 0;
  OBJ.stat.grabs++;
  OBJ.dirty = true;
  objSoon();
  if (!e.isPlayer && !e.isRemote) {
    e.tactic = 'roam';
    e.goal = null;
    e.path = null;
    e.holdT = 0;
    e.objRole = '';
    objSetRole(e, 'run');
    e.forceDecide = true;
  }
  if (e.isPlayer) {
    e.score += 100;
    xpPopup('+100', _t('Drapeau ennemi'));
  }
  hudMsg(e.team === PL.ent.team ? _t('Vous avez le drapeau ennemi') : _t('On a volé votre drapeau'), e.team === PL.ent.team ? 'ally' : 'enemy', 1.6);
  objEmit(e, 'grab', { tm: f.team });
}
function objCapture(f) {
  const e = f.who,
    team = e.team === 1 ? 1 : 0;
  f.st = 'home';
  f.who = null;
  f.whoId = '';
  f.t = 0;
  objPlaceFlag(f, f.home);
  OBJ.stat.caps++;
  objSoon();
  if (e.isPlayer) {
    e.score += 250;
    xpPopup('+250', _t('Drapeau capturé'));
  }
  hudMsg(team === PL.ent.team ? _t('Drapeau capturé') : _t('L\u0027ennemi a capturé'), team === PL.ent.team ? 'ally' : 'enemy', 1.8);
  objEmit(e, 'cap', { tm: team });
  objAdd(team, 1);
}
function objDropCarried(v, pos) {
  for (const f of OBJ.flags) {
    if (f.st !== 'carry' || f.who !== v) continue;
    const g = objGround(pos.x, pos.y, pos.z);
    f.st = 'drop';
    f.who = null;
    f.whoId = '';
    f.t = 0;
    objPlaceFlag(f, g);
    OBJ.dirty = true;
    objSoon();
    hudMsg(f.team === PL.ent.team ? _t('Votre drapeau est au sol') : _t('Le drapeau ennemi est au sol'), 'xp', 1.4);
    objEmit(v, 'drop', { tm: f.team });
  }
}
function objSimCtf(dt) {
  for (const f of OBJ.flags) {
    if (f.st === 'carry') {
      if (!f.who || !f.who.alive) {
        if (f.who) objDropCarried(f.who, { x: f.x, y: f.y, z: f.z });
        else {
          f.st = 'drop';
          f.t = 0;
          OBJ.dirty = true;
        }
        continue;
      }
      objPlaceFlag(f, f.who.pos);
    } else if (f.st === 'drop') {
      f.t += dt;
      if (f.t >= OBJ.retT) {
        objReturnFlag(f, null);
        hudMsg(_t('Le drapeau est rentré seul'), 'neutral', 1.3);
      }
    }
  }
  for (const f of OBJ.flags) {
    if (OBJ.end) return;
    if (f.st === 'drop') {
      const ally = objNearest(f.x, f.y, f.z, OBJ.pickR, (e) => e.team === f.team && !objHeld(e));
      if (ally) {
        objReturnFlag(f, ally);
        continue;
      }
    }
    if (f.st === 'home' || f.st === 'drop') {
      const foe = objNearest(f.x, f.y, f.z, OBJ.pickR, (e) => e.team !== f.team && !objHeld(e));
      if (foe) objGrab(f, foe);
    }
  }
  for (const f of OBJ.flags) {
    if (f.st !== 'carry' || !f.who || !f.who.alive) continue;
    const team = f.who.team === 1 ? 1 : 0;
    if (team === f.team) continue;
    const home = OBJ.flags[team];
    if (!home || home.st !== 'home') continue;
    if (Math.abs(f.who.pos.y - home.home.y) > OBJ.dy + 0.8) continue;
    if (hyp(f.who.pos.x - home.home.x, f.who.pos.z - home.home.z) <= OBJ.capR) objCapture(f);
  }
}
function objSim(dt) {
  if (MATCH.mode === 'kc') objSimKc();
  else if (MATCH.mode === 'hp') objSimHp(dt);
  else if (MATCH.mode === 'ctf') objSimCtf(dt);
}
function objBots(team) {
  const out = [];
  for (const e of entities) {
    if (!e.alive || e.off || e.isPlayer || e.isRemote || e.isZombie || e.team !== team) continue;
    if (MATCH.online && !e.netBot) continue;
    out.push(e);
  }
  return out;
}
function objSetRole(b, role) {
  const same = b.objRole === role;
  b.objRole = role;
  const sticky =
    same && (role === 'defend' || role === 'run' || role === 'roam' || role === 'attack' || role === 'return' || role.indexOf('tag') === 0);
  if (sticky) return;
  b.sq = { p: 0, role: role, rev: ++OBJ.rev };
}
function objSoon() {
  OBJ.planAt[0] = -1;
  OBJ.planAt[1] = -1;
}
function objNote(role) {
  OBJ.seen[role] = (OBJ.seen[role] || 0) + 1;
}
function objPlan(now) {
  for (const team of [0, 1]) {
    if (now < OBJ.planAt[team]) continue;
    OBJ.planAt[team] = now + 1.15;
    const bots = objBots(team);
    if (!bots.length) continue;
    if (MATCH.mode === 'kc') {
      for (const b of bots) {
        const t = objBestTag(b, 42);
        const role = t ? 'tag' + t.id : 'roam';
        objNote(t ? 'tag' : 'roam');
        objSetRole(b, role);
      }
    } else if (MATCH.mode === 'hp') {
      const p = objZoneHere(),
        n = objCounts(p),
        ours = n[team] > 0 && n[1 - team] === 0;
      bots.forEach((b, i) => {
        const role = i % (ours ? 2 : 4) === 0 ? 'defend' : 'attack';
        objNote(role);
        objSetRole(b, role);
      });
    } else if (MATCH.mode === 'ctf') objPlanCtf(team, bots);
  }
}
function objPlanCtf(team, bots) {
  const mine = OBJ.flags[team],
    theirs = OBJ.flags[1 - team];
  if (!mine || !theirs) return;
  const we = theirs.st === 'carry' && theirs.who && theirs.who.team === team;
  const them = mine.st === 'carry' && mine.who;
  if (we) {
    let escort = 0,
      ret = 0;
    const ordered = bots.slice().sort((a, b) => hyp(a.pos.x - theirs.who.pos.x, a.pos.z - theirs.who.pos.z) - hyp(b.pos.x - theirs.who.pos.x, b.pos.z - theirs.who.pos.z));
    for (const b of ordered) {
      let role = 'attack';
      if (b === theirs.who) role = 'run';
      else if (mine.st === 'drop' && ret < 2) {
        role = 'return';
        ret++;
      } else if (escort < 3) {
        role = 'escort';
        escort++;
      }
      objNote(role);
      objSetRole(b, role);
    }
    return;
  }
  if (them) {
    const ordered = bots.slice().sort((a, b) => hyp(a.pos.x - mine.who.pos.x, a.pos.z - mine.who.pos.z) - hyp(b.pos.x - mine.who.pos.x, b.pos.z - mine.who.pos.z));
    ordered.forEach((b, i) => {
      const role = i === ordered.length - 1 ? 'defend' : 'chase';
      objNote(role);
      objSetRole(b, role);
    });
    return;
  }
  if (mine.st === 'drop') {
    const near = bots.slice().sort((a, b) => hyp(a.pos.x - mine.x, a.pos.z - mine.z) - hyp(b.pos.x - mine.x, b.pos.z - mine.z));
    const ret = new Set(near.slice(0, Math.min(2, near.length)));
    for (const b of bots) {
      const role = ret.has(b) ? 'return' : b.aggr < 0.4 ? 'defend' : 'attack';
      objNote(role);
      objSetRole(b, role);
    }
    return;
  }
  const nDef = bots.length >= 5 ? 2 : 1;
  const calm = bots.slice().sort((a, b) => (a.aggr || 0) - (b.aggr || 0));
  const defs = new Set(calm.slice(0, nDef));
  for (const b of bots) {
    const role = defs.has(b) && theirs.st !== 'drop' ? 'defend' : 'attack';
    objNote(role);
    objSetRole(b, role);
  }
}
function objBestTag(b, rad) {
  let best = null,
    bs = -1e9;
  for (const t of OBJ.tags) {
    const d = hyp(t.x - b.pos.x, t.z - b.pos.z);
    if (d > rad) continue;
    const confirm = t.team !== b.team;
    let s = (confirm ? 30 : 12) - d;
    for (const o of entities) {
      if (o !== b && o.alive && allied(o, b) && o.goal && hyp(o.goal.x - t.x, o.goal.z - t.z) < 2.2) s -= 7;
    }
    if (s > bs) {
      bs = s;
      best = t;
    }
  }
  return best;
}
function objFocus(b) {
  if (MATCH.mode === 'hp') return objZoneHere();
  if (MATCH.mode !== 'ctf') return null;
  const role = b.objRole || 'attack',
    mine = OBJ.flags[b.team],
    theirs = OBJ.flags[1 - b.team];
  if (!mine || !theirs) return null;
  if (role === 'run' || role === 'defend') return mine.home;
  if (role === 'return') return mine.st === 'drop' ? mine : mine.home;
  if (role === 'chase') return mine.st === 'carry' && mine.who ? mine.who.pos : mine;
  if (role === 'escort') return theirs.st === 'carry' && theirs.who ? theirs.who.pos : theirs;
  if (theirs.st === 'carry' && theirs.who) return theirs.who.pos;
  return theirs.st === 'home' ? theirs.home : theirs;
}
function objAt(x, y, z) {
  const id = typeof navNode === 'function' ? navNode(x, y, z) : -1;
  if (id >= 0 && Math.abs(NAV.ny[id] - y) < 2.2 && hyp(NAV.nx[id] - x, NAV.nz[id] - z) < 2.2) return new V3(NAV.nx[id], NAV.ny[id], NAV.nz[id]);
  return new V3(x, y, z);
}
function objSpot(x, y, z, r0, r1, hold, maxD) {
  const lim = maxD == null ? r1 : maxD;
  const lo = Math.min(r0, r1),
    hi = Math.max(r0, r1);
  for (let k = 0; k < 8; k++) {
    const a = rand(0, TAU),
      r = rand(lo, hi),
      id = navNode(x + Math.cos(a) * r, y, z + Math.sin(a) * r);
    if (id < 0 || Math.abs(NAV.ny[id] - y) > 2 || hyp(NAV.nx[id] - x, NAV.nz[id] - z) > lim) continue;
    const g = new V3(NAV.nx[id], NAV.ny[id], NAV.nz[id]);
    g.hold = !!hold;
    return g;
  }
  const g = objAt(x, y, z);
  g.hold = !!hold;
  return g;
}
function objGoal(b) {
  if (!OBJ.on || !b) return null;
  if (MATCH.mode === 'kc') {
    const t = objBestTag(b, 42);
    if (!t) return null;
    return objAt(t.x, t.y, t.z);
  }
  const p = objFocus(b);
  if (!p) return null;
  const y = p.y !== undefined ? p.y : gy0(p.x, p.z),
    role = b.objRole || 'attack';
  if (MATCH.mode === 'hp') {
    const defend = role === 'defend';
    const g = objSpot(p.x, y, p.z, defend ? 0.3 : 0.6, defend ? 2.4 : Math.max(1.2, OBJ.rad - 1.1), defend, OBJ.rad - 0.45);
    if (defend) g.look = { x: p.x, z: p.z };
    return g;
  }
  if (role === 'escort') return objSpot(p.x, y, p.z, 1.2, 2.6, false, 3.4);
  if (role === 'defend') {
    const g = objSpot(p.x, y, p.z, 1.2, 3.6, true, 4.6);
    g.look = { x: p.x, z: p.z };
    return g;
  }
  return objAt(p.x, y, p.z);
}
function objCarrying(b) {
  if (MATCH.mode !== 'ctf') return false;
  for (const f of OBJ.flags) if (f.st === 'carry' && f.who === b) return true;
  return false;
}
function objDropHunt(b) {
  if (!b || b.visible || !b.lastKnown) return false;
  let p = null;
  if (MATCH.mode === 'kc') p = objBestTag(b, 18);
  else p = objFocus(b);
  if (!p) return false;
  return hyp(b.lastKnown.x - p.x, b.lastKnown.z - p.z) > 14 && hyp(b.pos.x - p.x, b.pos.z - p.z) > 8;
}
function objEmit(actor, a, extra) {
  OBJ.dirty = true;
  if (!MATCH.online || !objAuth() || typeof netEvent !== 'function') return;
  const ev = { k: 'ob', a: a };
  if (extra) for (const k in extra) ev[k] = extra[k];
  if (actor && typeof netIsLocal === 'function' && netIsLocal(actor)) netEvent(ev, actor);
}
function objPack() {
  const s = OBJ.stat || objBlank();
  const o = {
    m: MATCH.mode,
    s: [MATCH.score[0] | 0, MATCH.score[1] | 0],
    st: [s.conf | 0, s.deny | 0, Math.round((s.secs[0] + s.secs[1]) * 10) / 10, s.caps | 0, s.grabs | 0, s.rets | 0]
  };
  if (MATCH.mode === 'kc') o.tags = OBJ.tags.map((t) => [t.id | 0, t.team, +t.x.toFixed(2), +t.y.toFixed(2), +t.z.toFixed(2)]);
  else if (MATCH.mode === 'hp') o.z = [OBJ.zi | 0, +OBJ.left.toFixed(2)];
  else if (MATCH.mode === 'ctf')
    o.f = OBJ.flags.map((f) => [
      f.st,
      f.who && typeof netIdOf === 'function' ? netIdOf(f.who) || '' : '',
      +f.x.toFixed(2),
      +f.y.toFixed(2),
      +f.z.toFixed(2),
      +f.t.toFixed(2)
    ]);
  return o;
}
function objBroadcast() {
  if (!MATCH.online || NET.role !== 'host' || typeof netBroadcast !== 'function') return;
  const now = MATCH.time;
  if (!OBJ.dirty && now - OBJ.pubT < 0.25) return;
  if (OBJ.dirty && OBJ.pubT >= 0 && now - OBJ.pubT < 0.05) return;
  OBJ.pubT = now;
  OBJ.dirty = false;
  netBroadcast({ t: 'ob', d: objPack() }, true);
}
function objApplyTags(list) {
  if (!Array.isArray(list)) return;
  const ids = new Set();
  const cap = list.slice(0, 48);
  for (const raw of cap) {
    if (!Array.isArray(raw) || raw.length < 5) continue;
    const id = raw[0] | 0;
    if (id <= 0 || ids.has(id)) continue;
    const x = objNum(raw[2], -800, 800),
      y = objNum(raw[3], -80, 400),
      z = objNum(raw[4], -800, 800);
    if (x === null || y === null || z === null) continue;
    ids.add(id);
    let tag = null;
    for (const t of OBJ.tags) if (t.id === id) tag = t;
    if (!tag) {
      tag = { id: id, team: raw[1] === 1 ? 1 : 0, x: x, y: y, z: z, mesh: objPlate() };
      objAddMesh(tag.mesh);
      OBJ.tags.push(tag);
    } else {
      tag.team = raw[1] === 1 ? 1 : 0;
      tag.x = x;
      tag.y = y;
      tag.z = z;
    }
  }
  for (const t of OBJ.tags.slice()) if (!ids.has(t.id)) objRemoveTag(t);
}
function objNetApply(m) {
  if (!m || m.t !== 'ob' || objAuth() || !OBJ.on) return;
  const d = m.d;
  if (!d || d.m !== MATCH.mode) return;
  if (Array.isArray(d.s) && !MATCH.fin) {
    const a = objNum(d.s[0], 0, 99999),
      b = objNum(d.s[1], 0, 99999);
    if (a !== null && b !== null) MATCH.score = [a | 0, b | 0];
  }
  if (Array.isArray(d.st) && OBJ.stat) {
    OBJ.stat.conf = d.st[0] | 0;
    OBJ.stat.deny = d.st[1] | 0;
    OBJ.stat.caps = d.st[3] | 0;
    OBJ.stat.grabs = d.st[4] | 0;
    OBJ.stat.rets = d.st[5] | 0;
  }
  if (MATCH.mode === 'kc') objApplyTags(d.tags);
  else if (MATCH.mode === 'hp' && Array.isArray(d.z)) {
    const i = d.z[0] | 0,
      l = objNum(d.z[1], 0, 60);
    if (i >= 0 && i < OBJ.spots.length && i !== OBJ.zi) {
      OBJ.zi = i;
      objMoveZone();
    }
    if (l !== null) OBJ.left = l;
  } else if (MATCH.mode === 'ctf' && Array.isArray(d.f)) {
    d.f.forEach((raw, i) => {
      const f = OBJ.flags[i];
      if (!f || !Array.isArray(raw)) return;
      const st = raw[0] === 'carry' || raw[0] === 'drop' || raw[0] === 'home' ? raw[0] : '';
      if (!st) return;
      f.st = st;
      f.whoId = typeof raw[1] === 'string' ? raw[1] : '';
      f.who = f.whoId && typeof netEntity === 'function' ? netEntity(f.whoId) : null;
      const x = objNum(raw[2], -800, 800),
        y = objNum(raw[3], -80, 400),
        z = objNum(raw[4], -800, 800),
        t = objNum(raw[5], 0, 120);
      if (x !== null) {
        f.x = x;
        f.y = y;
        f.z = z;
      }
      if (t !== null) f.t = t;
    });
  }
}
function objEvIn(e, ev) {
  if (!ev || ev.k !== 'ob') return;
  if (!objAuth()) OBJ.dirty = true;
}
function objTick(dt) {
  if (!OBJ.on || !objMode()) return;
  if (objAuth()) {
    objSim(dt);
    objPlan(MATCH.time);
    objBroadcast();
    if (OBJ.end && !MATCH.fin && !MATCH.finSoon) matchFinish();
  } else if (MATCH.mode === 'hp') OBJ.left = Math.max(0, OBJ.left - dt);
  objVisual(dt);
}
function objVisual() {
  const bob = 0.12 + Math.sin(MATCH.time * 3) * 0.04;
  for (const t of OBJ.tags) if (t.mesh) t.mesh.position.set(t.x, t.y + bob, t.z);
  for (const f of OBJ.flags) {
    if (!objAuth() && f.st === 'carry' && f.whoId && !f.who && typeof netEntity === 'function') f.who = netEntity(f.whoId);
    if (f.st === 'carry' && f.who && f.who.alive) objPlaceFlag(f, f.who.pos);
    if (!f.mesh) continue;
    const y = f.st === 'carry' ? f.y : f.y;
    f.mesh.position.set(f.x, y, f.z);
    const cloth = f.mesh.userData.flag;
    if (cloth) cloth.rotation.y = Math.sin(MATCH.time * 2.4 + f.team) * 0.35;
  }
  if (OBJ.zoneG && OBJ.zoneMat) {
    const p = objZoneHere(),
      n = p ? objCounts(p) : [0, 0],
      me = PL.ent.team,
      solo = n[0] > 0 && n[1] === 0 ? 0 : n[1] > 0 && n[0] === 0 ? 1 : -1,
      hot = n[0] > 0 && n[1] > 0;
    const col = hot ? 0xf6c445 : solo < 0 ? 0xd9d3c4 : solo === me ? 0x8fd16a : 0xef5543;
    OBJ.zoneMat[0].color.setHex(col);
    OBJ.zoneMat[1].color.setHex(col);
    OBJ.zoneMat[1].opacity = hot ? 0.28 : 0.14;
  }
}
function objCol(team) {
  return team === PL.ent.team ? 'ally' : 'enemy';
}
function objMark(i) {
  while (OBJ.mks.length <= i) {
    const el = document.createElement('div');
    el.className = 'dpm';
    el.innerHTML = '<b></b><i></i>';
    const hud = $('hud'),
      at = $('scope');
    if (hud) hud.insertBefore(el, at || null);
    OBJ.mks.push(el);
  }
  return OBJ.mks[i];
}
function objProject(el, x, y, z, cls, title) {
  _objV.set(x, y + 2.3, z).project(camera);
  const show = _objV.z < 1 && Math.abs(_objV.x) < 1.15 && Math.abs(_objV.y) < 1.15;
  hudStyle(el, 'opacity', show ? '1' : '0');
  if (!show) return;
  hudStyle(
    el,
    'transform',
    'translate(' +
      Math.round((_objV.x * 0.5 + 0.5) * VIEW.w) +
      'px,' +
      Math.round((-_objV.y * 0.5 + 0.5) * VIEW.h) +
      'px) translate(-50%,-50%)'
  );
  if (el.className !== cls) el.className = cls;
  const dist = Math.round(hyp(x - camera.position.x, z - camera.position.z)) + ' m';
  if (el.firstChild.textContent !== title) el.firstChild.textContent = title;
  hudText(el.lastChild, dist);
}
function objHud() {
  if (!OBJ.on) {
    const row0 = $('objRow');
    if (row0) row0.classList.add('hidden');
    return;
  }
  const row = $('objRow'),
    cap = $('objCap');
  if (row) row.classList.remove('hidden');
  let line = '',
    near = '',
    nearCls = '';
  const me = PL.ent;
  if (MATCH.mode === 'kc') {
    line = OBJ.tags.length ? _t('{0} plaques au sol', OBJ.tags.length) : _t('Aucune plaque');
    let bd = 12,
      tag = null;
    for (const t of OBJ.tags) {
      const d = hyp(t.x - me.pos.x, t.z - me.pos.z);
      if (d < bd) {
        bd = d;
        tag = t;
      }
    }
    if (tag && me.alive) {
      near = tag.team === me.team ? _t('Refusez la plaque') : _t('Confirmez la basse');
      nearCls = tag.team === me.team ? 'ally' : 'enemy';
    }
  } else if (MATCH.mode === 'hp') {
    const p = objZoneHere(),
      n = p ? objCounts(p) : [0, 0];
    const who = n[0] > 0 && n[1] > 0 ? _t('disputée') : n[me.team] > 0 ? _t('à vous') : n[1 - me.team] > 0 ? _t('ennemie') : _t('vide');
    line = _t('Zone {0} · {1} s · {2}', p ? p.name : '—', Math.max(0, Math.ceil(OBJ.left)), who);
    if (p && me.alive && hyp(me.pos.x - p.x, me.pos.z - p.z) <= OBJ.rad && Math.abs(me.pos.y - p.y) <= OBJ.dy) {
      near = n[0] > 0 && n[1] > 0 ? _t('Zone disputée') : n[me.team] > 0 ? _t('Vous marquez 1 point par seconde') : _t('Entrez seuls dans la zone');
      nearCls = n[0] > 0 && n[1] > 0 ? 'hot' : 'ally';
    }
  } else if (MATCH.mode === 'ctf') {
    const mine = OBJ.flags[me.team],
      theirs = OBJ.flags[1 - me.team];
    const txt = (f, own) => {
      if (!f) return '—';
      if (f.st === 'home') return own ? _t('à la maison') : _t('dans sa base');
      if (f.st === 'drop') return _t('au sol');
      if (f.who === me) return _t('vous le portez');
      if (f.who && f.who.team === me.team) return _t('un allié le porte');
      return _t('l\u0027ennemi le porte');
    };
    line = _t('Le nôtre {0} · l\u0027ennemi {1}', txt(mine, true), txt(theirs, false));
    if (theirs && theirs.who === me) {
      const home = OBJ.flags[me.team];
      near = home && home.st === 'home' ? _t('Portez-le à votre base') : _t('Votre drapeau n\u0027est pas à la maison');
      nearCls = 'ally';
    } else if (mine && mine.st === 'drop' && me.alive && hyp(me.pos.x - mine.x, me.pos.z - mine.z) < 14) {
      near = _t('Ramenez votre drapeau');
      nearCls = 'ally';
    }
  }
  if (row) hudText(row, line);
  if (cap) {
    cap.className = near ? 'show ' + nearCls : '';
    hudText(cap, near);
  }
  const lim =
    MATCH.mode === 'kc'
      ? _t('Premier à {0} confirmations', MATCH.limit)
      : MATCH.mode === 'hp'
        ? _t('Premier à {0} points', MATCH.limit)
        : _t('Premier à {0} captures', MATCH.limit);
  const sc = $('scLim');
  if (sc) hudText(sc, lim);
  let mi = 0;
  if (MATCH.mode === 'kc') {
    for (const t of OBJ.tags) {
      if (hyp(t.x - me.pos.x, t.z - me.pos.z) > 70) continue;
      objProject(objMark(mi++), t.x, t.y, t.z, 'dpm ' + (t.team === me.team ? 'ally' : 'enemy'), 'P');
    }
  } else if (MATCH.mode === 'hp') {
    const p = objZoneHere();
    if (p) {
      const n = objCounts(p),
        hot = n[0] > 0 && n[1] > 0,
        solo = n[0] > 0 && !n[1] ? 0 : n[1] > 0 && !n[0] ? 1 : -1,
        cls = 'dpm ' + (hot ? 'hot' : solo < 0 ? '' : solo === me.team ? 'ally' : 'enemy');
      objProject(objMark(mi++), p.x, p.y, p.z, cls, p.name);
    }
  } else {
    for (const f of OBJ.flags) {
      const x = f.st === 'carry' && f.who ? f.who.pos.x : f.x,
        y = f.st === 'carry' && f.who ? f.who.pos.y : f.y,
        z = f.st === 'carry' && f.who ? f.who.pos.z : f.z;
      objProject(objMark(mi++), x, y, z, 'dpm ' + objCol(f.team) + (f.st === 'drop' ? ' hot' : ''), f.team === me.team ? 'N' : 'E');
    }
  }
  for (let i = mi; i < OBJ.mks.length; i++) hudStyle(OBJ.mks[i], 'opacity', '0');
}
function objMinimap(g, scale, yaw) {
  if (!OBJ.on || !g) return;
  const me = PL.ent.team;
  if (MATCH.mode === 'kc') {
    for (const t of OBJ.tags) {
      g.fillStyle = t.team === me ? '#8FD16A' : '#F6C445';
      g.beginPath();
      g.arc(t.x * scale, t.z * scale, 3.2, 0, TAU);
      g.fill();
    }
  } else if (MATCH.mode === 'hp') {
    const p = objZoneHere();
    if (!p) return;
    const n = objCounts(p),
      hot = n[0] > 0 && n[1] > 0;
    g.fillStyle = hot ? 'rgba(246,196,69,.28)' : 'rgba(242,238,227,.16)';
    g.strokeStyle = hot ? '#F6C445' : '#F2EEE3';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(p.x * scale, p.z * scale, OBJ.rad * scale, 0, TAU);
    g.fill();
    g.stroke();
    g.save();
    g.translate(p.x * scale, p.z * scale);
    g.rotate(-yaw);
    g.fillStyle = '#F2EEE3';
    g.font = '700 13px sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(p.name, 0, 1);
    g.restore();
  } else if (MATCH.mode === 'ctf') {
    for (const f of OBJ.flags) {
      const x = f.st === 'carry' && f.who ? f.who.pos.x : f.x,
        z = f.st === 'carry' && f.who ? f.who.pos.z : f.z;
      g.save();
      g.translate(x * scale, z * scale);
      g.rotate(-yaw);
      g.fillStyle = f.team === me ? '#8FD16A' : '#EF5543';
      g.strokeStyle = 'rgba(0,0,0,.75)';
      g.lineWidth = 1;
      g.fillRect(-4, -6, 8, 6);
      g.strokeRect(-4, -6, 8, 6);
      g.fillRect(-1, -6, 2, 10);
      g.restore();
    }
  }
}
function objKicker() {
  if (!objMode()) return '';
  if (typeof finByLimit === 'function' && !finByLimit()) return '';
  if (MATCH.mode === 'kc') return _t('Confirmations atteintes');
  if (MATCH.mode === 'hp') return _t('Points de zone atteints');
  return _t('Captures atteintes');
}

/* Carte compatible : le point chaud veut des points de domination ; les autres, des apparitions. Pas de cartes zombies (absentes en 5.6). */
function objModeAllowed(id, mapId) {
  if (id !== 'kc' && id !== 'hp' && id !== 'ctf') return true;
  const D = MAP_DEFS[mapId];
  if (!D || D.zombie) return false;
  if (id === 'hp') return !!D.dom;
  if (id === 'ctf') return !!(D.dom || D.spawns);
  return true;
}
function objFixStoredMode() {
  if (objModeAllowed(Settings.mode, Settings.map)) return;
  Settings.mode = 'tdm';
  if (typeof saveSettings === 'function') saveSettings();
}
const _obj_modeStart = modeStart;
modeStart = function (mode) {
  const D = _obj_modeStart(mode);
  objBegin();
  return D;
};
const _obj_modeEnd = modeEnd;
modeEnd = function () {
  objClear();
  return _obj_modeEnd();
};
const _obj_modeUpdate = modeUpdate;
modeUpdate = function (dt) {
  _obj_modeUpdate(dt);
  objTick(dt);
};
const _obj_killLim = killLimitReached;
killLimitReached = function () {
  if (objMode()) return false;
  return _obj_killLim();
};
const _obj_finKicker = finKicker;
finKicker = function () {
  const k = objKicker();
  if (k) return k;
  return _obj_finKicker();
};
const _obj_killEnt = killEnt;
killEnt = function (v, a, weapon, head, dir, life) {
  const was = !!(v && v.alive);
  const pos = v && v.pos ? { x: v.pos.x, y: v.pos.y, z: v.pos.z } : null;
  const r = _obj_killEnt(v, a, weapon, head, dir, life);
  if (was && v && !v.alive) objOnDeath(v, a, pos);
  return r;
};
const _obj_pick = pickGoal;
pickGoal = function (b, now) {
  if (OBJ.on && b) {
    const g = objGoal(b);
    if (g) {
      b.pace = 2;
      b.paceT = Math.max(b.paceT || 0, 3.5);
      return g;
    }
  }
  return _obj_pick(b, now);
};
const _obj_dec = decideTactic;
decideTactic = function (b, now) {
  if (!OBJ.on || !b) return _obj_dec(b, now);
  if (objCarrying(b)) {
    const T = b.target,
      vis = !!(b.visible && T && T.alive),
      d = vis ? hyp(T.pos.x - b.pos.x, T.pos.z - b.pos.z) : 99;
    if (d > 8) {
      if (b.tactic !== 'roam') {
        b.tactic = 'roam';
        b.goal = null;
        b.path = null;
        b.holdT = 0;
      }
      return;
    }
  }
  const role = b.objRole || '';
  let focus = null;
  if (MATCH.mode === 'kc' && role.indexOf('tag') === 0) focus = objBestTag(b, 48);
  else if (MATCH.mode === 'ctf' && role !== 'defend' && role !== 'roam') focus = objFocus(b);
  if (focus) {
    const dObj = hyp(b.pos.x - focus.x, b.pos.z - focus.z);
    const T = b.target,
      vis = !!(b.visible && T && T.alive),
      dE = vis ? hyp(T.pos.x - b.pos.x, T.pos.z - b.pos.z) : 99;
    const close = role === 'escort' ? 3.2 : 2.2;
    if (dObj > close && dE > 8) {
      if (b.tactic !== 'roam') {
        b.tactic = 'roam';
        b.goal = null;
        b.path = null;
        b.holdT = 0;
      }
      b.lastSeenT = -99;
      return;
    }
  }
  if (objDropHunt(b)) b.lastSeenT = -99;
  return _obj_dec(b, now);
};
const _obj_setPath = setPath;
setPath = function (b, target) {
  _obj_setPath(b, target);
  if (OBJ.on && b.goal && target && target.look) b.goal.look = target.look;
};
const _obj_hud = updateHud;
updateHud = function (dt) {
  _obj_hud(dt);
  if (OBJ.on) objHud();
};
const _obj_netClient = netClientMsg;
netClientMsg = function (m) {
  if (m && m.t === 'ob') {
    objNetApply(m);
    return;
  }
  return _obj_netClient(m);
};
const _obj_netEv = netEventIn;
netEventIn = function (e, ev) {
  if (ev && ev.k === 'ob') {
    objEvIn(e, ev);
    return;
  }
  return _obj_netEv(e, ev);
};
/* Mini-carte : le contexte est déjà tourné (domMinimap est appelé au milieu de drawMinimap). */
const _obj_domMm = domMinimap;
domMinimap = function (g, scale, yaw) {
  _obj_domMm(g, scale, yaw);
  objMinimap(g, scale, yaw);
};
/* Un mode d'objectif sur une carte qui ne le porte pas retombe sur le match à mort, comme un id inconnu. */
const _obj_netCfg = netCfg;
netCfg = function (c) {
  const o = _obj_netCfg(c);
  if (o && !objModeAllowed(o.mode, o.map)) {
    o.mode = 'tdm';
    const L = MODES.tdm.limits;
    if (!L.includes(+o.limit)) o.limit = L[1];
  }
  return o;
};
/* Menu : solo (pas en ligne) et hôte (edit). L'invité garde le mode déjà choisi, en lecture seule. */
const _obj_matchRows = matchRows;
matchRows = function (o) {
  const rows = _obj_matchRows(o);
  const modeRow = rows.find((r) => r && r.key === 'mode');
  if (!modeRow || !modeRow.items) return rows;
  const soloOrHost = !o.online || o.edit;
  modeRow.items = modeRow.items.filter((it) => {
    const id = it[0];
    if (id !== 'kc' && id !== 'hp' && id !== 'ctf') return true;
    if (!objModeAllowed(id, o.map)) return false;
    return soloOrHost || o.mode === id;
  });
  return rows;
};
if (typeof SOLO_PAGES !== 'undefined' && SOLO_PAGES.solo) {
  const _obj_soloPage = SOLO_PAGES.solo;
  SOLO_PAGES.solo = function () {
    objFixStoredMode();
    return _obj_soloPage();
  };
}
