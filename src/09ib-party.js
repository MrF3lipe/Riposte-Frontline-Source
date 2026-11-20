/* ==========================================================================
   PARTIE : mutateurs, course aux armes, coop contre les bots, infectés, aide LAN
   Les réglages passent par Settings (solo) et NET.cfg (l'hôte les publie via netCfg).
   Les fonctions déjà définies plus haut sont enveloppées ici (ce fichier vient après
   09i-modes.js, 09-game.js, 09c-net.js, 09e-menus.js).
   ========================================================================== */

const PARTY_MUT_KEYS = ['mutHard', 'mutPistol', 'mutKnife', 'mutInsta', 'mutRand', 'mutFF'];
const PARTY_PISTOLS = ['m9', 'usp', 'glock18', 'deagle'];
const GG_CLASSIC = ['m4', 'ak47', 'scarh', 'famas', 'mp5', 'mp7', 'ump45', 'vector', 'm1014', 'rem870', 'aa12', 'l96', 'svd', 'm82', 'm9', 'usp', 'glock18', 'deagle'];
const GG_GUNS = GG_CLASSIC.slice();
const GG_ORDERS = ['mix', 'rand', 'classic'];
if (Settings.ggOrder === undefined) Settings.ggOrder = 'mix';

function ggCat(id) { return (WEAPONS[id] && WEAPONS[id].cat) || 'ar'; }
function ggEase(id) {
  const d = WEAPONS[id]; if (!d) return 0;
  const pellets = d.pellets || 1, dmg = (d.dmg && d.dmg[0]) || 20, rpm = d.rpm || 400;
  const ttk = Math.max(0.05, (100 / Math.max(1, pellets * dmg)) * (60 / rpm));
  return 1 / ttk;
}
function ggShuffle(list) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; }
  return a;
}
function ggBuildMixed(pool) {
  const pist = pool.filter((id) => ggCat(id) === 'pistol');
  const left = pool.filter((id) => ggCat(id) !== 'pistol').sort((a, b) => ggEase(b) - ggEase(a));
  const out = [];
  while (left.length) {
    let i = 0;
    if (out.length) {
      const prev = ggCat(out[out.length - 1]);
      const hit = left.findIndex((id) => ggCat(id) !== prev);
      if (hit >= 0) i = hit;
    }
    out.push(left.splice(i, 1)[0]);
  }
  return out.concat(pist);
}
function ggListOk(list) {
  return Array.isArray(list) && list.length === GG_CLASSIC.length && list.every((id) => GG_CLASSIC.indexOf(id) >= 0);
}
function ggRebuild(src) {
  src = src || (typeof partySrc === 'function' ? partySrc() : Settings);
  const o = (src && GG_ORDERS.indexOf(src.ggOrder) >= 0) ? src.ggOrder : 'mix';
  let list;
  if (ggListOk(src && src.ggGuns) && (o === 'rand' || o === 'mix')) list = src.ggGuns.slice();
  else if (o === 'classic') list = GG_CLASSIC.slice();
  else if (o === 'rand') list = ggShuffle(GG_CLASSIC);
  else list = ggBuildMixed(GG_CLASSIC);
  GG_GUNS.length = 0; for (const id of list) GG_GUNS.push(id);
  return GG_GUNS;
}
const PARTY_COOP_N = [4, 6, 8, 10, 12];
const PARTY_HC_HP = 30;
const PARTY_INF_SPEED = 1.12;

if (Settings.mutHard === undefined) Settings.mutHard = 0;
if (Settings.mutPistol === undefined) Settings.mutPistol = 0;
if (Settings.mutKnife === undefined) Settings.mutKnife = 0;
if (Settings.mutInsta === undefined) Settings.mutInsta = 0;
if (Settings.mutRand === undefined) Settings.mutRand = 0;
if (Settings.mutFF === undefined) Settings.mutFF = 0;
if (Settings.coopN === undefined) Settings.coopN = 6;
if (Settings.limitCoop === undefined) Settings.limitCoop = 50;
if (Settings.limitInf === undefined) Settings.limitInf = 1;
const party = { _ff: false };

