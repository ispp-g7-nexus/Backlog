import { useState, useMemo } from 'react';
import { BACKLOG, SPRINTS } from '../../../data.js';
import { AREA_COLORS, SIZE_H_MAP } from '../../../constants.js';

const STATUSES = ["Backlog", "Ready", "In progress", "In review", "Done"];

export function useBacklogItems(sprint) {
  const [edits, setEdits] = useState(() => { try { return JSON.parse(localStorage.getItem('nexus_edits_v1') || '{}'); } catch { return {}; } });
  const [deletedIds, setDeletedIds] = useState(() => { try { return new Set(JSON.parse(localStorage.getItem('nexus_deleted_v1') || '[]')); } catch { return new Set(); } });
  const [createdItems, setCreatedItems] = useState(() => { try { return JSON.parse(localStorage.getItem('nexus_created_v1') || '[]'); } catch { return []; } });

  const [stf, setStf] = useState([]);
  const [sf, setSf] = useState([]);
  const [af, setAf] = useState([]);
  const [ef, setEf] = useState([]);
  const [tf, setTf] = useState([]);
  const [pf, setPf] = useState([]);
  const [query, setQuery] = useState("");

  const items = useMemo(() => sprint === null ? BACKLOG : BACKLOG.filter(i => i.sprint === sprint), [sprint]);

  const resolvedItems = useMemo(() => {
    const base = items.filter(i => !deletedIds.has(i.id)).map(i => edits[i.id] ? { ...i, ...edits[i.id] } : i);
    const created = createdItems
      .filter(i => (sprint === null || i.sprint === sprint) && !deletedIds.has(i.id))
      .map(i => edits[i.id] ? { ...i, ...edits[i.id] } : i);
    return [...base, ...created];
  }, [items, edits, deletedIds, createdItems, sprint]);

  const areas = useMemo(() => [...new Set(items.map(i => i.area))].sort(), [items]);
  const areaColor = useMemo(() => {
    const m = {};
    areas.forEach((a, i) => { m[a] = AREA_COLORS[i % AREA_COLORS.length]; });
    return m;
  }, [areas]);
  const equipos = useMemo(() => [...new Set(items.map(i => i.equipo).filter(Boolean))].sort(), [items]);
  const tipos = useMemo(() => [...new Set(items.map(i => i.tipo).filter(Boolean))].sort(), [items]);
  const persons = useMemo(() => {
    const m = {};
    resolvedItems.forEach(i => (i.assignees || []).forEach(a => { if (!m[a.login]) m[a.login] = a; }));
    return Object.values(m).sort((a, b) => a.login.localeCompare(b.login));
  }, [resolvedItems]);

  const toggle = (arr, set, v) => set(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]);

  const filtered = useMemo(() => resolvedItems.filter(item => {
    if (stf.length && !stf.includes(item.status)) return false;
    if (sf.length && !sf.includes(item.size)) return false;
    if (af.length && !af.includes(item.area)) return false;
    if (ef.length && !ef.includes(item.equipo)) return false;
    if (tf.length && !tf.includes(item.tipo)) return false;
    if (pf.length && !(item.assignees || []).some(a => pf.includes(a.login))) return false;
    if (query) {
      const q = query.toLowerCase();
      if (!item.title.toLowerCase().includes(q) && !item.id.toLowerCase().includes(q)) return false;
    }
    return true;
  }), [resolvedItems, stf, sf, af, ef, tf, pf, query]);

  const byArea = useMemo(() => {
    const m = {};
    filtered.forEach(i => { (m[i.area] ??= []).push(i); });
    return m;
  }, [filtered]);

  const byStatus = useMemo(() => {
    const m = {};
    STATUSES.forEach(s => { m[s] = []; });
    filtered.forEach(i => { (m[i.status] ??= []).push(i); });
    return m;
  }, [filtered]);

  const areaMinId = useMemo(() => {
    const m = {};
    items.forEach(item => {
      const n = parseInt(item.id.match(/\.(\d+)$/)?.[1] ?? '9999', 10);
      if (!(item.area in m) || n < m[item.area]) m[item.area] = n;
    });
    return m;
  }, [items]);

  const areaStats = useMemo(() =>
    Object.entries(byArea)
      .sort(([a], [b]) => (areaMinId[a] ?? 9999) - (areaMinId[b] ?? 9999))
      .map(([area, its]) => ({
        area, total: its.length,
        done: its.filter(i => i.status === "Done").length,
        inProg: its.filter(i => i.status === "In progress").length,
        inRev: its.filter(i => i.status === "In review").length,
        ready: its.filter(i => i.status === "Ready").length,
        backlog: its.filter(i => i.status === "Backlog").length,
        totalH: its.reduce((s, i) => s + (SIZE_H_MAP[i.size] || 0), 0),
        items: its,
      }))
  , [byArea, areaMinId]);

  const stats = {
    total: filtered.length,
    inProgress: filtered.filter(i => i.status === "In progress").length,
    inReview: filtered.filter(i => i.status === "In review").length,
    done: filtered.filter(i => i.status === "Done").length,
  };

  const hasFilters = stf.length || sf.length || af.length || ef.length || tf.length || pf.length || query;
  const clearAll = () => { setStf([]); setSf([]); setAf([]); setEf([]); setTf([]); setPf([]); setQuery(""); };

  const nextIdForSprint = (sp) => {
    const prefix = `NX-S${sp}.`;
    const allIds = [
      ...BACKLOG.filter(i => i.sprint === sp).map(i => i.id),
      ...createdItems.filter(i => i.sprint === sp).map(i => i.id),
    ];
    const maxNum = allIds.reduce((mx, id) => {
      if (!id.startsWith(prefix)) return mx;
      const n = parseInt(id.slice(prefix.length), 10);
      return isNaN(n) ? mx : Math.max(mx, n);
    }, 0);
    return `${prefix}${String(maxNum + 1).padStart(2, '0')}`;
  };

  const mostCommonTipoForArea = (area) => {
    const areaItems = BACKLOG.filter(i => i.area === area && i.tipo);
    if (!areaItems.length) return null;
    const counts = {};
    areaItems.forEach(i => { counts[i.tipo] = (counts[i.tipo] || 0) + 1; });
    return Object.entries(counts).sort(([, a], [, b]) => b - a)[0]?.[0] || null;
  };

  const doDelete = (item) => {
    const next = new Set([...deletedIds, item.id]);
    setDeletedIds(next);
    try { localStorage.setItem('nexus_deleted_v1', JSON.stringify([...next])); } catch {}
  };

  const addCreatedItem = (item) => {
    const next = [...createdItems, item];
    setCreatedItems(next);
    try { localStorage.setItem('nexus_created_v1', JSON.stringify(next)); } catch {}
  };

  return {
    items, resolvedItems, filtered, byArea, byStatus, areaStats, stats,
    areas, areaColor, equipos, tipos, persons, areaMinId,
    edits, setEdits, deletedIds, createdItems,
    stf, setStf, sf, setSf, af, setAf, ef, setEf, tf, setTf, pf, setPf,
    query, setQuery, toggle, hasFilters, clearAll,
    nextIdForSprint, mostCommonTipoForArea, doDelete, addCreatedItem,
  };
}

export { STATUSES };
