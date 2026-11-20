/* ==========================================================================
   PERSONNALITÉS DES BOTS
   Un profil fixe par nom (armes, atouts, séries, allure). Un nom inconnu
   reste Équilibré. Les identifiants absents du 5.6 (arme, atout, série,
   grenade) sont ignorés : rien de Supremo, rien d'une autre version.
   b.pers garde slide et scan, ceux que le reste du jeu lit déjà.
   ========================================================================== */
const PERS_DEFAULT = 'equil';
const PERS_TAB = {
  assaut: {
    id: 'assaut', short: _t('Assaut'),
    arms: { smg: 0.62, shotgun: 0.38 },
    armW: { mp5: 2, mp7: 2, ump45: 1.6, vector: 2, m1014: 2, rem870: 1.5, aa12: 1.2 },
    aggr: 1.45, ideal: 0.72, cover: 0.45, flank: 0.7, push: 1.45, slide: 1.35, scan: 0.65, hear: 0.9, obj: 0.8,
    lane: 'mid', perkN: [2, 1, 1], perkLock: ['light', 'marathon'],
    perkW: { light: 6, marathon: 5, sleight: 2, quick: 4, stim: 3, over: 2, scav: 1, steady: 1 },
    ksW: { fpv: 5, air: 4, uav: 2, heli: 1, mecha: 1.2, iem: 0.4, sat: 0.6 },
    nade: { frag: 0.55, flash: 0.35, smoke: 0.1 },
  },
  franco: {
    id: 'franco', short: _t('Tireur'),
    forceSniper: true, arms: { sniper: 1 },
    armW: { l96: 3, svd: 2, m82: 1.2 },
    aggr: 0.5, ideal: 1.4, cover: 2, flank: 0.3, push: 0.4, slide: 0.4, scan: 1.35, hear: 1.15, obj: 0.5,
    lane: 'side', perkN: [1, 1, 2], perkLock: ['steady'],
    perkW: { steady: 6, silence: 4, mask: 2, armor: 1, stop: 2, band: 1, light: 0.3, marathon: 0.2 },
    ksW: { uav: 5, sat: 4, iem: 2, heli: 0.5, air: 0.4, mecha: 0.3, fpv: 0.2 },
    nade: { smoke: 0.7, frag: 0.3 },
  },
  tactique: {
    id: 'tactique', short: _t('Tactique'),
    arms: { ar: 0.88, smg: 0.12 },
    armW: { m4: 3, ak47: 2, scarh: 1.6, famas: 1.3, mp5: 1 },
    aggr: 0.95, ideal: 1, cover: 1.15, flank: 1, push: 0.9, slide: 0.9, scan: 1.05, hear: 1, obj: 1.5,
    lane: null, perkN: [1, 2, 1], perkLock: ['armor'],
    perkW: { armor: 5, scav: 3, mask: 2, band: 2, stop: 2, steady: 2, quick: 1, over: 1.5 },
    ksLock: ['uav'], ksW: { uav: 6, air: 4, sat: 3, iem: 2, heli: 1, mecha: 0.8, fpv: 0.5 },
    nade: { frag: 0.6, smoke: 0.25, flash: 0.15 },
  },
  appui: {
    id: 'appui', short: _t('Appui'),
    arms: { ar: 1 },
    armW: { scarh: 4, m4: 2, ak47: 1.4, famas: 0.6 },
    aggr: 0.75, ideal: 1.1, cover: 1.5, flank: 0.45, push: 0.6, slide: 0.6, scan: 0.95, hear: 1, obj: 1.2,
    lane: 'mid', perkN: [1, 2, 1], perkLock: ['armor', 'scav'],
    perkW: { armor: 5, scav: 5, band: 3, mask: 2, steady: 2, sleight: 1, stim: 1 },
    ksLock: ['heli'], ksW: { heli: 6, uav: 3, sat: 2, air: 1.5, mecha: 2, iem: 1, fpv: 0.4 },
    nade: { smoke: 0.45, frag: 0.4, flash: 0.15 },
  },
  furtif: {
    id: 'furtif', short: _t('Furtif'),
    arms: { smg: 0.78, shotgun: 0.22 },
    armW: { mp7: 3, mp5: 2, ump45: 2, vector: 1.2, m1014: 0.8 },
    aggr: 1.05, ideal: 0.85, cover: 0.9, flank: 1.8, push: 0.85, slide: 1.15, scan: 1.2, hear: 1.4, obj: 0.85,
    lane: 'side', perkN: [2, 1, 1], perkLock: ['silence'],
    perkW: { silence: 6, light: 3, marathon: 2, quick: 2, steady: 1.5, stim: 1, over: 1 },
    ksW: { iem: 5, uav: 3, sat: 2, fpv: 1.2, air: 0.4, heli: 0.3, mecha: 0.2 },
    nade: { flash: 0.55, frag: 0.25, smoke: 0.2 },
  },
  equil: {
    id: 'equil', short: _t('Équilibré'),
    arms: null, aggr: 1, ideal: 1, cover: 1, flank: 1, push: 1, slide: 1, scan: 1, hear: 1, obj: 1,
    lane: null, perkN: [1, 1, 1], perkLock: null, perkW: null, ksW: null, nade: null,
    armW: { m4: 1.6, ak47: 1.4, scarh: 1.5, famas: 1.2, mp5: 1.2, mp7: 1 },
  },
};
const PERS_BY_NAME = {
  Dubois: 'assaut', Keller: 'franco', Marchetti: 'tactique', Okafor: 'appui', Novak: 'furtif', Morel: 'equil', Bianchi: 'assaut',
  Volkov: 'assaut', Rahim: 'franco', Karimov: 'tactique', Drago: 'appui', Sokol: 'furtif', Petrenko: 'equil', Hassan: 'furtif', Berg: 'equil',
};