MODES.gun = {
  name: _t('Course aux armes'), btn: _t('Course aux armes'), sub: _t('Chaque élimination change votre arme. La dernière est le couteau.'),
  teams: _t('Chacun pour soi, vous et 15 bots (16 joueurs)'), lim: _t('Limite d\u0027éliminations'), unit: _t('éliminations'),
  limits: [10, 20, 30, 50], key: 'limitFfa', respawn: 3, botRespawn: 3.5, prot: 2,
  hint: _t('Personne n\u0027est votre allié. Chaque élimination vous donne l\u0027arme suivante. Le premier qui tue au couteau l\u0027emporte.')
};
MODES.coop = {
  name: _t('Coop contre les bots'), btn: _t('Coop'), sub: _t('Vous et vos amis dans le même camp, contre une vague de bots.'),
  teams: _t('Vous contre les bots'), lim: _t('Limite d\u0027éliminations'), unit: _t('éliminations'),
  limits: [20, 30, 50, 75], key: 'limitCoop', respawn: 4, botRespawn: 5.5, prot: 2,
  hint: _t('Vous et vos alliés contre les bots. Le premier camp à la limite d\u0027éliminations l\u0027emporte.')
};
MODES.inf = {
  name: _t('Infectés'), btn: _t('Infectés'), sub: _t('Un infecté au couteau. Les morts le rejoignent.'),
  teams: _t('Survivants contre infectés'), lim: _t('Durée maximale'), unit: _t('min'),
  limits: [1], key: 'limitInf', respawn: 3, botRespawn: 3, prot: 1.5,
  hint: _t('Un soldat commence infecté (couteau, plus rapide). Un survivant tué réapparaît infecté. S\u0027il ne reste plus de survivants, les infectés l\u0027emportent. Si le temps s\u0027achève, les survivants gagnent.')
};
for (const id of ['gun', 'coop', 'inf']) if (!MODE_IDS.includes(id)) MODE_IDS.push(id);

function partySrc() { return (MATCH.online && typeof NET !== 'undefined' && NET.cfg) ? NET.cfg : Settings; }
function partyOn(k) { return !!(+partySrc()[k]); }
function partyCfg() {
  const s = partySrc();
  return {
    hard: !!+s.mutHard, pistol: !!+s.mutPistol, knife: !!+s.mutKnife,
    insta: !!+s.mutInsta, rand: !!+s.mutRand, ff: !!+s.mutFF,
    coopN: PARTY_COOP_N.includes(+s.coopN) ? +s.coopN : 6
  };
}
function partyMaxHp() { return partyCfg().hard ? PARTY_HC_HP : 100; }
function partyAllowsFF() { return partyCfg().ff; }
function partyWantsKnife(e) {
  if (MATCH.mode === 'inf' && e && e.infected) return true;
  if (MATCH.mode === 'gun' && e && (e.ggTier || 0) >= GG_GUNS.length) return true;
  return partyCfg().knife;
}
function partyWeaponDef(id) { return typeof weaponDef === 'function' ? weaponDef(id) : WEAPONS[id]; }
function partyPistolId(e) {
  const i = (e && e.id != null ? e.id : Math.floor(Math.random() * 4)) % PARTY_PISTOLS.length;
  return PARTY_PISTOLS[i];
}
function partyGunId(e) {
  const t = (e && e.ggTier) || 0;
  return t < GG_GUNS.length ? GG_GUNS[t] : null;
}
function partyAdjustDamage(victim, dmg, attacker, weapon) {
  if (partyCfg().insta && attacker && attacker !== victim) return Math.max(dmg, 999);
  return dmg;
}
function partyMoveMul(e) { return (MATCH.mode === 'inf' && e && e.infected) ? PARTY_INF_SPEED : 1; }

function partyApplyScoreLabels() {
  const el = document.querySelectorAll('.score .row span');
  if (!el.length) return;
  let labs;
  if (MATCH.mode === 'gun' || MATCH.mode === 'ffa') labs = [_t('Vous'), _t('Rival')];
  else if (MATCH.mode === 'inf') labs = [_t('Survivants'), _t('Infectés')];
  else if (MATCH.mode === 'coop') labs = [_t('Vous'), _t('Bots')];
  else labs = TEAM_NAMES;
  el.forEach((s, i) => { s.textContent = labs[i]; });
}
function partyLimitLabel() {
  if (MATCH.mode === 'gun') return _t('Premier au couteau');
  if (MATCH.mode === 'inf') return _t('Survivre jusqu\u0027à la fin');
  return null;
}

