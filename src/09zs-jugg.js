/* Racha Juggernaut: armadura pesada hasta morir. El campo opcional `jg` va en la presencia; una build original lo ignora. */
const JUGG = { cost: 15, bullet: 0.25, boom: 0.45, move: 0.75, gun: null, geo: null, mat: null, boxes: [] };

KSDEF.jugg = {
  n: JUGG.cost,
  name: _t('Juggernaut'),
  short: _t('Jugger'),
  icon: '<path d="M12 3.2l6.2 2.2v4.4c0 4.4-2.6 7.4-6.2 9-3.6-1.6-6.2-4.6-6.2-9V5.4z"/><path d="M9 9.2h6v3.4H9z"/>',
  desc: _t('Une caisse vous tombe dessus. Jusqu\u0027à votre mort, vous encaissez un quart des dégâts de balle, les explosions un peu plus, vous avancez à 75 % et vous ne sprintez plus. Vous portez un fusil à grand chargeur. Les ennemis vous voient sur la carte.'),
  use: () => juggUse(PL.ent),
  bot: (b) => juggUse(b)
};
if (!KS_IDS.includes('jugg')) KS_IDS.push('jugg');
STREAK.jugg = JUGG.cost;

function juggGunDef() {
  if (JUGG.gun) return JUGG.gun;
  const base = (typeof weaponDef === 'function' && weaponDef('m4', ['xmag'])) || WEAPONS.m4;
  JUGG.gun = base;
  return JUGG.gun;
}
function juggBoom(weapon) {
  if (!weapon || typeof NET_WSPECIAL === 'undefined') return false;
  const S = NET_WSPECIAL;
  if (weapon === S.nade || weapon === S.air || weapon === S.drone || weapon === S.art || weapon === S.bomb || weapon === S.veh || weapon === S.boom) return true;
  const w = typeof perkGunByName === 'function' ? perkGunByName(weapon) : null;
  return !!(w && (w.rocket || w.cat === 'launcher'));
}
function juggMul(e, weapon) {
  if (!e || !e.jugg) return 1;
  return juggBoom(weapon) ? JUGG.boom : JUGG.bullet;
}
function juggLook(e, on) {
  const L = e && e.model && e.model.lod;
  if (!L) return;
  for (const k of ['hi', 'lo']) {
    const m = L[k];
    if (!m) continue;
    if (on) {
      m.scale.set(1.22, 1.16, 1.22);
      if (m.material && !m.userData.juggMat) {
        const c = m.material.clone();
        if (c.color) c.color.multiplyScalar(0.72);
        m.userData.juggBase = m.material;
        m.userData.juggMat = c;
      }
      if (m.userData.juggMat) m.material = m.userData.juggMat;
    } else {
      m.scale.set(1, 1, 1);
      if (m.userData.juggBase) m.material = m.userData.juggBase;
    }
  }
}
function juggClearCrates() {
  for (const b of JUGG.boxes) if (b.m && b.m.parent) b.m.parent.remove(b.m);
  JUGG.boxes.length = 0;
}
function juggCrate(e) {
  if (!e || typeof THREE === 'undefined' || typeof scene === 'undefined') return;
  if (!JUGG.geo) JUGG.geo = new THREE.BoxGeometry(0.7, 0.45, 0.7);
  if (!JUGG.mat) JUGG.mat = new THREE.MeshStandardMaterial({ color: 0x6b5a32, roughness: 0.82, metalness: 0.08 });
  const m = new THREE.Mesh(JUGG.geo, JUGG.mat);
  m.position.set(e.pos.x, e.pos.y + 6, e.pos.z);
  m.castShadow = true;
  if (m.userData) m.userData.noAO = true;
  scene.add(m);
  JUGG.boxes.push({ m, e, t: 0, y0: e.pos.y });
}
function juggCrateTick(dt) {
  for (let i = JUGG.boxes.length - 1; i >= 0; i--) {
    const b = JUGG.boxes[i];
    b.t += dt;
    const y = b.y0 + Math.max(0, 6 - b.t * 12);
    b.m.position.y = y + 0.3;
    b.m.rotation.y += dt * 1.2;
    if (b.t >= 0.55) {
      if (b.m.parent) b.m.parent.remove(b.m);
      JUGG.boxes.splice(i, 1);
      juggArm(b.e);
    }
  }
}
function juggArm(e) {
  if (!e || !e.alive) return;
  e.jugg = true;
  e.health = Math.max(e.health, 100);
  const A = e.arms, def = juggGunDef();
  if (A && A.slots && A.slots[0]) {
    e._jgGun = A.slots[0].def;
    A.slots[0] = { def, mag: def.mag || 40, reserve: def.reserve || 120 };
    A.cur = 0; A.reload = null;
    if (e.isPlayer && typeof vmEquip === 'function') vmEquip(def);
    if (e.model && typeof setSoldierGun === 'function') { try { setSoldierGun(e.model, def.key || def.model || 'm4'); } catch (err) {} }
  }
  juggLook(e, true);
  if (typeof hudMsg === 'function' && e.isPlayer) hudMsg(_t('Armure lourde'), 2.2);
}
function juggOff(e) {
  if (!e || !e.jugg) return;
  e.jugg = false;
  juggLook(e, false);
  const A = e.arms;
  if (A && A.slots && A.slots[0] && e._jgGun) {
    A.slots[0] = { def: e._jgGun, mag: e._jgGun.mag, reserve: e._jgGun.reserve };
    e._jgGun = null;
  }
}
function juggUse(e) {
  if (!e || !e.alive) return;
  if (e === PL.ent && PL.ks) PL.ks.jugg = false;
  if (typeof updateStreakHud === 'function' && e.isPlayer) updateStreakHud();
  juggCrate(e);
  if (typeof netEvent === 'function' && (e === PL.ent || e.netBot)) netEvent(e, { k: 'jg' });
}

