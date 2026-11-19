/* ==========================================================================
   ATOUTS (deux par palier)
   Le 5.6 n'en a pas. Trois paliers, PERK_PER choix chacun, mémorisés sur la
   classe (pk). Les contreparties (Blindé, Pouvoir d'arrêt) sont fixes :
   rien ne les inverse. Pas de Supremo.
   ========================================================================== */
const PERK_PER = 2;
const PERKS = [
  { id: 'light', lv: 0, name: _t('Léger'), desc: _t('Vous courez 8 % plus vite.') },
  { id: 'sleight', lv: 0, name: _t('Prestidigitateur'), desc: _t('Le rechargement est 30 % plus court.') },
  { id: 'silence', lv: 0, name: _t('Silence mortel'), desc: _t('Vos pas s\u0027entendent beaucoup moins.') },
  { id: 'marathon', lv: 0, name: _t('Marathon'), desc: _t('Le sprint est plus rapide.') },
  { id: 'scav', lv: 1, name: _t('Charognard'), desc: _t('Une élimination rend des munitions.') },
  { id: 'armor', lv: 1, name: _t('Blindé'), desc: _t('20 % de dégâts de balle en moins. Vous êtes 6 % plus lent.') },
  { id: 'mask', lv: 1, name: _t('Masque tactique'), desc: _t('Les grenades incapacitantes vous touchent moins.') },
  { id: 'band', lv: 1, name: _t('Bandoulière'), desc: _t('Plus de munitions en réserve.') },
  { id: 'stop', lv: 2, name: _t('Pouvoir d\u0027arrêt'), desc: _t('12 % de dégâts de balle en plus. Le recul augmente de 10 %.') },
  { id: 'quick', lv: 2, name: _t('Dégainé rapide'), desc: _t('La visée et le changement d\u0027arme sont plus rapides.') },
  { id: 'steady', lv: 2, name: _t('Pouls ferme'), desc: _t('La dispersion à la hanche baisse de 30 %.') },
  { id: 'resist', lv: 2, name: _t('Résistant'), desc: _t('Immunisé contre l\u0027IEM et la contre-UAV.') },
  { id: 'stim', lv: 2, name: _t('Stimulant'), desc: _t('La santé revient plus vite.') },
];
const PERK_BY = {}; for (const p of PERKS) PERK_BY[p.id] = p;

function perkClean(c) {
  if (!c) return;
  const src = Array.isArray(c.pk) ? c.pk : [], pk = [[], [], []];
  for (let lv = 0; lv < 3; lv++) {
    const seen = new Set(), row = Array.isArray(src[lv]) ? src[lv] : [];
    for (const id of row) {
      const p = PERK_BY[id];
      if (!p || p.lv !== lv || seen.has(id) || pk[lv].length >= PERK_PER) continue;
      seen.add(id); pk[lv].push(id);
    }
  }
  c.pk = pk;
}
function perkRows(ent) {
  if (!ent) return null;
  if (ent.isPlayer) {
    const i = (typeof PL !== 'undefined' && PL.classIdx != null) ? PL.classIdx : (typeof Settings !== 'undefined' ? Settings.loadout : 0);
    const c = (typeof CLASSES !== 'undefined') ? CLASSES[i] : null;
    if (c && !c.pk) perkClean(c);
    return c ? c.pk : null;
  }
  if (!ent.pk) ent.pk = perkDraw();
  return ent.pk;
}
function perkHas(ent, id) {
  const pk = perkRows(ent); if (!pk) return false;
  for (const row of pk) if (row && row.indexOf(id) >= 0) return true;
  return false;
}
/* Tirage des bots : un ou deux atouts par palier, dans le catalogue de ce palier. */
function perkDraw() {
  const pk = [[], [], []];
  for (let lv = 0; lv < 3; lv++) {
    const pool = PERKS.filter((p) => p.lv === lv).map((p) => p.id);
    const n = 1 + (Math.random() < 0.7 ? 1 : 0);
    for (let i = 0; i < n && pool.length; i++) pk[lv].push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  }
  return pk;
}
function perkToggle(c, id) {
  const p = PERK_BY[id]; if (!p || !c) return _t('Cet atout n\u0027existe pas.');
  perkClean(c);
  const row = c.pk[p.lv], i = row.indexOf(id);
  if (i >= 0) { row.splice(i, 1); return ''; }
  if (row.length >= PERK_PER) return _t('Deux atouts par niveau. Retirez-en un.');
  row.push(id); return '';
}
function perkCount(c) { perkClean(c); let n = 0; for (const row of c.pk) n += row.length; return n; }