function partyRoster() {
  if (MATCH.mode !== 'gun' && MATCH.mode !== 'coop' && MATCH.mode !== 'inf') return false;
  const bots = entities.filter((e) => !e.isPlayer);
  let off = new Set();
  if (MATCH.mode === 'coop') {
    const n = partyCfg().coopN;
    off = new Set(bots.filter((e) => e.team === 0).concat(bots.filter((e) => e.team === 1).slice(n)));
    if (PL && PL.ent) PL.ent.team = 0;
  } else {
    const keep = typeof botPlan === 'function' ? botPlan().ffa : FFA_BOTS;
    off = MATCH.online ? new Set() : botFfaOff(bots, keep);
  }
  for (const e of bots) {
    e.off = off.has(e);
    if (e.off) { e.alive = false; e.respawnT = Infinity; e.target = null; e.model.rag = null; e.model.root.visible = false; }
    else soldierLook(e.model, skinOf(e), skinRel(e));
  }
  return true;
}

function partyOnModeStart() {
  if (MATCH.mode === 'gun') ggRebuild();
  for (const e of entities) {
    e.ggTier = 0;
    if (MATCH.mode !== 'inf') e.infected = false;
    else if (!e.infected) e.infected = false;
  }
  if (MATCH.mode === 'inf') {
    for (const e of entities) { if (!e.off && !e.isRemote) { e.infected = false; e.team = 0; } }
    partyPickPatientZero();
  }
  if (MATCH.mode === 'coop' && PL && PL.ent) PL.ent.team = 0;
  partyApplyScoreLabels();
}

function partyPickPatientZero() {
  if (MATCH.mode !== 'inf') return;
  if (MATCH.online && typeof NET !== 'undefined' && NET.role !== 'host') return;
  const cand = entities.filter((e) => !e.off && !e.isRemote);
  if (!cand.length) return;
  partyInfect(cand[Math.floor(Math.random() * cand.length)], true);
}

function partyInfect(e, first) {
  if (!e) return;
  e.infected = true;
  e.team = 1;
  if (first) {
    if (e.isPlayer) hudMsg(_t('Vous êtes l\u0027infecté de départ !'), 'enemy', 3);
    else hudMsg(_t('{0} est l\u0027infecté de départ', e.name), 'neutral', 3);
  } else if (e.isPlayer) hudMsg(_t('Vous avez été infecté'), 'enemy', 2.5);
  if (MATCH.online && first && e.isRemote && typeof netEvent === 'function') netEvent({ k: 'pinf', to: e.peer, first: 1 });
}

function partyNetInfect(ev) {
  const who = ev.to === NET.me ? PL.ent : (typeof netLocal === 'function' && netLocal(ev.to)) || (typeof netEntity === 'function' && netEntity(ev.to));
  if (!who) return;
  partyInfect(who, !!ev.first);
  if (who.isPlayer) partyAfterLoadout();
}

function partyPrepareBot(e) {
  if (!e || e.isPlayer || e.isRemote) return;
  e.health = partyMaxHp();
  const knife = partyWantsKnife(e);
  let id = null;
  if (!knife && MATCH.mode === 'gun') id = partyGunId(e);
  else if (!knife && partyCfg().pistol) id = partyPistolId(e);
  if (id && WEAPONS[id]) {
    const def = WEAPONS[id];
    e.weapon = def; e.mag = def.mag;
    if (typeof makeArms === 'function') e.arms = makeArms([def], 60);
    if (e.model && typeof setSoldierGun === 'function') setSoldierGun(e.model, def.key);
    if (typeof gunPrebuild === 'function') gunPrebuild(def);
  }
}

function partyAfterLoadout() {
  const e = PL.ent;
  if (!e) return;
  if (partyCfg().rand && MATCH.mode !== 'gun' && typeof classIds === 'function') {
    const ids = classIds();
    if (ids.length) PL.classIdx = ids[Math.floor(Math.random() * ids.length)];
  }
  let arms = null;
  if (MATCH.mode === 'gun') {
    const id = partyGunId(e);
    if (id) { const d = partyWeaponDef(id); if (d) arms = [d, d]; }
  } else if (!partyWantsKnife(e) && partyCfg().pistol) {
    const d = partyWeaponDef(partyPistolId(e));
    if (d) arms = [d, d];
  } else if (partyCfg().rand && MATCH.mode !== 'gun' && typeof classWeapons === 'function') {
    arms = classWeapons(PL.classIdx);
  }
  if (arms && typeof makeArms === 'function') {
    e.arms = makeArms(arms);
    if (typeof vmEquip === 'function' && !partyWantsKnife(e)) vmEquip(PL.weapons[0].def);
  }
  if (partyWantsKnife(e)) {
    PL.nades = 0;
    if (typeof knifeDraw === 'function') knifeDraw();
    PL.knifeOut = true;
    if (typeof VM !== 'undefined') VM.lowerTarget = 1;
  }
}

