/* Semtex, aturdidora y C4. Los tipos nuevos viajan por k:'nx' / k:'nd'
   para que una build 5.6 original ignore el evento. k:'nade' con un id
   desconocido no debe convertirse en frag. */
const STUN = { life: 3, r: 12, near: 2.6, move: 0.45, turn: 0.42, flash: 0.16 };
const EQ_COL = { semtex: 0x3c6e34, stun: 0xd6c15a, c4: 0xc2ae86 };
const _stunE = new V3();
const EQ_NADES = ['semtex', 'stun', 'c4'];

NADE_TYPES.semtex = {
  fuse: 2.5, name: _t('Semtex'), long: _t('Explosif adhésif'),
  icon: '<rect x="6" y="9" width="12" height="7" rx="1.2"/><path d="M8 9V7.2h8V9M9 16v2.2M15 16v2.2"/>',
  desc: _t('Il se colle aux surfaces et aux soldats. Il explose au bout de 2,5 s. On ne le cuisine pas.')
};
NADE_TYPES.stun = {
  fuse: 1.35, name: _t('Étourdissante'), long: _t('Grenade étourdissante'),
  icon: '<rect x="8" y="6" width="8" height="13" rx="1.4"/><path d="M10 6V4h4v2M6 11h2M16 11h2M7 15h2M15 15h2"/>',
  desc: _t('Elle ralentit le mouvement, la visée et la sensibilité pendant environ 3 s. Moins forte que la flash. Le masque tactique la réduit aussi.')
};
NADE_TYPES.c4 = {
  fuse: 45, name: _t('C4'), long: _t('Charge déclenchée à distance'),
  icon: '<rect x="4" y="8" width="16" height="9" rx="1"/><path d="M8 8V6h3l1 2M14 12h4"/>',
  desc: _t('On la lance et on la déclenche avec la touche de grenade. Les bots la font sauter si un ennemi passe près. Au bout de 45 s, elle se désarme.')
};
for (const id of EQ_NADES) if (!NADE_IDS.includes(id)) NADE_IDS.push(id);
if (HAND_POSES.nfrag) {
  HAND_POSES.nsemtex = JSON.parse(JSON.stringify(HAND_POSES.nfrag));
  HAND_POSES.nc4 = JSON.parse(JSON.stringify(HAND_POSES.nfrag));
}
if (HAND_POSES.nflash) HAND_POSES.nstun = JSON.parse(JSON.stringify(HAND_POSES.nflash));
if (NADE_GRIP.frag) {
  NADE_GRIP.semtex = JSON.parse(JSON.stringify(NADE_GRIP.frag));
  NADE_GRIP.c4 = JSON.parse(JSON.stringify(NADE_GRIP.frag));
}
if (NADE_GRIP.flash) NADE_GRIP.stun = JSON.parse(JSON.stringify(NADE_GRIP.flash));
NET_WSPECIAL.semtex = _t('Semtex');
NET_WSPECIAL.c4 = _t('C4');

const _nadeCountEq = nadeCount;
nadeCount = function (id, n) {
  if (id === 'semtex') return _tn(n, '{0} Semtex', '{0} Semtex');
  if (id === 'stun') return _tn(n, '{0} grenade étourdissante', '{0} grenades étourdissantes');
  if (id === 'c4') return _tn(n, '{0} C4', '{0} C4');
  return _nadeCountEq(id, n);
};

function eqIs(ty) { return EQ_NADES.indexOf(ty) >= 0; }

function equipoPaint(n) {
  const col = EQ_COL[n.type];
  if (!col || !n.mesh) return;
  n.mesh.traverse((o) => {
    if (!o.isMesh || !o.material || !o.material.color) return;
    const m = o.material.clone();
    m.color.setHex(col);
    o.material = m;
  });
}

const _spawnNadeEq = spawnNade;
spawnNade = function (owner, p, v, fuse, type) {
  _spawnNadeEq(owner, p, v, fuse, type);
  const n = NADES[NADES.length - 1];
  if (n && eqIs(n.type)) equipoPaint(n);
};

