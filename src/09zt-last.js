/* Atout Dernier recours. Un golpe letal al cuerpo (no a la cabeza ni explosión) deja en el suelo. Sin Survie: el estado downed es propio. El campo opcional `dn` va en la presencia. */
PERKS.push({
  id: 'last', lv: 1,
  name: _t('Dernier recours'),
  desc: _t('Un tir au corps qui vous tuerait vous laisse 10 s au sol, au pistolet, à ramper. Un allié qui s\u0027approche et maintient utiliser pendant 2 s vous relève avec 50 de vie. Un tir à la tête ou une explosion vous tuent directement.')
});
PERK_BY.last = PERKS[PERKS.length - 1];

const LAST = { held: false, t: 0, mate: null, R: 2.6 };

function lastBoom(weapon) { return typeof juggBoom === 'function' && juggBoom(weapon); }
function lastFinalDmg(v, dmg, attacker, weapon) {
  let d = dmg;
  if (v && v.jugg && typeof juggMul === 'function') d *= juggMul(v, weapon);
  if (typeof partyAdjustDamage === 'function') d = partyAdjustDamage(v, d, attacker, weapon);
  return d;
}
function lastToPistol(e) {
  const A = e && e.arms;
  if (!A || !A.slots || !A.slots.length) return;
  if (e._lsSlot == null) e._lsSlot = A.cur || 0;
  let i = -1;
  for (let k = 0; k < A.slots.length; k++) if (A.slots[k].def && A.slots[k].def.cat === 'pistol') { i = k; break; }
  if (i < 0 && WEAPONS.m9) {
    const def = WEAPONS.m9;
    A.slots.push({ def, mag: def.mag, reserve: def.reserve });
    i = A.slots.length - 1;
    e._lsPushed = 1;
  }
  if (i < 0) return;
  A.cur = i; A.reload = null; A.knife = false; A.switching = 0; A.boltT = 0;
  const d = A.slots[i].def;
  if (e.isPlayer && typeof vmEquip === 'function') vmEquip(d);
  if (e.model && typeof setSoldierGun === 'function') { try { setSoldierGun(e.model, d.key || d.model); } catch (err) {} }
}
function lastRestoreGun(e) {
  const A = e && e.arms;
  if (!A || !A.slots) return;
  if (e._lsPushed) {
    const i = A.slots.findIndex((s) => s.def && s.def.cat === 'pistol');
    if (i >= 0) A.slots.splice(i, 1);
    e._lsPushed = 0;
  }
  if (e._lsSlot != null) {
    A.cur = Math.max(0, Math.min(A.slots.length - 1, e._lsSlot));
    e._lsSlot = null;
  }
  const d = A.slots[A.cur] && A.slots[A.cur].def;
  if (!d) return;
  if (e.isPlayer && typeof vmEquip === 'function') vmEquip(d);
  if (e.model && typeof setSoldierGun === 'function') { try { setSoldierGun(e.model, d.key || d.model); } catch (err) {} }
}
function lastDown(v, attacker, weapon) {
  if (!v || !v.alive || v.downed) return;
  v.health = 1;
  v.downed = true;
  v.downT = 10;
  v.downBy = attacker || null;
  v.downWpn = weapon || 'M9';
  v.crouch = true;
  lastToPistol(v);
  if (v.isPlayer && typeof hudMsg === 'function') hudMsg(_t('À terre') + '. ' + _t('Un allié peut vous relever'), 3);
  if (typeof netEvent === 'function' && (v === PL.ent || v.netBot)) netEvent(v, { k: 'dn', a: attacker && attacker.netId, w: weapon });
}
function lastUp(v) {
  if (!v || !v.downed) return;
  v.downed = false;
  v.downT = 0;
  v.downBy = null;
  v.health = 50;
  v.crouch = false;
  lastRestoreGun(v);
  if (v.isPlayer && typeof hudMsg === 'function') hudMsg(_t('Relevé'), 1.6);
  if (typeof netEvent === 'function' && (v === PL.ent || v.netBot)) netEvent(v, { k: 'up' });
}
function lastExpire(v) {
  if (!v || !v.downed) return;
  const a = v.downBy, w = v.downWpn;
  v.downed = false;
  v.health = 0;
  if (typeof killEnt === 'function') killEnt(v, a, w, false, new V3(0, 0, -1));
}
function lastNearMate(e) {
  if (!e || !e.alive || e.downed) return null;
  let best = null, bd = LAST.R;
  for (const o of entities) {
    if (!o || o === e || !o.alive || !o.downed || typeof allied !== 'function' || !allied(e, o)) continue;
    const d = hyp(e.pos.x - o.pos.x, e.pos.z - o.pos.z);
    if (d < bd && Math.abs(e.pos.y - o.pos.y) < 1.2) { bd = d; best = o; }
  }
  return best;
}
function lastTick(dt) {
  for (const e of entities) {
    if (!e || !e.downed) continue;
    e.downT = (e.downT || 0) - dt;
    e.crouch = true;
    e.sprinting = false;
    if (e.downT <= 0) lastExpire(e);
  }
  const me = PL && PL.ent;
  if (!me || !me.alive) { LAST.held = false; LAST.t = 0; LAST.mate = null; return; }
  if (me.downed) { LAST.held = false; LAST.t = 0; LAST.mate = null; return; }
  const mate = lastNearMate(me);
  LAST.mate = mate;
  const use = !!(typeof KEYS !== 'undefined' && (KEYS[bindOf ? bindOf('use') : 'KeyE'] || KEYS.KeyE));
  if (mate && use) {
    LAST.t += dt;
    if (typeof hudMsg === 'function') hudMsg(_t('Relevez l\u0027allié ({0})', Math.max(0, (2 - LAST.t)).toFixed(1)), 0.2);
    if (LAST.t >= 2) { lastUp(mate); LAST.t = 0; }
  } else LAST.t = 0;
  if (!me.isPlayer) return;
  for (const b of entities) {
    if (!b || b.isPlayer || b.isRemote || !b.alive || b.downed) continue;
    const m = lastNearMate(b);
    if (m) { b._lsHelp = (b._lsHelp || 0) + dt; if (b._lsHelp >= 2) { lastUp(m); b._lsHelp = 0; } }
    else b._lsHelp = 0;
  }
}