function partyBotMelee(e, now) {
  if (!e || !e.alive || e.isPlayer || e.isRemote) return;
  if (e.input) { e.input.fire = false; e.input.ads = false; }
  const T = e.target;
  if (!T || !T.alive || allied(e, T)) return;
  if (e.pos.distanceTo(T.pos) > 2.15) return;
  if (now - (e.partyMeleeT || 0) < 0.7) return;
  e.partyMeleeT = now;
  const dir = new V3().subVectors(T.pos, e.pos); dir.y = 0;
  if (dir.lengthSq() > 1e-6) dir.normalize(); else dir.set(0, 0, -1);
  e.yaw = Math.atan2(-dir.x, -dir.z);
  if (typeof sfxMelee === 'function') sfxMelee();
  T.lastForce = { dir: dir.clone(), mag: 6, lift: 1.4, part: 'body' };
  applyDamage(T, 200, e, _t('Couteau'), false, dir);
}

function partyOnDeath(v, a) {
  if (MATCH.mode === 'coop' && a && a !== v && !a.isRemote && !MATCH.finalPending && !MATCH.fin && !allied(a, v)) MATCH.score[a.team]++;
  if (MATCH.mode === 'gun' && a && a !== v && !a.isRemote && !MATCH.finalPending && !MATCH.fin && !allied(a, v)) {
    a.ggTier = (a.ggTier || 0) + 1;
    if (a.isPlayer) {
      const nid = partyGunId(a);
      if (nid) hudMsg(_t('Prochaine arme, {0}', WEAPONS[nid] ? (WEAPONS[nid].name || nid) : nid), 'ally', 1.8);
      else hudMsg(_t('Couteau. Une élimination pour gagner'), 'ally', 2);
      partyAfterLoadout();
    } else partyPrepareBot(a);
  }
  if (MATCH.mode === 'inf' && v && !v.infected && !(MATCH.finalPending || MATCH.fin)) {
    partyInfect(v, false);
  }
}

function partyLimitReached() {
  if (MATCH.mode === 'gun') return entities.some((e) => !e.off && (e.ggTier || 0) > GG_GUNS.length);
  if (MATCH.mode === 'inf') {
    const live = entities.filter((e) => !e.off && (!MATCH.online || e.isPlayer || e.isRemote || e.netBot));
    return live.length > 0 && live.every((e) => e.infected);
  }
  return false;
}

function partyOutcome() {
  const me = PL.ent;
  if (MATCH.mode === 'gun') {
    const top = entities.filter((e) => !e.off).sort((a, b) => (b.ggTier || 0) - (a.ggTier || 0) || b.kills - a.kills)[0];
    const win = top === me || (top && (top.ggTier || 0) <= (me.ggTier || 0) && top.kills <= me.kills && (me.ggTier || 0) > GG_GUNS.length);
    const champ = entities.filter((e) => !e.off && (e.ggTier || 0) > GG_GUNS.length).sort((a, b) => b.kills - a.kills)[0] || top;
    const iWin = champ === me;
    return { result: iWin ? 'win' : 'loss', winner: -1, sub: iWin ? _t('Vous gagnez la course aux armes') : _t('{0} gagne la course aux armes', champ ? champ.name : '') };
  }
  if (MATCH.mode === 'inf') {
    const live = entities.filter((e) => !e.off && (!MATCH.online || e.isPlayer || e.isRemote || e.netBot));
    const survLeft = live.some((e) => !e.infected);
    const infWin = !survLeft;
    const meInf = !!me.infected;
    const result = infWin ? (meInf ? 'win' : 'loss') : (meInf ? 'loss' : 'win');
    return { result, winner: infWin ? 1 : 0, sub: infWin ? _t('Les infectés l\u0027emportent') : _t('Les survivants l\u0027emportent') };
  }
  return null;
}