function nadePre(n) {
  if (!n || n.type !== 'semtex' || !n.stickEnt) return;
  const e = n.stickEnt;
  if (!e.alive) {
    n.stickEnt = null; n.stuck = true; n.asleep = true; n.v.set(0, 0, 0);
    return;
  }
  const o = n.stickOff;
  n.p.set(e.pos.x + o.x, e.pos.y + o.y, e.pos.z + o.z);
  n.stuck = true; n.asleep = true; n.v.set(0, 0, 0);
}
function nadeTouchEnt(n, e) {
  if (!n || n.type !== 'semtex' || n.stuck || n.age < 0.012 || !e || !e.alive || e.off || e === n.owner) return;
  const h = e.crouch ? 1.05 : 1.55;
  if (hyp(n.p.x - e.pos.x, n.p.z - e.pos.z) > 0.55) return;
  if (n.p.y < e.pos.y + 0.1 || n.p.y > e.pos.y + h + 0.2) return;
  const ox = clamp(n.p.x - e.pos.x, -0.28, 0.28), oy = clamp(n.p.y - e.pos.y, 0.2, h), oz = clamp(n.p.z - e.pos.z, -0.28, 0.28);
  n.stickEnt = e; n.stickOff = new V3(ox, oy, oz);
  n.p.set(e.pos.x + ox, e.pos.y + oy, e.pos.z + oz);
  n.stuck = true; n.asleep = true; n.v.set(0, 0, 0); n.spinW = 0;
}

const _nadeHitEq = nadeHit;
nadeHit = function (n, nx, ny, nz, soft, wall) {
  if (n && n.type === 'semtex' && !n.stuck) {
    n.stuck = true; n.asleep = true; n.v.set(0, 0, 0); n.spinW = 0;
    return 0;
  }
  if (n && n.type === 'c4') {
    n.asleep = true; n.v.set(0, 0, 0); n.spinW = 0;
    return 0;
  }
  return _nadeHitEq(n, nx, ny, nz, soft, wall);
};

function stunPower(dist) {
  if (dist > STUN.r) return 0;
  return clamp(1 - smoothstep(STUN.near, STUN.r, dist), 0, 1);
}
function applyStun(e, k) {
  if (!e || k <= 0.04) return;
  if (typeof perkStunMul === 'function') k *= perkStunMul(e);
  const dur = STUN.life * k, left = (e.stunUntil || 0) - MATCH.time;
  if (left > dur && (e.stunK || 0) >= k * 0.98) return;
  e.stunUntil = MATCH.time + dur; e.stunK = k; e.stunDur = dur;
  if (e.isPlayer) PL.stunT = dur;
}
function stunBang(p, owner) {
  const q = p.clone(); q.y += 0.15;
  if (typeof flashLight === 'function') flashLight(q, 18, 10, 0.12, 0xfff2c4);
  if (typeof sfxFlashBang === 'function') sfxFlashBang(q, 0.35, 0.8);
  if (owner) { soundEvents.push({ pos: q.clone(), team: owner.team, who: owner, t: MATCH.time, loud: true }); while (soundEvents.length > 60) soundEvents.shift(); }
  let hit = 0;
  for (const b of entities) {
    if (!b.alive || b.off) continue;
    const eye = b.isPlayer ? camera.position : entEye(b, _stunE);
    const d = eye.distanceTo(q);
    if (d > STUN.r) continue;
    if (d > 0.35 && (!lineClear(eye, q) || (typeof smokeBlocks === 'function' && smokeBlocks(eye, q)))) continue;
    const k = stunPower(d);
    if (k <= 0.04) continue;
    applyStun(b, k);
    if (owner === PL.ent && !allied(b, owner) && !b.isPlayer) hit++;
  }
  if (hit && MATCH.state === 'playing' && typeof hitFeedback === 'function') hitFeedback(false, false);
}

const _nadeBurstEq = nadeBurst;
nadeBurst = function (type, p, owner, life) {
  if (type === 'stun') { stunBang(p, owner); return; }
  if (type === 'semtex') { explode(p, owner, NET_WSPECIAL.semtex, 7.2, 155, life); return; }
  if (type === 'c4') { explode(p, owner, NET_WSPECIAL.c4, 8.2, 180, life); return; }
  _nadeBurstEq(type, p, owner, life);
};