function persByName(name) {
  const id = (name && PERS_BY_NAME[name]) || PERS_DEFAULT;
  return PERS_TAB[id] || PERS_TAB[PERS_DEFAULT];
}
function persOf(b) {
  if (!b || b.isPlayer) return PERS_TAB[PERS_DEFAULT];
  if (!b.pProf) b.pProf = persByName(b.name);
  return b.pProf;
}
function persBind(b) {
  if (!b || b.isPlayer) return;
  b.pProf = persByName(b.name);
}
function persListTag(name) {
  const p = persByName(name);
  return p && p.short ? [p.short] : [];
}
/* Tirage stable : le même nom retrouve le même tempérament d'une partie à l'autre. */
function persRand(name) {
  let h = 2166136261;
  const s = String(name || '');
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return mulberry32(h >>> 0);
}
function persWeighted(list, wfn) {
  let tot = 0;
  for (const id of list) tot += Math.max(0, +wfn(id) || 0);
  if (!(tot > 0)) return null;
  let r = Math.random() * tot;
  for (const id of list) {
    const w = Math.max(0, +wfn(id) || 0);
    if (!(w > 0)) continue;
    r -= w;
    if (r <= 0) return id;
  }
  return null;
}
function persTemper(name, p) {
  const rng = persRand(name);
  return {
    slide: clamp(0.45 * (p.slide || 1) + (rng() - 0.5) * 0.08, 0, 1),
    scan: clamp(0.55 * (p.scan || 1) + (rng() - 0.5) * 0.08, 0.1, 1),
  };
}
function persPerkDraw(name) {
  const p = persByName(name), pk = [[], [], []];
  if (typeof PERKS === 'undefined' || typeof PERK_BY === 'undefined') return pk;
  const locks = ((p && p.perkLock) || []).filter((id) => PERK_BY[id]);
  for (const id of locks) {
    const lv = PERK_BY[id].lv, cap = Math.min(PERK_PER, (p.perkN && p.perkN[lv]) || 1);
    if (pk[lv].length < cap && pk[lv].indexOf(id) < 0) pk[lv].push(id);
  }
  for (let lv = 0; lv < 3; lv++) {
    const cap = Math.min(PERK_PER, (p.perkN && p.perkN[lv]) || 1);
    const pool = PERKS.filter((x) => x.lv === lv && pk[lv].indexOf(x.id) < 0).map((x) => x.id);
    while (pk[lv].length < cap && pool.length) {
      const id = persWeighted(pool, (x) => {
        if (p.perkW && p.perkW[x] === 0) return 0;
        return (p.perkW && p.perkW[x] != null) ? p.perkW[x] : 1;
      });
      if (!id) break;
      pk[lv].push(id);
      pool.splice(pool.indexOf(id), 1);
    }
  }
  return pk;
}
function persKs(b) {
  const p = persOf(b), picked = [];
  if (typeof KSDEF === 'undefined') return [];
  const lock = ((p && p.ksLock) || []).filter((id) => KSDEF[id]);
  for (const id of lock) {
    if (picked.length >= KS_SLOTS) break;
    if (picked.indexOf(id) < 0 && !picked.some((y) => KSDEF[y].n === KSDEF[id].n)) picked.push(id);
  }
  const left = KS_IDS.filter((id) => picked.indexOf(id) < 0 && (!p.ksW || (p.ksW[id] || 0) > 0));
  while (picked.length < KS_SLOTS && left.length) {
    const id = persWeighted(left, (x) => {
      if (picked.some((y) => KSDEF[y].n === KSDEF[x].n)) return 0;
      return (p.ksW && p.ksW[x] != null) ? p.ksW[x] : 1;
    });
    if (!id) break;
    picked.push(id);
    left.splice(left.indexOf(id), 1);
  }
  return ksSort(ksPick(picked.concat(KS_DEFAULT)));
}
function persNade(e) {
  const p = persOf(e);
  if (!p || !p.nade || typeof NADE_TYPES === 'undefined') return null;
  const ids = Object.keys(p.nade).filter((id) => NADE_TYPES[id] && p.nade[id] > 0);
  return persWeighted(ids, (id) => p.nade[id]);
}
function persArmList(cat, armW) {
  const ids = [];
  for (const id in WEAPONS) {
    const w = WEAPONS[id];
    if (!w || w.cat !== cat || w.cat === 'pistol') continue;
    ids.push(id);
  }
  if (!armW) return ids;
  const pref = ids.filter((id) => armW[id] > 0);
  return pref.length ? pref : ids;
}
function persArmId(b, sn, maxSn) {
  const p = persOf(b);
  if (!p) return null;
  const room = sn[b.team] < maxSn;
  let cat = null;
  if (p.forceSniper && room) cat = 'sniper';
  else if (p.arms) cat = botPickCat(p.arms, !room || !p.forceSniper);
  if (!cat) return null;
  let list = persArmList(cat, p.armW);
  if (!list.length) list = persArmList('ar', null);
  const wid = persWeighted(list, (id) => (p.armW && p.armW[id]) || 1);
  return wid && WEAPONS[wid] ? wid : null;
}

