/* ==========================================================================
   EFFECTIF : 8 contre 8, chacun pour soi jusqu'à 16, sélecteur de bots.
   Les 7 alliés et les 8 ennemis sont créés au démarrage (09-game.js). Ici on
   décide lesquels jouent. En solo, modeRoster éteint le surplus. En ligne,
   l'hôte n'active que min(choix, places libres) via netRebalanceBots, pour
   qu'une équipe ne dépasse pas 8 une fois les humains arrivés.
   Un client 5.6 ignore ba, be et bf : son netCfg ne recopie que les clés qu'il connaît.
   ========================================================================== */
const BOT_ALLY_MAX = 7;
const BOT_ENEMY_MAX = 8;
const BOT_FFA_MAX = 15;

function botClamp(n, min, max, def) {
  n = +n;
  if (!Number.isFinite(n)) n = def;
  n = n | 0;
  if (n < min) n = min;
  if (n > max) n = max;
  return n;
}
/* Chacun pour soi, course aux armes, infectés : un seul groupe. */
function botPoolMode(mode) { return mode === 'ffa' || mode === 'gun' || mode === 'inf'; }
function botPlan() {
  return {
    ally: botClamp(Settings.allyN, 0, BOT_ALLY_MAX, 7),
    enemy: botClamp(Settings.enemyN, 1, BOT_ENEMY_MAX, 8),
    ffa: botClamp(Settings.ffaN, 1, BOT_FFA_MAX, 15),
  };
}
/* Réglage publié par l'hôte (NET.cfg). Sans ba/be/bf (vieux salon) : l'effectif plein. */
function botPlanCfg(c) {
  c = c || {};
  return {
    ally: botClamp(c.ba != null ? c.ba : Settings.allyN, 0, BOT_ALLY_MAX, 7),
    enemy: botClamp(c.be != null ? c.be : Settings.enemyN, 1, BOT_ENEMY_MAX, 8),
    ffa: botClamp(c.bf != null ? c.bf : Settings.ffaN, 1, BOT_FFA_MAX, 15),
  };
}
/* Mêmes bots écartés que l'ancien chacun pour soi : indices i % 3 === 1, puis la liste à l'envers. */
function botFfaOff(list, keep) {
  const cut = Math.max(0, list.length - (keep | 0));
  if (cut <= 0 || !list) return new Set();
  return new Set(list.filter((e, i) => i % 3 === 1).concat(list.slice().reverse()).filter((e, i, a) => a.indexOf(e) === i).slice(0, cut));
}
/* Places de bots affichées dans le salon : le choix, sans dépasser l'équipe ni le salon. */
function botSlotFree(mode, cfg, humans, t, ffa) {
  cfg = cfg || {};
  if (!cfg.bots) return 0;
  humans = Math.max(0, humans | 0);
  if (mode === 'coop') {
    const n = (typeof PARTY_COOP_N !== 'undefined' && PARTY_COOP_N.includes(+cfg.coopN)) ? +cfg.coopN : 6;
    return t === 1 ? Math.max(0, n - humans) : 0;
  }
  const plan = botPlanCfg(cfg);
  if (ffa || botPoolMode(mode)) return Math.max(0, Math.min(plan.ffa, NET_MAX - humans));
  return Math.max(0, Math.min(t === 0 ? plan.ally : plan.enemy, NET_TEAM - humans));
}
/* Rangées du sélecteur (Solo et hôte). La coop a déjà le sien (partyExtendRows). */
function botCountRows(o) {
  if (!o || !o.edit) return [];
  if (o.online && !o.bots) return [];
  const mode = o.mode || 'tdm';
  if (mode === 'coop') return [];
  const set = (k) => (v) => o.set(k, v);
  const nums = (a, b) => { const r = []; for (let i = a; i <= b; i++) r.push([i, String(i)]); return r; };
  const plan = botPlan();
  if (botPoolMode(mode)) {
    return [{ k: 'seg', key: 'ffaN', label: _t('Bots en chacun pour soi'), items: nums(1, BOT_FFA_MAX), get: () => botClamp(o.ffaN != null ? o.ffaN : plan.ffa, 1, BOT_FFA_MAX, 15), set: set('ffaN') }];
  }
  return [
    { k: 'seg', key: 'allyN', label: _t('Bots alliés'), items: nums(0, BOT_ALLY_MAX), get: () => botClamp(o.allyN != null ? o.allyN : plan.ally, 0, BOT_ALLY_MAX, 7), set: set('allyN') },
    { k: 'seg', key: 'enemyN', label: _t('Bots ennemis'), items: nums(1, BOT_ENEMY_MAX), get: () => botClamp(o.enemyN != null ? o.enemyN : plan.enemy, 1, BOT_ENEMY_MAX, 8), set: set('enemyN') },
  ];
}
