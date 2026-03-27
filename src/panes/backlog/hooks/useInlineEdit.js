import { useState, useRef, useEffect } from 'react';
import { updateIssueTitle, updateProjectField, fetchProjectSchema } from '../../../api/github.js';

const FIELD_GH_MAP = {
  status: 'Status', size: 'Size', equipo: 'Equipo', tipo: 'Tipo',
  startDate: 'Start date', targetDate: 'Target date', estimate: 'Estimate',
};

export function useInlineEdit(items, edits, setEdits) {
  const [editing, setEditing] = useState(null);
  const editValRef = useRef('');
  const [editVal, setEditValState] = useState('');
  const setEditVal = (v) => { editValRef.current = v; setEditValState(v); };
  const [saved, setSaved] = useState(null);
  const [hovered, setHovered] = useState(null);
  const [syncing, setSyncing] = useState(null);
  const [syncErr, setSyncErr] = useState(null);
  const [schemaFields, setSchemaFields] = useState(() => {
    try { return JSON.parse(localStorage.getItem('nexus_project_schema_v1') || 'null')?.fields || {}; } catch { return {}; }
  });

  useEffect(() => {
    if (Object.keys(schemaFields).length > 0) return;
    const token = localStorage.getItem('nexus_gh_token');
    if (!token) return;
    fetchProjectSchema(token).then(s => setSchemaFields(s.fields)).catch(() => {});
  }, []);

  const getVal = (item, field) => edits[item.id]?.[field] ?? item[field];

  const startEdit = (e, id, field, cur) => {
    e.stopPropagation();
    setEditing({ id, field });
    const initVal = cur != null ? String(cur) : '';
    editValRef.current = initVal;
    setEditValState(initVal);
  };

  const commitEdit = (id, field) => {
    const raw = editValRef.current;
    const v = field === 'estimate' ? (raw === '' ? null : Number(raw)) : (raw === '' ? null : raw);
    const next = { ...edits, [id]: { ...(edits[id] || {}), [field]: v } };
    setEdits(next);
    try { localStorage.setItem('nexus_edits_v1', JSON.stringify(next)); } catch {}
    try {
      const liveRaw = localStorage.getItem('nexus_live_data');
      if (liveRaw) {
        const live = JSON.parse(liveRaw);
        const raw2 = live.items.find(i => { const m = i.title?.match(/^\[([^\]]+)\]/); return m?.[1] === id; });
        if (raw2) {
          if (field === 'title') { const pfx = raw2.title.match(/^(\[[^\]]+\]\s*)/)?.[1] ?? ''; raw2.title = pfx + (v ?? ''); }
          else { raw2[field] = v; }
          localStorage.setItem('nexus_live_data', JSON.stringify(live));
        }
      }
    } catch {}
    setEditing(null);
    setSaved({ id, field });
    setTimeout(() => setSaved(p => p?.id === id && p?.field === field ? null : p), 1600);

    const token = localStorage.getItem('nexus_gh_token');
    if (token && v != null) {
      let syncPromise = null;
      if (field === 'title') {
        const item = items.find(i => i.id === id);
        if (item?.url) syncPromise = updateIssueTitle(token, item.url, id, v);
      } else if (FIELD_GH_MAP[field]) {
        try {
          const liveRaw = localStorage.getItem('nexus_live_data');
          if (liveRaw) {
            const nodeId = JSON.parse(liveRaw).items
              .find(i => i.title?.match(/^\[([^\]]+)\]/)?.[1] === id)?.id;
            if (nodeId) syncPromise = updateProjectField(token, nodeId, FIELD_GH_MAP[field], v);
          }
        } catch {}
      }
      if (syncPromise) {
        setSyncing({ id, field });
        setSyncErr(null);
        syncPromise
          .then(() => setSyncing(null))
          .catch(err => {
            setSyncing(null);
            setSyncErr({ id, field, msg: err.message });
            setTimeout(() => setSyncErr(p => p?.id === id ? null : p), 4000);
          });
      }
    }
  };

  return {
    editing, editVal, setEditVal, saved, hovered, setHovered, syncing, setSyncing, syncErr, setSyncErr,
    schemaFields, getVal, startEdit, commitEdit, setEditing, editValRef,
  };
}