const _last_dmg = applyDamage;
applyDamage = function (victim, dmg, attacker, weapon, head, dir, srcPos, life) {
  if (victim && victim.alive && !victim.downed && typeof perkHas === 'function' && perkHas(victim, 'last') && !head && !lastBoom(weapon)) {
    const d = lastFinalDmg(victim, dmg, attacker, weapon);
    if (victim.health - d <= 0) { lastDown(victim, attacker, weapon); return; }
  }
  if (victim && victim.downed) {
    if (head || lastBoom(weapon)) return _last_dmg(victim, Math.max(dmg, 999), attacker, weapon, head, dir, srcPos, life);
    return;
  }
  return _last_dmg(victim, dmg, attacker, weapon, head, dir, srcPos, life);
};

const _last_move = perkMoveMul;
perkMoveMul = function (ent) {
  const m = _last_move(ent);
  return (ent && ent.downed) ? m * 0.3 : m;
};

const _last_start = startMatch;
startMatch = function (opt) {
  const r = _last_start(opt);
  LAST.t = 0; LAST.mate = null;
  for (const e of entities) if (e) { e.downed = false; e.downT = 0; e.downBy = null; e._lsSlot = null; e._lsPushed = 0; }
  return r;
};

function lastHeldDown(e) { return !!(e && e.downed); }
function lastKeepPistol(e) {
  if (!lastHeldDown(e) || !e.arms || !e.arms.slots) return;
  const i = e.arms.slots.findIndex((s) => s.def && s.def.cat === 'pistol');
  if (i < 0 || e.arms.cur === i) return;
  lastToPistol(e);
}
const _last_swapWithDrop = swapWithDrop;
swapWithDrop = function () {
  if (lastHeldDown(PL.ent) || lastNearMate(PL.ent)) return;
  return _last_swapWithDrop();
};
const _last_ctlSwitch = ctlSwitch;
ctlSwitch = function (ent, i, again) {
  if (lastHeldDown(ent)) return false;
  return _last_ctlSwitch(ent, i, again);
};
const _last_switchWeapon = switchWeapon;
switchWeapon = function (i) {
  if (lastHeldDown(PL.ent)) return;
  return _last_switchWeapon(i);
};
const _last_quickSwap = quickSwap;
quickSwap = function () {
  if (lastHeldDown(PL.ent)) return;
  return _last_quickSwap();
};
const _last_knife = knife;
knife = function () {
  if (lastHeldDown(PL.ent)) return;
  return _last_knife();
};
const _last_knifeDraw = knifeDraw;
knifeDraw = function () {
  if (lastHeldDown(PL.ent)) return false;
  return _last_knifeDraw();
};
const _last_tick = matchTick;
matchTick = function (dt) {
  lastTick(dt);
  if (typeof PL !== 'undefined' && PL.ent) lastKeepPistol(PL.ent);
  return _last_tick(dt);
};

const _last_pres = netPresence;
netPresence = function (e, now) {
  const p = _last_pres(e, now);
  if (p && e && e.downed) { p.dn = 1; p.dnt = Math.round((e.downT || 0) * 10) / 10; }
  return p;
};
const _last_apply = netApply;
netApply = function (id, P) {
  _last_apply(id, P);
  const e = NET.remotes.get(id);
  if (!e || !P) return;
  if ('dn' in P) {
    if (P.dn && !e.downed) lastDown(e, null, e.downWpn);
    if (!P.dn && e.downed) lastUp(e);
    if (P.dnt != null) e.downT = P.dnt;
  }
};
const _last_ev = netEventIn;
netEventIn = function (e, ev) {
  if (ev && ev.k === 'dn') { lastDown(e, null, ev.w); return; }
  if (ev && ev.k === 'up') { lastUp(e); return; }
  return _last_ev(e, ev);
};
