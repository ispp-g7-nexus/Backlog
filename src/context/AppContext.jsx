import { createContext, useContext, useReducer, useCallback } from 'react';

const AppContext = createContext(null);

const initialState = {
  user: null,
  project: null,
  members: [],
  teams: [],
  sprints: [],
  backlogItems: [],
  filters: { sprint: null, status: null, team: null, search: '' },
  ui: { tab: 'project', lightMode: false, syncOpen: false, syncing: false, syncErr: '' },
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
    case 'SET_FILTERS': return { ...state, filters: { ...state.filters, ...action.payload } };
    case 'SET_UI': return { ...state, ui: { ...state.ui, ...action.payload } };
    case 'RESET': return { ...initialState, ui: state.ui };
    default: return state;
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const setUser = useCallback(u => dispatch({ type: 'SET_USER', payload: u }), []);
  const setProject = useCallback(p => dispatch({ type: 'SET_PROJECT', payload: p }), []);
  const setMembers = useCallback(m => dispatch({ type: 'SET_MEMBERS', payload: m }), []);
  const setTeams = useCallback(t => dispatch({ type: 'SET_TEAMS', payload: t }), []);
  const setSprints = useCallback(s => dispatch({ type: 'SET_SPRINTS', payload: s }), []);
  const setBacklog = useCallback(b => dispatch({ type: 'SET_BACKLOG', payload: b }), []);
  const updateItem = useCallback(item => dispatch({ type: 'UPDATE_ITEM', payload: item }), []);
  const addItem = useCallback(item => dispatch({ type: 'ADD_ITEM', payload: item }), []);
  const removeItem = useCallback(id => dispatch({ type: 'REMOVE_ITEM', payload: id }), []);
  const setFilters = useCallback(f => dispatch({ type: 'SET_FILTERS', payload: f }), []);
  const setUi = useCallback(u => dispatch({ type: 'SET_UI', payload: u }), []);

  const value = {
    ...state, dispatch,
    setUser, setProject, setMembers, setTeams, setSprints,
    setBacklog, updateItem, addItem, removeItem,
    setFilters, setUi,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