function partyAfterStart() {
  const _hp = partyMaxHp();
  for (const e of entities) if (e && !e.off && e.health > _hp) e.health = _hp;
  if (MATCH.mode === 'coop' && PL && PL.ent) PL.ent.team = 0;
  if (MATCH.mode === 'inf' && PL && PL.ent && PL.ent.infected) PL.ent.team = 1;
  const lab = partyLimitLabel();
  if (lab) hudText($('scLim'), lab);
  const mine = (MATCH.mode === 'ffa' || MATCH.mode === 'gun') ? 0 : (MATCH.mode === 'inf' ? (PL.ent.infected ? 1 : 0) : PL.ent.team);
  document.querySelectorAll('.score .row').forEach((r, t) => { r.classList.toggle('a', t === mine); r.classList.toggle('b', t !== mine); });
  partyApplyScoreLabels();
}

function partyExtendRows(rows, o) {
  const set = (k) => (v) => o.set(k, v), dis = !o.edit;
  if (o.mode === 'coop') {
    const at = rows.findIndex((r) => r.key === 'bots');
    const row = { k: 'seg', full: true, key: 'coopN', label: _t('Bots ennemis'), items: PARTY_COOP_N.map((n) => [n, String(n)]), get: () => (PARTY_COOP_N.includes(+o.coopN) ? +o.coopN : 6), set: set('coopN'), disabled: dis };
    if (at >= 0) rows.splice(at + 1, 0, row); else rows.push(row);
  }
  if (o.mode === 'gun' || o.mode === 'inf') {
    const li = rows.findIndex((r) => r.key === 'limit');
    if (li >= 0) rows.splice(li, 1);
  }
  if (o.mode === 'gun') {
    const cur = GG_ORDERS.indexOf(o.ggOrder) >= 0 ? o.ggOrder : 'mix';
    rows.push(
      { k: 'seg', full: true, key: 'ggOrder', label: _t('Ordre des armes'), items: [['mix', _t('Mélangé')], ['rand', _t('Aléatoire')], ['classic', _t('Classique')]], get: () => cur, set: set('ggOrder'), disabled: dis },
      { k: 'note', cls: 'hint', text: _t('Mélangé : les armes les plus faciles à tuer en premier, en alternant les types. Aléatoire : un ordre tiré au sort. Classique : l\u0027ordre d\u0027origine.') }
    );
  }
  const muts = [
    { key: 'mutHard', label: _t('Hardcore'), sub: _t('Moins de vie (30 PV). Chaque échange compte.') },
    { key: 'mutPistol', label: _t('Pistolets seulement'), sub: _t('Tout le monde n\u0027a qu\u0027un pistolet.'), hide: o.mode === 'gun' || o.mode === 'inf' },
    { key: 'mutKnife', label: _t('Couteau seulement'), sub: _t('Plus d\u0027armes à feu, le couteau seulement.'), hide: o.mode === 'gun' || o.mode === 'inf' },
    { key: 'mutInsta', label: _t('Instagib'), sub: _t('Chaque touche tue sur le coup.') },
    { key: 'mutRand', label: _t('Classe au hasard'), sub: _t('Une classe tirée au sort à chaque vie.'), hide: o.mode === 'gun' },
    { key: 'mutFF', label: _t('Tir allié'), sub: _t('Les balles touchent aussi vos alliés.'), hide: o.mode === 'ffa' || o.mode === 'gun' }
  ];
  const head = { k: 'note', cls: 'hint', text: _t('Mutateurs') };
  const added = [];
  for (const m of muts) {
    if (m.hide) continue;
    added.push({ k: 'check', key: m.key, label: m.label, sub: m.sub, get: () => !!(+o[m.key]), set: (v) => o.set(m.key, v ? 1 : 0), disabled: dis });
  }
  if (added.length) rows.push(head, ...added);
  return rows;
}

function partyFillCfg(dst, src) {
  src = src || {};
  for (const k of PARTY_MUT_KEYS) dst[k] = +src[k] ? 1 : 0;
  dst.coopN = PARTY_COOP_N.includes(+src.coopN) ? +src.coopN : 6;
  dst.ggOrder = GG_ORDERS.includes(src.ggOrder) ? src.ggOrder : 'mix';
  if (ggListOk(src.ggGuns)) dst.ggGuns = src.ggGuns.slice();
  else if (dst.ggOrder === 'rand') dst.ggGuns = ggShuffle(GG_CLASSIC);
  else if (dst.ggOrder === 'mix') dst.ggGuns = ggBuildMixed(GG_CLASSIC);
  else dst.ggGuns = GG_CLASSIC.slice();
  return dst;
}