function perkMoveMul(ent) {
  let m = 1;
  if (perkHas(ent, 'light')) m *= 1.08;
  if (perkHas(ent, 'armor')) m *= 0.94; // contrepartie fixe
  return m;
}
function perkSprintMul(ent) { return perkHas(ent, 'marathon') ? 1.1 : 1; }
function perkAdsTime(ent) { return perkHas(ent, 'quick') ? 0.65 : 1; }
function perkSwitchMul(ent) { return perkHas(ent, 'quick') ? 0.62 : 1; }
function perkHipMul(ent) { return perkHas(ent, 'steady') ? 0.7 : 1; }
function perkRecoilMul(ent) { return perkHas(ent, 'stop') ? 1.1 : 1; } // contrepartie fixe
function perkStunMul(ent) { return perkHas(ent, 'mask') ? 0.45 : 1; }
function perkRegenDelay(ent, bot) { return perkHas(ent, 'stim') ? (bot ? 2.6 : 2.2) : (bot ? 5 : 4.5); }
function perkRegenRate(ent, bot) { return perkHas(ent, 'stim') ? (bot ? 52 : 78) : (bot ? 30 : 45); }
function perkJam(ent) {
  if (!ent || typeof ksJammed !== 'function') return false;
  if (perkHas(ent, 'resist')) return false;
  return ksJammed(ent.team);
}
function perkIsBullet(weapon) {
  if (typeof weapon !== 'string' || typeof WEAPONS === 'undefined') return false;
  for (const id in WEAPONS) if (WEAPONS[id].name === weapon) return true;
  return false;
}
function perkScaleBullet(victim, dmg, attacker, weapon) {
  if (!perkIsBullet(weapon)) return dmg;
  let d = dmg;
  if (attacker && !attacker.isRemote && perkHas(attacker, 'stop')) d *= 1.12;
  if (victim && !victim.isRemote && perkHas(victim, 'armor')) d *= 0.8;
  return d;
}
function perkFillReserve(ent) {
  if (!ent || !ent.arms || !perkHas(ent, 'band')) return;
  for (const s of ent.arms.slots) {
    if (!s || s.band) continue;
    s.reserve = Math.round(s.reserve * 1.5); s.band = 1;
  }
}
function perkScavenge(a) {
  if (!a || a.isRemote || !perkHas(a, 'scav') || !a.arms || typeof armsW !== 'function') return;
  const w = armsW(a); if (!w || !w.def) return;
  const mul = a.isPlayer ? 1 : 60;
  const cap = Math.round(w.def.reserve * mul * (perkHas(a, 'band') ? 1.5 : 1));
  w.reserve = Math.min(cap, w.reserve + Math.max(1, Math.round(w.def.mag * 0.5)));
}

/* Les fonctions visées sont déclarées plus loin : on les enveloppe après tout le script. */
setTimeout(() => {
  if (typeof applyDamage === 'function' && !applyDamage._perk) {
    const prev = applyDamage;
    applyDamage = function (victim, dmg, attacker, weapon, head, dir, srcPos, life) {
      return prev(victim, perkScaleBullet(victim, dmg, attacker, weapon), attacker, weapon, head, dir, srcPos, life);
    };
    applyDamage._perk = 1;
  }
  if (typeof killEnt === 'function' && !killEnt._perk) {
    const prev = killEnt;
    killEnt = function (v, a, weapon, head, dir, life) {
      const r = prev(v, a, weapon, head, dir, life);
      if (a && a !== v) perkScavenge(a);
      return r;
    };
    killEnt._perk = 1;
  }
  if (typeof flashBang === 'function' && !flashBang._perk) {
    const prev = flashBang;
    flashBang = function (p, owner) {
      prev(p, owner);
      const pm = perkStunMul(PL.ent);
      if (pm < 1 && PL.flashT > 0) { PL.flashT *= pm; PL.flashD *= pm; PL.flashI = Math.min(PL.flashI || 0, 0.35 + 0.4 * pm); }
      if (typeof entities !== 'undefined') for (const b of entities) {
        if (!b || b.isPlayer || !b.alive) continue;
        const m = perkStunMul(b);
        if (m < 1 && b.blindT > MATCH.time) b.blindT = MATCH.time + (b.blindT - MATCH.time) * m;
      }
    };
    flashBang._perk = 1;
  }
  if (typeof partyAfterLoadout === 'function' && !partyAfterLoadout._perk) {
    const prev = partyAfterLoadout;
    partyAfterLoadout = function () { const r = prev(); perkFillReserve(PL.ent); return r; };
    partyAfterLoadout._perk = 1;
  }
  if (typeof partyPrepareBot === 'function' && !partyPrepareBot._perk) {
    const prev = partyPrepareBot;
    partyPrepareBot = function (e) { const r = prev(e); perkFillReserve(e); return r; };
    partyPrepareBot._perk = 1;
  }
}, 0);
