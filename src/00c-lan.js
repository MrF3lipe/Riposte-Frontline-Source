/* ==========================================================================
   MODE LAN SANS INTERNET
   ?lan=HOTE:PORT, window.__DC_LAN ou sessionStorage dc_lan. Le script PeerJS
   local est choisi au chargement de la page (build.py) ; ici on expose
   l'adresse pour que le salon n'appelle ni le CDN ni le relais en ligne.
   ========================================================================== */
function dcLanRaw() {
  try {
    const m = /[?&]lan=([^&#]*)/.exec(location.search || '');
    if (m && m[1]) {
      const q = decodeURIComponent(m[1].replace(/\+/g, ' ')).trim();
      if (q && q !== '0' && q !== 'off') {
        try { sessionStorage.setItem('dc_lan', q); } catch (e) { /* stockage indisponible */ }
        return q;
      }
      try { sessionStorage.removeItem('dc_lan'); } catch (e) { /* ignoré */ }
      return '';
    }
    if (typeof window.__DC_LAN === 'string' && window.__DC_LAN.trim()) return window.__DC_LAN.trim();
    return (sessionStorage.getItem('dc_lan') || '').trim();
  } catch (e) { return ''; }
}
const DC_LAN = dcLanRaw();
function lanOn() { return !!DC_LAN; }
/* Hôte et port du serveur PeerJS local (portable/LanServer.cs, clé peerjs, chemin /). */
function lanHostPort() {
  let s = String(DC_LAN || '').replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  let host = s, port = 8770;
  const m = /^(.*):(\d+)$/.exec(s);
  if (m) { host = m[1]; port = +m[2] || 8770; }
  if (host.startsWith('[') && host.endsWith(']')) host = host.slice(1, -1);
  return { host: host || '127.0.0.1', port };
}
