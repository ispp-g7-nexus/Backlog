import { useState, useCallback } from 'react';

const STORAGE_KEY = 'nexus_activity_log_v1';
const MAX_ENTRIES = 500;

function loadLog() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
  catch { return []; }
}

function saveLog(entries) {
  const trimmed = entries.slice(0, MAX_ENTRIES);
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed)); } catch {}
  return trimmed;
}

export function useActivityLog() {
  const [log, setLog] = useState(loadLog);

  const addEntry = useCallback((taskId, field, oldValue, newValue) => {
    if (oldValue === newValue) return;
    const entry = {
      id: Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      taskId,
      field,
      oldValue: oldValue ?? null,
      newValue: newValue ?? null,
      timestamp: new Date().toISOString(),
    };
    setLog(prev => {
      const next = [entry, ...prev];
      return saveLog(next);
    });
  }, []);

  const getEntriesForTask = useCallback((taskId) => {
    return log.filter(e => e.taskId === taskId);
  }, [log]);

  const clearLog = useCallback(() => {
    setLog([]);
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  }, []);

  return { log, addEntry, getEntriesForTask, clearLog };
}
