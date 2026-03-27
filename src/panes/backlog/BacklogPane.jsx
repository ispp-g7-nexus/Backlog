import { useState, useEffect } from 'react';
import { SC } from '../../constants.js';
import { STATUS_META } from '../../constants.js';
import { SizeBadge, StatusBadge } from '../../components/badges.jsx';
import { SPRINTS, BACKLOG } from '../../data.js';
import { useBacklogItems, STATUSES } from './hooks/useBacklogItems.js';
import { useInlineEdit } from './hooks/useInlineEdit.js';
import { useActivityLog } from './hooks/useActivityLog.js';
import FilterBar from './components/FilterBar.jsx';
import CreateTaskModal from './components/CreateTaskModal.jsx';
import TableView from './views/TableView.jsx';
import KanbanView from './views/KanbanView.jsx';
import RoadmapView from './views/RoadmapView.jsx';
import ItemDetailDrawer from './components/ItemDetailDrawer.jsx';
import BulkActionBar from './components/BulkActionBar.jsx';

export default function BacklogPane({ sprint }) {
  const sc = sprint ? SC[sprint] : null;
  const [view, setView] = useState("tabla");
  const [open, setOpen] = useState({});
  const toggleOpen = (id) => setOpen(p => ({ ...p, [id]: !p[id] }));
  const [hoveredRow, setHoveredRow] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [createModal, setCreateModal] = useState(null);
  const [fieldDropdown, setFieldDropdown] = useState(null);
  const [fieldDropPos, setFieldDropPos] = useState({ top: 0, left: 0 });
  const [drawerItem, setDrawerItem] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState('asc');

  const backlog = useBacklogItems(sprint);
  const editRaw = useInlineEdit(backlog.items, backlog.edits, backlog.setEdits);
  const activityLog = useActivityLog();

  const edit = {
    ...editRaw,
    commitEdit: (id, field) => {
      const item = backlog.resolvedItems.find(i => i.id === id);
      const oldVal = item ? item[field] : null;
      const newVal = field === 'estimate'
        ? (editRaw.editValRef.current === '' ? null : Number(editRaw.editValRef.current))
        : (editRaw.editValRef.current === '' ? null : editRaw.editValRef.current);
      activityLog.addEntry(id, field, oldVal, newVal);
      editRaw.commitEdit(id, field);
    },
  };

  const allEquipos = Object.keys(edit.schemaFields['Equipo']?.options || {}).sort();
  const allTipos = Object.keys(edit.schemaFields['Tipo']?.options || {}).sort();

  useEffect(() => {
    if (!fieldDropdown) return;
    const close = () => setFieldDropdown(null);
    setTimeout(() => document.addEventListener('click', close), 0);
    window.addEventListener('scroll', close, true);
    return () => { document.removeEventListener('click', close); window.removeEventListener('scroll', close, true); };
  }, [fieldDropdown]);

  const editProps = { ...edit, edits: backlog.edits, setEdits: backlog.setEdits, setFieldDropdown, setFieldDropPos };

  const handleStatusChange = (item, newStatus) => {
    edit.editValRef.current = newStatus;
    edit.commitEdit(item.id, 'status');
  };

  const handleCardClick = (item) => {
    const resolved = backlog.resolvedItems.find(i => i.id === item.id) || item;
    setDrawerItem(resolved);
  };

  const toggleSelect = (id) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const selectAll = () => {
    const allIds = backlog.filtered.map(i => i.id);
    setSelected(prev => prev.size === allIds.length ? new Set() : new Set(allIds));
  };

  const bulkChangeField = (field, value) => {
    selected.forEach(id => {
      edit.editValRef.current = value;
      edit.commitEdit(id, field);
    });
    setSelected(new Set());
  };

  const bulkDelete = () => {
    selected.forEach(id => {
      const item = backlog.resolvedItems.find(i => i.id === id);
      if (item) backlog.doDelete(item);
    });
    setSelected(new Set());
  };

  const handleSort = (col) => {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  };

  const emptyState = (
    <div className="card" style={{ padding: 48, textAlign: "center", color: "var(--tx4)" }}>
      Sin resultados para los filtros seleccionados
    </div>
  );

  return (
    <div>
      {/* Banner */}
      <div className="card" style={{ borderColor: `${sc ? sc.color : "#6366f1"}25`, marginBottom: 12, display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: sc ? sc.color : "#6366f1", boxShadow: `0 0 8px ${sc ? sc.color : "#6366f1"}` }} />
            <span style={{ color: sc ? sc.color : "#818cf8", fontWeight: 800, fontSize: 14 }}>{sc ? sc.label : "Todo el proyecto"}</span>
            {sc && <span className="text-muted text-sm">{sc.date}</span>}
          </div>
          <div className="text-muted text-sm">
            {sprint === null && `${SPRINTS.length} sprints · ${BACKLOG.length} historias de usuario`}
            {sprint === 1 && "Core del MVP + infraestructura base"}
            {sprint === 2 && "MVP v1 completo · ciclo de mejora continua · pilotaje"}
            {sprint === 3 && "MVP v2 · diferenciadores · matching IA · marketing"}
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {[
            { l: "Total", val: backlog.stats.total, c: "var(--tx0)" },
            { l: "En curso", val: backlog.stats.inProgress, c: "#6ee7b7" },
            { l: "En revisión", val: backlog.stats.inReview, c: "#c4b5fd" },
            { l: "Hecho", val: backlog.stats.done, c: "#34d399" },
          ].map(s => (
            <div key={s.l} style={{ background: "var(--bg0)", border: "1px solid var(--bdr)", borderRadius: 8, padding: "6px 12px", textAlign: "center", minWidth: 48 }}>
              <div style={{ color: s.c, fontSize: 17, fontWeight: 800, lineHeight: 1 }}>{s.val}</div>
              <div className="text-dim text-xs" style={{ marginTop: 2 }}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <FilterBar
        {...backlog} view={view} setView={setView}
      />

      {/* Views */}
      {view === "tabla" && (
        Object.keys(backlog.byArea).length === 0 ? emptyState : (
          <TableView
            byArea={backlog.byArea} areaMinId={backlog.areaMinId} areaColor={backlog.areaColor}
            editProps={editProps} setCreateModal={setCreateModal} sprint={sprint}
            open={open} toggleOpen={toggleOpen} hoveredRow={hoveredRow} setHoveredRow={setHoveredRow}
            deleteConfirm={deleteConfirm} setDeleteConfirm={setDeleteConfirm}
            sf={backlog.sf} tf={backlog.tf} ef={backlog.ef}
            toggle={backlog.toggle} setSf={backlog.setSf} setTf={backlog.setTf} setEf={backlog.setEf}
            onRowClick={handleCardClick}
            selected={selected} toggleSelect={toggleSelect} selectAll={selectAll}
            sortCol={sortCol} sortDir={sortDir} onSort={handleSort}
          />
        )
      )}

      {view === "tablero" && (
        backlog.filtered.length === 0 ? emptyState : (
          <KanbanView
            byStatus={backlog.byStatus} areaColor={backlog.areaColor}
            sf={backlog.sf} setSf={backlog.setSf} ef={backlog.ef} setEf={backlog.setEf}
            tf={backlog.tf} setTf={backlog.setTf} pf={backlog.pf} setPf={backlog.setPf}
            toggle={backlog.toggle}
            onStatusChange={handleStatusChange}
            onCardClick={handleCardClick}
          />
        )
      )}

      {view === "roadmap" && (
        backlog.areaStats.length === 0 ? emptyState : (
          <RoadmapView areaStats={backlog.areaStats} areaColor={backlog.areaColor} sprint={sprint} sc={sc} onCardClick={handleCardClick} />
        )
      )}

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <BulkActionBar
          count={selected.size}
          onChangeField={bulkChangeField}
          onDelete={bulkDelete}
          onClear={() => setSelected(new Set())}
        />
      )}

      {/* Legend (tabla) */}
      {view === "tabla" && (
        <div className="grid grid-2 gap-2 mt-4">
          <div className="card">
            <div className="text-dim text-xs mb-2" style={{ textTransform: "uppercase", letterSpacing: ".07em" }}>Estado del Kanban</div>
            <div className="flex flex-wrap gap-1">
              {Object.keys(STATUS_META).map(k => <StatusBadge key={k} s={k} />)}
            </div>
          </div>
          <div className="card">
            <div className="text-dim text-xs mb-2" style={{ textTransform: "uppercase", letterSpacing: ".07em" }}>Tallas (estimación orientativa)</div>
            <div className="flex flex-wrap gap-1">
              {[["XS", "~2h"], ["S", "~4h"], ["M", "~8h"], ["L", "~16h"], ["XL", "~30h+"]].map(([s, h]) => (
                <div key={s} className="flex items-center gap-1">
                  <SizeBadge s={s} />
                  <span className="text-muted text-xs">{h}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Field dropdown */}
      {fieldDropdown && (() => {
        const { id, field } = fieldDropdown;
        const fdItem = backlog.resolvedItems.find(i => i.id === id);
        const curVal = fdItem ? String(edit.getVal(fdItem, field) ?? '') : '';
        let options = [];
        if (field === 'status') options = STATUSES;
        if (field === 'size') options = ['XS', 'S', 'M', 'L', 'XL'];
        if (field === 'equipo') options = ['', ...allEquipos];
        if (field === 'tipo') options = ['', ...allTipos];
        return (
          <div className="dropdown-menu" onClick={e => e.stopPropagation()}
            style={{ position: 'fixed', top: fieldDropPos.top, left: fieldDropPos.left, zIndex: 9999, minWidth: 130, maxHeight: 220, overflowY: 'auto' }}>
            {options.map(opt => {
              const isCur = opt === curVal || (opt === '' && curVal === '');
              return (
                <button key={opt || '_empty'}
                  onClick={() => { edit.editValRef.current = opt; edit.commitEdit(id, field); setFieldDropdown(null); }}
                  className={`dropdown-item ${isCur ? 'active' : ''}`}>
                  {opt || '—'}
                </button>
              );
            })}
          </div>
        );
      })()}

      {/* Create modal */}
      {createModal && (
        <CreateTaskModal
          sprint={createModal.sprint} area={createModal.area}
          nextId={backlog.nextIdForSprint(createModal.sprint)}
          defaultTipo={backlog.mostCommonTipoForArea(createModal.area)}
          allEquipos={allEquipos} allTipos={allTipos} statuses={STATUSES}
          onClose={() => setCreateModal(null)}
          onCreated={item => { backlog.addCreatedItem(item); setCreateModal(null); }}
        />
      )}

      {/* Item Detail Drawer */}
      {drawerItem && (
        <ItemDetailDrawer
          item={drawerItem}
          onClose={() => setDrawerItem(null)}
          editProps={editProps}
          allEquipos={allEquipos}
          allTipos={allTipos}
          areaColor={backlog.areaColor}
          activityEntries={activityLog.getEntriesForTask(drawerItem.id)}
        />
      )}

      {/* Delete confirm */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 360 }}>
            <div className="font-bold text-lg mb-2" style={{ color: 'var(--tx0)' }}>¿Eliminar tarea?</div>
            <div className="text-muted mb-4">{deleteConfirm.id} — {deleteConfirm.title}</div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteConfirm(null)} className="btn">Cancelar</button>
              <button onClick={() => { backlog.doDelete(deleteConfirm); setDeleteConfirm(null); }} className="btn btn-danger" style={{ background: '#dc2626', color: '#fff', borderColor: '#dc2626' }}>Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