function partySoloStage(orig) {
  const mode = Settings.mode;
  if (mode !== 'coop' && mode !== 'gun' && mode !== 'inf') return orig;
  const me = lobbyMe([]);
  const bot = (n, i) => ({ k: 'player', key: 'b' + i, label: n, bot: true, tags: typeof persListTag === 'function' ? persListTag(n) : [] });
  if (mode === 'coop') {
    const n = partyCfg().coopN;
    const pool = [...BOT_NAMES[1]];
    return { head: `<b>${esc(_t('Joueurs'))}</b><span>${esc(_t('Vous contre les bots'))}</span>`, cols: [
      { cls: 'ally', head: esc(_t('Vous')), rows: [me] },
      { cls: 'enemy', head: esc(_t('Bots')), rows: pool.slice(0, n).map((nm, i) => bot(nm, i)) }
    ] };
  }
  // gun / inf : comme le chacun pour soi
  const all = [...BOT_NAMES[0], ...BOT_NAMES[1]], idx = all.map((n, i) => i);
  const keep = typeof botPlan === 'function' ? botPlan().ffa : FFA_BOTS;
  const off = botFfaOff(idx, keep);
  const shown = all.filter((n, i) => !off.has(i));
  const head = mode === 'inf' ? _t('Survivants (un infecté au départ)') : _t('Chacun pour soi');
  return { head: `<b>${esc(_t('Joueurs'))}</b><span>${1 + shown.length}</span>`, cols: [{ head: esc(head), rows: [me, ...shown.map(bot)] }] };
}

function partyNetRebalance() {
  if (NET.role !== 'host' || !NET.on) return false;
  if (NET.cfg.mode !== 'coop' && NET.cfg.mode !== 'gun' && NET.cfg.mode !== 'inf') return false;
  const hum = [];
  for (const pl of NET.players.values()) if (pl.ig) hum.push(pl);
  if (NET.cfg.mode === 'coop') {
    for (const pl of NET.players.values()) pl.t = 0;
    if (typeof NET !== 'undefined') NET.team = 0;
    if (PL && PL.ent) PL.ent.team = 0;
    const want = NET.cfg.bots ? partyCfg().coopN : 0;
    const pool = entities.filter((e) => !e.isPlayer && !e.isRemote && e.team === 1);
    let active = pool.filter((b) => b.netBot);
    while (active.length > want) { const b = active.find((x) => !x.alive) || active[active.length - 1]; netBotOff(b); active = active.filter((x) => x !== b); }
    for (const b of pool) { if (active.length >= want) break; if (!b.netBot) { netBotOn(b); active.push(b); } }
    for (const b of entities.filter((e) => !e.isPlayer && !e.isRemote && e.team === 0 && e.netBot)) netBotOff(b);
    return true;
  }
  // gun / inf : un seul groupe, comme le chacun pour soi
  const nHum = hum.length;
  const plan = typeof botPlanCfg === 'function' ? botPlanCfg(NET.cfg) : { ffa: FFA_BOTS };
  const want = !NET.cfg.bots ? 0 : Math.max(0, Math.min(plan.ffa, NET_MAX - nHum));
  const pool = entities.filter((e) => !e.isPlayer && !e.isRemote);
  let active = pool.filter((b) => b.netBot);
  while (active.length > want) { const b = active.find((x) => !x.alive) || active[active.length - 1]; netBotOff(b); active = active.filter((x) => x !== b); }
  for (const b of pool) { if (active.length >= want) break; if (!b.netBot) { netBotOn(b); active.push(b); } }
  return true;
}

function partyLanHome(page) {
  if (!page || !page.rows) return page;
  for (const r of page.rows) {
    if (r.key === 'create') {
      r.primary = true;
      if (r.label === _t('Créer un salon') || r.k === 'btn') {
        r.label = _t('Héberger une partie');
        r.sub = _t('Vous créez le salon et donnez le code à vos amis');
      }
    }
    if (r.key === 'join') {
      r.primary = true;
      r.label = _t('Rejoindre une partie');
      r.sub = _t('Entrez le code de 5 caractères de l\u0027hôte');
    }
  }
  return page;
}

function partyUiStyle() {
  if (document.getElementById('party-lan-css')) return;
  const s = document.createElement('style');
  s.id = 'party-lan-css';
  s.textContent = '#scr-multi .lrow.primary{min-height:3.4em;font-size:1.12em;font-weight:700;}#scr-multi .lrow.k-btn.primary .ll{font-size:1.08em;}';
  document.head.appendChild(s);
}
partyUiStyle();