const persMake0 = makeBot;
makeBot = function (team, idx) {
  const b = persMake0(team, idx);
  if (!b || b.isPlayer) return b;
  persBind(b);
  b.pers = persTemper(b.name, b.pProf);
  if (typeof persPerkDraw === 'function') b.pk = persPerkDraw(b.name);
  b.ks = persKs(b);
  return b;
};

const persInit0 = initTactics;
initTactics = function (b) {
  persBind(b);
  const kept = b.pers;
  persInit0(b);
  const p = b.pProf;
  if (!p) return;
  if (kept) b.pers = kept;
  b.aggr = clamp(b.aggr * (p.aggr || 1), 0.05, 0.95);
  b.persIdeal = p.ideal || 1;
  b.persCover = p.cover || 1;
  b.persFlank = p.flank || 1;
  b.persPush = p.push || 1;
  if (p.lane === 'side') b.lane = persRand(b.name)() < 0.5 ? 'L' : 'E';
  else if (p.lane === 'mid') b.lane = 'M';
};

const persArm0 = botArmForMap;
botArmForMap = function () {
  persArm0();
  const type = CURMAP.def && BOT_WEAPON_MIX[CURMAP.def.type] ? CURMAP.def.type : 'mid';
  const maxSn = type === 'open' ? 2 : 1, sn = [0, 0];
  for (const b of entities) {
    if (!b || b.isPlayer || b.isRemote) continue;
    persBind(b);
    const wid = persArmId(b, sn, maxSn);
    if (!wid || !WEAPONS[wid]) continue;
    if (WEAPONS[wid].ai && WEAPONS[wid].ai.sniper) sn[b.team]++;
    const def = WEAPONS[wid];
    if (b.weapon !== def) { b.weapon = def; b.mag = def.mag; if (b.model) setSoldierGun(b.model, def.key); }
    b.skin = skinOfWeapon(def); if (b.model) soldierLook(b.model, b.skin, skinRel(b));
  }
};

const persSpawn0 = spawnEntity;
spawnEntity = function (e) {
  persSpawn0(e);
  if (!e || e.isPlayer || e.isRemote) return;
  const n = persNade(e);
  if (n) e.nadeType = n;
};

const persEars0 = botEars;
botEars = function (b, e, d, aw, dt, now, D) {
  const hear = b && b.pProf && b.pProf.hear;
  if (hear && hear > 0 && hear !== 1) d = d / hear;
  return persEars0(b, e, d, aw, dt, now, D);
};

const persSquad0 = squadGoal;
squadGoal = function (b, now) {
  const g = persSquad0(b, now);
  if (g && b && b.pProf && b.pProf.obj) g.holdFor = (g.holdFor || 4) * b.pProf.obj;
  return g;
};
