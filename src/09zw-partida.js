/* Opciones de partida privada. Se guardan en Settings.pm[modo] y, en LAN, el anfitrión las manda en NET.cfg.pm. Una build original ignora el campo. */
const MO_HP = [50, 100, 150, 200];
const MO_SPD = [0.75, 1, 1.15, 1.25, 1.5];
const MO_DEF = { hp: 100, spd: 1, ammo: 0, ks: 1 };

function moSrc() {
  if (MATCH.online && typeof NET !== 'undefined' && NET.cfg && NET.cfg.pm && typeof NET.cfg.pm === 'object') return NET.cfg.pm;
  const mode = (MATCH && MATCH.mode) || (Settings && Settings.mode) || 'tdm';
  if (Settings.pm && Settings.pm[mode]) return Settings.pm[mode];
  return MO_DEF;
}
function moNorm(src) {
  src = src || {};
  const hp = MO_HP.includes(+src.hp) ? +src.hp : 100;
  const spd = MO_SPD.includes(+src.spd) ? +src.spd : 1;
  return { hp, spd, ammo: +src.ammo ? 1 : 0, ks: src.ks === 0 || src.ks === '0' ? 0 : 1 };
}
function moRead() { return moNorm(moSrc()); }
function moWrite(mode, patch) {
  if (!MODES[mode]) mode = Settings.mode || 'tdm';
  if (!Settings.pm || typeof Settings.pm !== 'object') Settings.pm = {};
  Settings.pm[mode] = Object.assign(moNorm(Settings.pm[mode]), patch);
  saveSettings();
}
function moCfgOf(mode, src) {
  const raw = (src && src.pm && src.pm[mode]) ? src.pm[mode] : (src && src.pm && !src.pm[mode] && src.hp != null ? src.pm : null);
  return moNorm(raw || (Settings.pm && Settings.pm[mode]) || MO_DEF);
}

const _mo_hp = partyMaxHp;
partyMaxHp = function () {
  const o = moRead();
  if (typeof partyCfg === 'function' && partyCfg().hard) return _mo_hp();
  return o.hp || _mo_hp();
};

const _mo_move = perkMoveMul;
perkMoveMul = function (ent) {
  return _mo_move(ent) * (moRead().spd || 1);
};

const _mo_ks = streakKill;
streakKill = function (a, weapon, life) {
  if (!moRead().ks) return false;
  return _mo_ks(a, weapon, life);
};

const _mo_shoot = ctlShoot;
ctlShoot = function (ent, now) {
  const r = _mo_shoot(ent, now);
  if (moRead().ammo && ent && ent.arms) {
    const w = typeof armsW === 'function' ? armsW(ent) : (ent.arms.slots && ent.arms.slots[ent.arms.cur]);
    if (w && w.def) { w.mag = w.def.mag; if (w.reserve < 1) w.reserve = w.def.reserve; }
  }
  return r;
};

function moExtendRows(rows, o) {
  const dis = !o.edit, pm = moNorm((o.online && NET.cfg && NET.cfg.pm) || (Settings.pm && Settings.pm[o.mode]) || MO_DEF);
  const set = (k) => (v) => {
    if (o.online) {
      if (typeof netSetupSet === 'function') {
        const cur = moNorm((NET.cfg && NET.cfg.pm) || pm);
        cur[k] = v;
        netSetupSet('pm', cur);
      }
    } else { moWrite(o.mode, { [k]: v }); if (typeof saveSettings === 'function') saveSettings(); }
  };
  rows.push(
    { k: 'note', cls: 'hint', text: _t('Options de partie') },
    { k: 'seg', full: true, key: 'pmhp', label: _t('Vie'), items: MO_HP.map((n) => [n, String(n)]), get: () => pm.hp, set: set('hp'), disabled: dis },
    { k: 'seg', full: true, key: 'pmspd', label: _t('Vitesse'), items: MO_SPD.map((n) => [n, Math.round(n * 100) + ' %']), get: () => pm.spd, set: set('spd'), disabled: dis },
    { k: 'seg', full: true, key: 'pmammo', label: _t('Munitions'), items: [[0, _t('Normales')], [1, _t('Illimitées')]], get: () => pm.ammo, set: (v) => set('ammo')(+v), disabled: dis },
    { k: 'seg', full: true, key: 'pmks', label: _t('Séries d\u0027éliminations'), items: [[1, _t('Activées')], [0, _t('Désactivées')]], get: () => pm.ks, set: (v) => set('ks')(+v), disabled: dis }
  );
  return rows;
}

const _mo_rows = matchRows;
matchRows = function (o) { return moExtendRows(_mo_rows(o), o); };

const _mo_netCfg = netCfg;
netCfg = function (c) {
  const out = _mo_netCfg(c);
  const mode = (c && c.mode) || (out && out.mode) || Settings.mode;
  out.pm = moNorm((c && c.pm) || (Settings.pm && Settings.pm[mode]) || MO_DEF);
  return out;
};

const _mo_setup = netSetupSet;
netSetupSet = function (k, v) {
  if (k === 'pm') {
    if (NET.role !== 'host' || NET.phase !== 'lobby') return;
    const c = Object.assign({}, NET.cfg);
    c.pm = moNorm(v);
    NET.cfg = netCfg(c);
    moWrite(NET.cfg.mode, c.pm);
    if (typeof netLobbyChanged === 'function') netLobbyChanged();
    return;
  }
  _mo_setup(k, v);
};