/* ---------- Enveloppes ---------- */

const _party_allied = allied;
allied = function (a, b) {
  if (party._ff && a !== b) return false;
  if (a === b) return true;
  if (MATCH.mode === 'inf') return !!a.infected === !!b.infected;
  if (MATCH.mode === 'ffa' || MATCH.mode === 'gun') return false;
  return a.team === b.team;
};

const _party_soundFoe = soundFoe;
soundFoe = function (s, b) {
  if (MATCH.mode === 'gun') return s.who !== b;
  if (MATCH.mode === 'inf' && s.who) return !allied(s.who, b);
  return _party_soundFoe(s, b);
};

const _party_modeStart = modeStart;
modeStart = function (mode) {
  const D = _party_modeStart(mode);
  partyOnModeStart();
  return D;
};

const _party_modeRoster = modeRoster;
modeRoster = function () {
  if (partyRoster()) return;
  _party_modeRoster();
};

const _party_modeUpdate = modeUpdate;
modeUpdate = function (dt) {
  _party_modeUpdate(dt);
  if (MATCH.mode === 'gun') ffaScore();
  const max = partyMaxHp();
  for (const e of entities) if (e && e.health > max) e.health = max;
};

const _party_killLimit = killLimitReached;
killLimitReached = function () {
  if (partyLimitReached()) return true;
  if (MATCH.mode === 'gun' || MATCH.mode === 'inf') return false;
  return _party_killLimit();
};

const _party_applyDamage = applyDamage;
applyDamage = function (victim, dmg, attacker, weapon, head, dir, srcPos, life) {
  dmg = partyAdjustDamage(victim, dmg, attacker, weapon);
  const prev = party._ff;
  party._ff = partyAllowsFF();
  try { return _party_applyDamage(victim, dmg, attacker, weapon, head, dir, srcPos, life); }
  finally { party._ff = prev; }
};

const _party_killEnt = killEnt;
killEnt = function (v, a, weapon, head, dir, life) {
  _party_killEnt(v, a, weapon, head, dir, life);
  partyOnDeath(v, a);
};

const _party_startMatch = startMatch;
startMatch = function (opt) {
  _party_startMatch(opt);
  partyAfterStart();
};

const _party_giveLoadout = giveLoadout;
giveLoadout = function () {
  _party_giveLoadout();
  partyAfterLoadout();
};

const _party_knifeStow = knifeStow;
knifeStow = function (i) {
  if (partyWantsKnife(PL.ent)) return;
  return _party_knifeStow(i);
};

const _party_spawnEntity = spawnEntity;
spawnEntity = function (e) {
  _party_spawnEntity(e);
  e.health = partyMaxHp();
  partyPrepareBot(e);
};

const _party_ctlWeapon = ctlWeapon;
ctlWeapon = function (ent, dt, now) {
  if (partyWantsKnife(ent)) {
    if (ent.arms) ent.arms.knife = true;
    if (!ent.isPlayer && !ent.isRemote) partyBotMelee(ent, now);
    return;
  }
  if (ent.arms) ent.arms.knife = !!ent.arms.knife && !ent.isPlayer ? false : ent.arms.knife;
  return _party_ctlWeapon(ent, dt, now);
};

const _party_updatePlayer = updatePlayer;
updatePlayer = function (dt, now) {
  _party_updatePlayer(dt, now);
  const max = partyMaxHp();
  if (PL.ent && PL.ent.health > max) PL.ent.health = max;
};

const _party_updateHud = updateHud;
updateHud = function (dt) {
  _party_updateHud(dt);
  const e = PL.ent, max = partyMaxHp();
  if (!e) return;
  const hp = $('hp');
  if (!hp) return;
  const hpv = Math.max(0, Math.ceil(e.health));
  hudStyle(hp, 'opacity', e.alive && hpv < max ? '1' : '0');
  const fill = $('hpFill');
  if (fill) hudStyle(fill, 'transform', `scaleX(${clamp(e.health / max, 0, 1)})`);
  hudCls(hp, 'crit', hpv <= max * 0.35);
};

const _party_netCfg = netCfg;
netCfg = function (c) {
  return partyFillCfg(_party_netCfg(c), c);
};