const _jugg_dmg = applyDamage;
applyDamage = function (victim, dmg, attacker, weapon, head, dir, srcPos, life) {
  if (victim && victim.jugg) dmg *= juggMul(victim, weapon);
  return _jugg_dmg(victim, dmg, attacker, weapon, head, dir, srcPos, life);
};

const _jugg_move = perkMoveMul;
perkMoveMul = function (ent) {
  const m = _jugg_move(ent);
  return (ent && ent.jugg) ? m * JUGG.move : m;
};

const _jugg_kill = killEnt;
killEnt = function (v, a, weapon, head, dir, life) {
  if (v && v.jugg) juggOff(v);
  return _jugg_kill(v, a, weapon, head, dir, life);
};

const _jugg_start = startMatch;
startMatch = function (opt) {
  juggClearCrates();
  const r = _jugg_start(opt);
  for (const e of entities) if (e) { e.jugg = false; juggLook(e, false); }
  return r;
};

const _jugg_tick = matchTick;
matchTick = function (dt) {
  juggCrateTick(dt);
  for (const e of entities) if (e && e.jugg) e.sprinting = false;
  return _jugg_tick(dt);
};

const _jugg_pres = netPresence;
netPresence = function (e, now) {
  const p = _jugg_pres(e, now);
  if (p && e && e.jugg) p.jg = 1;
  return p;
};
const _jugg_apply = netApply;
netApply = function (id, P) {
  _jugg_apply(id, P);
  const e = NET.remotes.get(id);
  if (!e || !P) return;
  const on = !!P.jg;
  if (on !== !!e.jugg) { e.jugg = on; juggLook(e, on); }
};
const _jugg_ev = netEventIn;
netEventIn = function (e, ev) {
  if (ev && ev.k === 'jg') { juggCrate(e); return; }
  return _jugg_ev(e, ev);
};