function c4Owned(owner) {
  const out = [];
  for (const n of NADES) if (n.type === 'c4' && n.owner === owner && !n.disarm) out.push(n);
  return out;
}
function c4Detonate(owner, fromNet) {
  const list = c4Owned(owner);
  if (!list.length) return false;
  for (const n of list) n.detonate = true, n.fuse = 0;
  if (!fromNet && MATCH.online && typeof netIsLocal === 'function' && netIsLocal(owner)) netEvent({ k: 'nd' }, owner);
  return true;
}

const _updateNadesEq = updateNades;
updateNades = function (dt) {
  for (const n of NADES) {
    nadePre(n);
    if (n.type === 'semtex' && !n.stuck) {
      for (const e of entities) nadeTouchEnt(n, e);
    }
    if (n.type === 'c4' && !n.detonate && n.fuse <= dt) { n.fuse = 99; n.disarm = true; }
    if (n.type === 'c4' && !n.detonate && n.owner && !n.owner.isPlayer && !n.owner.isRemote) {
      for (const e of entities) {
        if (!e.alive || e.off || allied(e, n.owner)) continue;
        if (hyp(e.pos.x - n.p.x, e.pos.z - n.p.z) < 3.8 && Math.abs(e.pos.y - n.p.y) < 2.2) { n.detonate = true; n.fuse = 0; break; }
      }
    }
  }
  _updateNadesEq(dt);
  for (let i = NADES.length - 1; i >= 0; i--) {
    const n = NADES[i];
    if (!n.disarm) continue;
    if (n.mesh) scene.remove(n.mesh);
    NADES.splice(i, 1);
  }
};

const _cookNadeEq = cookNade;
cookNade = function () {
  if (c4Owned(PL.ent).length) { c4Detonate(PL.ent, false); return; }
  _cookNadeEq();
};

const _netEventEq = netEvent;
netEvent = function (ev, ent) {
  if (ev && ev.k === 'nade' && eqIs(ev.ty)) ev = Object.assign({}, ev, { k: 'nx' });
  return _netEventEq(ev, ent);
};
const _netEventInEq = netEventIn;
netEventIn = function (e, ev) {
  if (ev && ev.k === 'nd') { c4Detonate(e, true); return; }
  if (ev && ev.k === 'nx' && e && eqIs(ev.ty)) {
    if (!e.net) e.net = {};
    const w = e.net.nadeW || (e.net.nadeW = { t: -9, n: 0 });
    if (MATCH.time - w.t >= 1) { w.t = MATCH.time; w.n = 0; }
    if (++w.n > 4) return;
    if (!e.isPlayer) e.throwT = 0.7;
    const p = new V3(clamp(numOr(ev.px), MAP.x0 - 50, MAP.x1 + 50), clamp(numOr(ev.py), -50, 300), clamp(numOr(ev.pz), MAP.z0 - 50, MAP.z1 + 50));
    const v = new V3(clamp(numOr(ev.vx), -40, 40), clamp(numOr(ev.vy), -40, 40), clamp(numOr(ev.vz), -40, 40));
    spawnNade(e, p, v, clamp(numOr(ev.fu, nadeFuse(ev.ty)), 0.05, 60), ev.ty);
    return;
  }
  return _netEventInEq(e, ev);
};

const _botNadeTypeEq = botNadeType;
botNadeType = function () {
  const r = Math.random();
  if (r < 0.12) return 'semtex';
  if (r < 0.2) return 'stun';
  if (r < 0.26) return 'c4';
  return _botNadeTypeEq();
};

const _perkMoveMulEq = perkMoveMul;
perkMoveMul = function (ent) {
  let m = _perkMoveMulEq(ent);
  if (ent && ent.stunUntil > MATCH.time) m *= lerp(1, STUN.move, clamp(ent.stunK || 0, 0, 1));
  return m;
};