const _party_netMatchCfg = netMatchCfg;
netMatchCfg = function () {
  const o = _party_netMatchCfg();
  return partyFillCfg(o, NET.cfg);
};

const _party_soloCfg = soloCfg;
soloCfg = function () {
  const o = _party_soloCfg();
  return partyFillCfg(o, Settings);
};

const _party_soloSet = soloSet;
soloSet = function (k, v) {
  if (PARTY_MUT_KEYS.includes(k)) { Settings[k] = +v ? 1 : 0; saveSettings(); return; }
  if (k === 'coopN') { Settings.coopN = PARTY_COOP_N.includes(+v) ? +v : 6; saveSettings(); return; }
  if (k === 'ggOrder') {
    Settings.ggOrder = GG_ORDERS.includes(v) ? v : 'mix';
    if (Settings.ggOrder === 'rand') Settings.ggGuns = ggShuffle(GG_CLASSIC);
    else if (Settings.ggOrder === 'mix') Settings.ggGuns = ggBuildMixed(GG_CLASSIC);
    else Settings.ggGuns = GG_CLASSIC.slice();
    saveSettings(); return;
  }
  _party_soloSet(k, v);
};

const _party_matchRows = matchRows;
matchRows = function (o) { return partyExtendRows(_party_matchRows(o), o); };

const _party_soloStage = soloStage;
soloStage = function () { return partySoloStage(_party_soloStage()); };

const _party_netRebalanceBots = netRebalanceBots;
netRebalanceBots = function () {
  if (partyNetRebalance()) return;
  _party_netRebalanceBots();
};

const _party_netTeamSwap = netTeamSwap;
netTeamSwap = function (id) {
  if (NET.cfg && (NET.cfg.mode === 'coop' || NET.cfg.mode === 'inf')) return;
  return _party_netTeamSwap(id);
};

const _party_netPresence = netPresence;
netPresence = function (e, now) {
  const p = _party_netPresence(e, now);
  if (p) { p.gg = e.ggTier | 0; p.inf = e.infected ? 1 : 0; }
  return p;
};

const _party_netApply = netApply;
netApply = function (id, P) {
  _party_netApply(id, P);
  const e = NET.remotes.get(id);
  if (!e) return;
  const max = partyMaxHp();
  if (e.health > max) e.health = max;
  if (P && 'gg' in P) e.ggTier = P.gg | 0;
  if (P && 'inf' in P) {
    const was = !!e.infected;
    e.infected = !!P.inf;
    if (e.infected) e.team = 1;
    else if (MATCH.mode === 'inf') e.team = 0;
    if (!was && e.infected && !e.isPlayer) { /* tenue / arme : l'état suivant porte l'arme */ }
  }
};

const _party_netEventIn = netEventIn;
netEventIn = function (e, ev) {
  if (ev && ev.k === 'pinf') { partyNetInfect(ev); return; }
  return _party_netEventIn(e, ev);
};

const _party_netUpdate = netUpdate;
netUpdate = function (dt) {
  _party_netUpdate(dt);
  if (!NET.on) return;
  const live = MATCH.state === 'playing' || MATCH.state === 'paused';
  if (NET.role === 'host' && live && (MATCH.mode === 'gun' || MATCH.mode === 'inf') && partyLimitReached()) matchFinishSoon();
};

if (typeof NET_PAGES !== 'undefined' && NET_PAGES.home) {
  const _party_home = NET_PAGES.home;
  NET_PAGES.home = function () { return partyLanHome(_party_home()); };
  if (NET_PAGES.join) {
    const _party_join = NET_PAGES.join;
    NET_PAGES.join = function (o) {
      const page = _party_join(o);
      if (page && page.rows) for (const r of page.rows) if (r.key === 'go') { r.primary = true; r.label = r.label || _t('Rejoindre une partie'); }
      return page;
    };
  }
}

/* matchOutcome / finByLimit : définis plus tard (fichiers après 09ib). 09ic-party-end.js les enveloppe. */

const _party_netSetupSet = netSetupSet;
netSetupSet = function (k, v) {
  _party_netSetupSet(k, v);
  if (k === 'ggOrder' && NET.cfg) {
    Settings.ggOrder = NET.cfg.ggOrder;
    Settings.ggGuns = Array.isArray(NET.cfg.ggGuns) ? NET.cfg.ggGuns.slice() : Settings.ggGuns;
    saveSettings();
  }
};
