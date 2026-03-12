import { useState, useMemo } from 'react';
import { BACKLOG } from '../data.js';
import { AREA_COLORS } from '../constants.js';

/**
 * Hook para gestionar la lógica del backlog: filtros, búsqueda, y cálculos
 * @param {number} sprint - Número del sprint a filtrar
 * @returns {Object} { items, areas, areaColor, areaMinId, filtered, stats, ... }
 */
export function useBacklogData(sprint) {
  const [statusFilter, setStatusFilter] = useState([]);
  const [sizeFilter, setSizeFilter] = useState([]);
  const [areaFilter, setAreaFilter] = useState([]);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState({});

  const toggleOpen = (id) => setOpen(p => ({ ...p, [id]: !p[id] }));

  // Items del sprint
  const items = useMemo(() => BACKLOG.filter(i => i.sprint === sprint), [sprint]);

  // Áreas y sus colores
  const areas = useMemo(() => [...new Set(items.map(i => i.area))].sort(), [items]);
  const areaColor = useMemo(() => {
    const m = {};
    areas.forEach((a, i) => { m[a] = AREA_COLORS[i % AREA_COLORS.length]; });
    return m;
  }, [areas]);

  // Orden dinámico de áreas por ID más bajo
  const areaMinId = useMemo(() => {
    const m = {};
    items.forEach(item => {
      const n = parseInt(item.id.match(/\.(\d+)$/)?.[1] ?? '9999', 10);
      if (!(item.area in m) || n < m[item.area]) m[item.area] = n;
    });
    return m;
  }, [items]);

  // Filtrar items
  const toggle = (arr, set, v) => set(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]);
  const filtered = useMemo(() => items.filter(item => {
    if (statusFilter.length && !statusFilter.includes(item.status)) return false;
    if (sizeFilter.length && !sizeFilter.includes(item.size)) return false;
    if (areaFilter.length && !areaFilter.includes(item.area)) return false;
    if (query) {
      const q = query.toLowerCase();
      if (!item.title.toLowerCase().includes(q) && !item.id.toLowerCase().includes(q)) return false;
    }
    return true;
  }), [items, statusFilter, sizeFilter, areaFilter, query]);

  // Agrupar por área
  const byArea = useMemo(() => {
    const m = {};
    filtered.forEach(i => { (m[i.area] ??= []).push(i); });
    return m;
  }, [filtered]);

  // Estadísticas
  const stats = {
    total: filtered.length,
    inProgress: filtered.filter(i => i.status === "In progress").length,
    inReview: filtered.filter(i => i.status === "In review").length,
    done: filtered.filter(i => i.status === "Done").length,
  };

  const hasFilters = statusFilter.length || sizeFilter.length || areaFilter.length || query;
  const clearAll = () => {
    setStatusFilter([]);
    setSizeFilter([]);
    setAreaFilter([]);
    setQuery("");
  };

  return {
    items,
    areas,
    areaColor,
    areaMinId,
    filtered,
    byArea,
    stats,
    hasFilters,
    open,
    toggleOpen,
    // Filters
    statusFilter,
    setStatusFilter,
    sizeFilter,
    setSizeFilter,
    areaFilter,
    setAreaFilter,
    query,
    setQuery,
    toggle,
    clearAll,
  };
}
