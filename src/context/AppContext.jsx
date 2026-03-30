import { createContext, useContext, useReducer, useCallback, useEffect } from 'react';
import { fetchUser, fetchProjects, fetchConfig } from '../api/backend.js';
import { CACHE_KEYS, getJson, setJson, remove } from '../lib/cache.js';
import { detectCurrentSprint } from '../lib/utils.js';

const AppContext = createContext(null);

const initialState = {
  user: null,
  project: null,
  members: [],
  teams: [],
  sprints: [],
  backlogItems: [],
  activeSprint: detectCurrentSprint(),
  filters: { sprint: null, status: null, team: null, search: '' },
  ui: { tab: 'project', lightMode: false, syncOpen: false, syncing: false, syncErr: '' },
  loading: false,
  error: null,
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET_USER': return { ...state, user: action.payload };
    case 'SET_PROJECT': return { ...state, project: action.payload };
    case 'SET_MEMBERS': return { ...state, members: action.payload };
    case 'SET_TEAMS': return { ...state, teams: action.payload };
    case 'SET_SPRINTS': return { ...state, sprints: action.payload };
    case 'SET_BACKLOG': return { ...state, backlogItems: action.payload };
    case 'UPDATE_ITEM': return { ...state, backlogItems: state.backlogItems.map(i => i.id === action.payload.id ? { ...i, ...action.payload } : i) };
    case 'ADD_ITEM': return { ...state, backlogItems: [action.payload, ...state.backlogItems] };
    case 'REMOVE_ITEM': return { ...state, backlogItems: state.backlogItems.filter(i => i.id !== action.payload) };
    case 'SET_SPRINT': return { ...state, activeSprint: action.payload };
    case 'SET_FILTERS': return { ...state, filters: { ...state.filters, ...action.payload } };
    case 'SET_UI': return { ...state, ui: { ...state.ui, ...action.payload } };
    case 'SET_LOADING': return { ...state, loading: action.payload };
    case 'SET_ERROR': return { ...state, error: action.payload };
    case 'RESET': return { ...initialState, ui: state.ui };
    default: return state;
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Captura JWT del redirect OAuth y trata de autenticar contra el backend
  useEffect(() => {
    // Capturar ?token= del redirect OAuth
    const params = new URLSearchParams(window.location.search);
    const jwtParam = params.get('token');
    if (jwtParam) {
      localStorage.setItem(CACHE_KEYS.JWT, jwtParam);
      window.history.replaceState({}, '', window.location.pathname);
    }
    const jwt = localStorage.getItem(CACHE_KEYS.JWT);
    if (!jwt) return;
    dispatch({ type: 'SET_LOADING', payload: true });
    fetchUser()
      .then(async u => {
        dispatch({ type: 'SET_USER', payload: u });
        try {
          const projects = await fetchProjects();
          const savedPid = localStorage.getItem(CACHE_KEYS.PROJECT_ID);
          const project = savedPid
            ? (projects.find(p => p.id === savedPid) || projects[0])
            : projects[0];
          if (project) {
            dispatch({ type: 'SET_PROJECT', payload: project });
            localStorage.setItem(CACHE_KEYS.PROJECT_ID, project.id);
            try {
              const cfg = await fetchConfig(project.id);
              if (cfg && Object.keys(cfg).length > 0) {
                const existing = getJson(CACHE_KEYS.SETTINGS, {});
                setJson(CACHE_KEYS.SETTINGS, { ...existing, ...cfg });
              }
            } catch { /* config opcional */ }
          }
        } catch { /* sin backend disponible */ }
      })
      .catch(e => {
        remove(CACHE_KEYS.JWT);
        dispatch({ type: 'SET_ERROR', payload: e.message });
      })
      .finally(() => dispatch({ type: 'SET_LOADING', payload: false }));
    const onExpired = () => {
      remove(CACHE_KEYS.JWT);
      dispatch({ type: 'SET_USER', payload: null });
    };
    window.addEventListener('nexus:auth-expired', onExpired);
    return () => window.removeEventListener('nexus:auth-expired', onExpired);
  }, []);

  const setUser = useCallback(u => dispatch({ type: 'SET_USER', payload: u }), []);
  const setProject = useCallback(p => dispatch({ type: 'SET_PROJECT', payload: p }), []);
  const setMembers = useCallback(m => dispatch({ type: 'SET_MEMBERS', payload: m }), []);
  const setTeams = useCallback(t => dispatch({ type: 'SET_TEAMS', payload: t }), []);
  const setSprints = useCallback(s => dispatch({ type: 'SET_SPRINTS', payload: s }), []);
  const setBacklog = useCallback(b => dispatch({ type: 'SET_BACKLOG', payload: b }), []);
  const updateItem = useCallback(item => dispatch({ type: 'UPDATE_ITEM', payload: item }), []);
  const addItem = useCallback(item => dispatch({ type: 'ADD_ITEM', payload: item }), []);
  const removeItem = useCallback(id => dispatch({ type: 'REMOVE_ITEM', payload: id }), []);
  const setActiveSprint = useCallback(s => dispatch({ type: 'SET_SPRINT', payload: s }), []);
  const setFilters = useCallback(f => dispatch({ type: 'SET_FILTERS', payload: f }), []);
  const setUi = useCallback(u => dispatch({ type: 'SET_UI', payload: u }), []);
  const setLoading = useCallback(v => dispatch({ type: 'SET_LOADING', payload: v }), []);
  const setError = useCallback(e => dispatch({ type: 'SET_ERROR', payload: e }), []);

  const value = {
    ...state, dispatch,
    setUser, setProject, setMembers, setTeams, setSprints, setActiveSprint,
    setBacklog, updateItem, addItem, removeItem,
    setFilters, setUi, setLoading, setError,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
