import { STATUS_META, SIZE_META } from '../../../constants.js';
import { rawData } from '../../../data.js';

function FilterBtn({ active, onClick, children, activeBg, activeColor }) {
  return (
    <button onClick={onClick} style={{
      padding:"3px 10px", borderRadius:5, fontSize:11, fontWeight:700, cursor:"pointer",
      background: active ? activeBg : "transparent",
      color: active ? activeColor : "var(--tx3)",
      border: active ? `1px solid ${activeBg}` : "1px solid var(--bdr)",
      transition:"all .12s",
    }}>{children}</button>
  );
}

export default function FilterBar({ stf, setStf, sf, setSf, af, setAf, ef, setEf, tf, setTf, pf, setPf,
  query, setQuery, toggle, areas, areaColor, equipos, tipos, persons, hasFilters, clearAll,
  view, setView }) {

  const myLogin = typeof localStorage !== 'undefined' ? localStorage.getItem('nexus_my_login') || '' : '';
  const isMyWork = pf.length === 1 && pf[0] === myLogin;

  const toggleMyWork = () => {
    if (!myLogin) {
      const login = prompt('Tu login de GitHub (se guarda en localStorage):');
      if (login) { localStorage.setItem('nexus_my_login', login); setPf([login]); }
      return;
    }
    setPf(isMyWork ? [] : [myLogin]);
  };

  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <div className="tab-group w-fit">
          {[
            { id:"tabla", label:"☰ Tabla" },
            { id:"tablero", label:"⬜ Tablero" },
            { id:"roadmap", label:"📊 Hoja de ruta" },
          ].map(({ id, label }) => (
            <button key={id} onClick={() => setView(id)} className={`tab-btn ${view === id ? 'active' : ''}`}>{label}</button>
          ))}
        </div>
        <button onClick={toggleMyWork} className={`btn btn-sm ${isMyWork ? 'btn-active' : ''}`}
          style={{ marginLeft: 'auto', background: isMyWork ? '#818cf820' : 'transparent', color: isMyWork ? '#818cf8' : 'var(--tx4)', borderColor: isMyWork ? '#818cf850' : 'var(--bdr)' }}>
          Mi trabajo
        </button>
      </div>

      <input
        value={query} onChange={e => setQuery(e.target.value)}
        placeholder="Buscar por ID o título…"
        className="input mb-2"
      />

      <div style={{ display:"flex", flexWrap:"wrap", gap:5, marginBottom:6, alignItems:"center" }}>
        <span className="text-dim text-xs" style={{ textTransform:"uppercase", letterSpacing:".07em", width:46, flexShrink:0 }}>Estado</span>
        {rawData.statuses.map(s => {
          const meta = STATUS_META[s] || { bg:"var(--bdr)", text:"var(--tx3)" };
          return <FilterBtn key={s} active={stf.includes(s)} onClick={() => toggle(stf, setStf, s)} activeBg={meta.bg} activeColor={meta.text}>{s}</FilterBtn>;
        })}
      </div>
      <div style={{ display:"flex", flexWrap:"wrap", gap:5, marginBottom:6, alignItems:"center" }}>
        <span className="text-dim text-xs" style={{ textTransform:"uppercase", letterSpacing:".07em", width:46, flexShrink:0 }}>Talla</span>
        {["XS","S","M","L","XL"].map(s => (
          <FilterBtn key={s} active={sf.includes(s)} onClick={() => toggle(sf, setSf, s)} activeBg={SIZE_META[s].bg} activeColor={SIZE_META[s].text}>{s}</FilterBtn>
        ))}
      </div>
      <div style={{ display:"flex", flexWrap:"wrap", gap:5, marginBottom:6, alignItems:"center" }}>
        <span className="text-dim text-xs" style={{ textTransform:"uppercase", letterSpacing:".07em", width:46, flexShrink:0 }}>Etiquetas</span>
        {areas.map(a => (
          <FilterBtn key={a} active={af.includes(a)} onClick={() => toggle(af, setAf, a)} activeBg={`${areaColor[a]}35`} activeColor={areaColor[a]}>{a}</FilterBtn>
        ))}
      </div>
      {equipos.length > 0 && (
        <div style={{ display:"flex", flexWrap:"wrap", gap:5, marginBottom:6, alignItems:"center" }}>
          <span className="text-dim text-xs" style={{ textTransform:"uppercase", letterSpacing:".07em", width:46, flexShrink:0 }}>Equipo</span>
          {equipos.map(e => (
            <FilterBtn key={e} active={ef.includes(e)} onClick={() => toggle(ef, setEf, e)} activeBg="#6366f130" activeColor="#818cf8">{e}</FilterBtn>
          ))}
        </div>
      )}
      {tipos.length > 0 && (
        <div style={{ display:"flex", flexWrap:"wrap", gap:5, marginBottom:6, alignItems:"center" }}>
          <span className="text-dim text-xs" style={{ textTransform:"uppercase", letterSpacing:".07em", width:46, flexShrink:0 }}>Tipo</span>
          {tipos.map(t => (
            <FilterBtn key={t} active={tf.includes(t)} onClick={() => toggle(tf, setTf, t)} activeBg="#f97316" activeColor="#fff7ed">{t}</FilterBtn>
          ))}
        </div>
      )}
      {persons.length > 0 && (
        <div style={{ display:"flex", flexWrap:"wrap", gap:5, marginBottom:6, alignItems:"center" }}>
          <span className="text-dim text-xs" style={{ textTransform:"uppercase", letterSpacing:".07em", width:46, flexShrink:0 }}>Persona</span>
          <div style={{ display:"flex", flexWrap:"wrap", gap:4 }}>
            {persons.map(a => (
              <button key={a.login} onClick={() => toggle(pf, setPf, a.login)} title={a.name || a.login} style={{
                background:"none", border:"none", padding:0, cursor:"pointer",
                borderRadius:"50%", outline: pf.includes(a.login) ? "2px solid #818cf8" : "2px solid transparent",
                outlineOffset:1, transition:"outline .12s",
              }}>
                <img src={a.avatarUrl} alt={a.login}
                  style={{ width:22, height:22, borderRadius:"50%", display:"block", opacity: pf.length && !pf.includes(a.login) ? 0.35 : 1, transition:"opacity .12s" }}
                />
              </button>
            ))}
          </div>
        </div>
      )}
      {hasFilters && (
        <button onClick={clearAll} style={{ marginTop:7, background:"none", border:"none", color:"#f87171", fontSize:11, cursor:"pointer", padding:0 }}>
          ✕ Limpiar filtros
        </button>
      )}
    </div>
  );
}
