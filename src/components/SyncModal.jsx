import { useState } from 'react';
import { fetchFromGitHub } from '../api/github.js';
import { _storedLive } from '../data.js';
import { CACHE_KEYS } from '../lib/cache.js';

export default function SyncModal({ onClose }) {
  const [token,    setToken]    = useState(() => localStorage.getItem(CACHE_KEYS.GH_TOKEN) || '');
  const [remember, setRemember] = useState(() => localStorage.getItem('nexus_gh_token_remember') !== 'false');
  const [status,   setStatus]   = useState('idle'); // idle | loading | error
  const [error,    setError]    = useState('');
  const [progress, setProgress] = useState('');

  async function handleSync() {
    if (!token.trim()) return;
    setStatus('loading'); setError(''); setProgress('Conectando con GitHub…');
    try {
      localStorage.setItem('nexus_gh_token_remember', remember ? 'true' : 'false');
      if (remember) localStorage.setItem(CACHE_KEYS.GH_TOKEN, token.trim());
      setProgress('Descargando datos del proyecto…');
      const data = await fetchFromGitHub(token.trim());
      setProgress(`✅ ${data.total} HU recibidas, recargando…`);
      localStorage.setItem(CACHE_KEYS.LIVE_DATA, JSON.stringify(data));
      localStorage.removeItem(CACHE_KEYS.EDITS);
      setTimeout(() => window.location.reload(), 500);
    } catch(e) {
      setStatus('error');
      setError(e.message);
    }
  }

  return (
    <div style={{ position:"fixed", inset:0, background:"#000000bb", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center" }}
         onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:"#18181b", border:"1px solid #3f3f46", borderRadius:12, padding:24, width:420, maxWidth:"92vw" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
          <div style={{ fontWeight:700, fontSize:14, color:"#f1f5f9" }}>🔄 Sincronizar con GitHub</div>
          <button onClick={onClose} style={{ background:"none", border:"none", color:"#71717a", cursor:"pointer", fontSize:20, lineHeight:1 }}>×</button>
        </div>
        <div style={{ fontSize:12, color:"#71717a", marginBottom:12, lineHeight:1.6 }}>
          Necesitas un <strong style={{color:"#a1a1aa"}}>Personal Access Token</strong> con permisos
          {' '}<code style={{background:"#09090b",padding:"1px 4px",borderRadius:3,color:"#818cf8"}}>read:project</code> y{' '}
          <code style={{background:"#09090b",padding:"1px 4px",borderRadius:3,color:"#818cf8"}}>repo</code>.
        </div>
        <input
          type="password" placeholder="ghp_…" value={token}
          onChange={e => setToken(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && status !== 'loading' && handleSync()}
          autoFocus
          style={{ width:"100%", background:"#09090b", border:"1px solid #3f3f46", borderRadius:6,
            padding:"8px 10px", color:"#f1f5f9", fontSize:13, outline:"none", boxSizing:"border-box" }}
        />
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginTop:8 }}>
          <label style={{ display:"flex", alignItems:"center", gap:6, fontSize:11, color:"#71717a", cursor:"pointer", userSelect:"none" }}>
            <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} />
            Recordar token en este navegador
          </label>
          {localStorage.getItem(CACHE_KEYS.GH_TOKEN) && (
            <span style={{ fontSize:10, color:"#ef4444", cursor:"pointer", textDecoration:"underline" }}
              onClick={() => { localStorage.removeItem(CACHE_KEYS.GH_TOKEN); setToken(''); }}>
              olvidar
            </span>
          )}
        </div>
        {status === 'loading' && (
          <div style={{ marginTop:8, fontSize:11, color:"#818cf8" }}>⏳ {progress}</div>
        )}
        {status === 'error' && (
          <div style={{ marginTop:8, fontSize:11, color:"#f87171" }}>⚠ {error}</div>
        )}
        <div style={{ display:"flex", gap:8, marginTop:16 }}>
          <button onClick={onClose}
            style={{ flex:1, padding:"8px", borderRadius:6, background:"transparent", border:"1px solid #3f3f46", color:"#71717a", cursor:"pointer", fontSize:12 }}>
            Cancelar
          </button>
          <button onClick={handleSync} disabled={status==='loading' || !token.trim()}
            style={{ flex:2, padding:"8px", borderRadius:6, background:"#6366f130", border:"1px solid #6366f155",
              color: status==='loading' ? "#52525b" : "#818cf8", cursor: status==='loading' ? "default" : "pointer", fontSize:12, fontWeight:700 }}>
            {status === 'loading' ? '⏳ Sincronizando…' : '🔄 Sincronizar ahora'}
          </button>
        </div>
        {_storedLive && (
          <div style={{ marginTop:12, fontSize:10, color:"#3f3f46", textAlign:"center" }}>
            Último sync: {new Date(_storedLive.fetchedAt).toLocaleString("es-ES")} · {_storedLive.total} HU
            {' '}·{' '}
            <span style={{ color:"#ef4444", cursor:"pointer", textDecoration:"underline" }}
              onClick={() => { localStorage.removeItem(CACHE_KEYS.LIVE_DATA); window.location.reload(); }}>
              borrar cache
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
