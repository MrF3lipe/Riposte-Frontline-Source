/* Contra-UAV (5 éliminations) : 30 s sans mini-carte pour l'adversaire.
   Résistant l'ignore, comme l'IEM. L'IEM ennemie éteint l'appareil.
   L'événement k:'cu' est ignoré par une build d'origine. */
KSDEF.cuav = {
  n: 5, name: _t('Contre-UAV'), short: _t('Contre-UAV'),
  icon: '<circle cx="12" cy="12" r="8.5"/><path d="M4 4l16 16M12 7.2a4.8 4.8 0 0 1 4.2 7.2"/>',
  desc: _t('Pendant 30 secondes, la mini-carte ennemie est inutilisable. Plus d\u0027UAV ni de points rouges. Résistant l\u0027ignore, comme l\u0027IEM.'),
  use: () => usePhoneKs('cuav'),
  bot: (b) => cuavFire(b)
};
if (!KS_IDS.includes('cuav')) KS_IDS.push('cuav');
STREAK.cuav = KSDEF.cuav.n;
if (typeof KS_PHONE !== 'undefined') KS_PHONE.add('cuav');
if (typeof TC_ICONS !== 'undefined') TC_ICONS.cuav = KSDEF.cuav.icon;
MATCH.cuav = [0, 0];

function cuavFire(owner, fromNet) {
  if (!owner) return false;
  const me = owner === PL.ent, ally = owner.team === PL.ent.team;
  if (!MATCH.cuav) MATCH.cuav = [0, 0];
  MATCH.cuav[owner.team] = 30;
  if (!fromNet && MATCH.online && typeof netIsLocal === 'function' && netIsLocal(owner)) netEvent({ k: 'cu' }, owner);
  if (typeof sfxIem === 'function') sfxIem(ally ? 0.35 : 0.55);
  if (typeof sfxAnnounce === 'function') sfxAnnounce(ally ? 'cuav_on' : 'cuav_enemy');
  hudMsg(me ? _t('Contre-UAV actif') : ally ? _t('Contre-UAV allié ({0})', owner.name) : _t('Contre-UAV ennemi'), ally ? 'ally' : 'enemy', 2.5);
  return true;
}
function cuavBlocks(e) {
  return !!(e && MATCH.cuav && MATCH.cuav[1 - e.team] > 0 && !(typeof perkHas === 'function' && perkHas(e, 'resist')));
}
const _uavBlipCu = uavBlip;
uavBlip = function (o, me, wave) {
  if (cuavBlocks(me)) return null;
  return _uavBlipCu(o, me, wave);
};
const _uavTickCu = uavTick;
uavTick = function (dt) {
  _uavTickCu(dt);
  if (!MATCH.cuav) return;
  MATCH.cuav[0] = Math.max(0, (MATCH.cuav[0] || 0) - dt);
  MATCH.cuav[1] = Math.max(0, (MATCH.cuav[1] || 0) - dt);
};
const _iemFireCu = iemFire;
iemFire = function (owner) {
  _iemFireCu(owner);
  if (owner && MATCH.cuav) MATCH.cuav[1 - owner.team] = 0;
};
const _startCu = startMatch;
startMatch = function (opt) {
  const r = _startCu(opt);
  MATCH.cuav = [0, 0];
  return r;
};
const _netInCu = netEventIn;
netEventIn = function (e, ev) {
  if (ev && ev.k === 'cu') { cuavFire(e, true); return; }
  return _netInCu(e, ev);
};
