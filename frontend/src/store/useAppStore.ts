import { create } from "zustand";
import { v4 as uuidv4 } from "uuid";
import {
  api,
  AppError,
  DbStatus,
  EnvironmentInfo,
  PythonResult,
  QueryResult,
  SavedQuery,
  SchemaCache,
} from "../api/client";

const SESSION_KEY = "crossql-session-id";
const THEME_KEY = "crossql-theme";
const PALETTE_KEY = "crossql-palette";
const TABS_KEY = "crossql-tabs";
const ACTIVE_TAB_KEY = "crossql-active-tab";
const TAB_COUNTER_KEY = "crossql-tab-counter";
const HISTORY_KEY = "crossql-history";
const MAX_HISTORY = 50;

function loadTabCounter(fallback: number): number {
  const raw = localStorage.getItem(TAB_COUNTER_KEY);
  const n = raw ? parseInt(raw, 10) : NaN;
  return isNaN(n) ? fallback : n;
}
function persistTabCounter(n: number) {
  localStorage.setItem(TAB_COUNTER_KEY, String(n));
}

function schemaKey(env: string) { return `crossql-schema-${env}`; }
function loadCachedSchema(env: string): SchemaCache | null {
  try {
    const raw = localStorage.getItem(schemaKey(env));
    return raw ? (JSON.parse(raw) as SchemaCache) : null;
  } catch { return null; }
}
function cacheSchema(env: string, schema: SchemaCache) {
  try { localStorage.setItem(schemaKey(env), JSON.stringify(schema)); } catch { /* ignore quota */ }
}

function getOrCreateSessionId(): string {
  const existing = localStorage.getItem(SESSION_KEY);
  if (existing) return existing;
  const id = uuidv4();
  localStorage.setItem(SESSION_KEY, id);
  return id;
}

// ── History ──────────────────────────────────────────────────────────────────

export interface HistoryEntry {
  sql: string;
  env: string | null;
  timestamp: string;
  rowCount: number | null;
  ms: number | null;
  success: boolean;
}

function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as HistoryEntry[]) : [];
  } catch { return []; }
}

function appendHistory(entry: HistoryEntry): HistoryEntry[] {
  const prev = loadHistory();
  const updated = [entry, ...prev].slice(0, MAX_HISTORY);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  return updated;
}

export type Theme = "dark" | "light";
export type Palette = "default" | "material" | "dracula" | "solarized" | "github" | "nightowl";

// ── Tab types ────────────────────────────────────────────────────────────────

export interface QueryTab {
  id: string;
  name: string;
  sql: string;
  dirty: boolean;
  savedQueryId?: string; // linked saved query (for "save" vs "save as")
}

function createTab(n?: number): QueryTab {
  return {
    id: uuidv4(),
    name: `query_${n ?? 1}.sql`,
    sql: "",
    dirty: false,
  };
}

function loadTabs(): { tabs: QueryTab[]; activeTabId: string } {
  try {
    const raw = localStorage.getItem(TABS_KEY);
    const activeId = localStorage.getItem(ACTIVE_TAB_KEY);
    if (raw) {
      const tabs = JSON.parse(raw) as QueryTab[];
      if (tabs.length > 0) {
        return { tabs, activeTabId: activeId && tabs.some(t => t.id === activeId) ? activeId : tabs[0].id };
      }
    }
  } catch { /* ignore */ }
  const tab = createTab(1);
  tab.sql = `-- Cross-DB query: use db_name.table notation
SELECT u.name, o.total, o.status
FROM users.users u
JOIN orders.orders o ON u.id = o.user_id
WHERE o.status = 'paid'
ORDER BY o.total DESC;`;
  return { tabs: [tab], activeTabId: tab.id };
}

function persistTabs(tabs: QueryTab[], activeTabId: string) {
  localStorage.setItem(TABS_KEY, JSON.stringify(tabs));
  localStorage.setItem(ACTIVE_TAB_KEY, activeTabId);
}

// ── Store ────────────────────────────────────────────────────────────────────

interface AppStore {
  // Environment state
  environments: EnvironmentInfo[];
  activeEnv: string | null;
  activeHost: string | null;
  dbStatus: DbStatus;
  schema: SchemaCache;
  discoveredDbs: string[];
  excludedDbs: string[];
  sessionId: string;

  // Tabs
  tabs: QueryTab[];
  activeTabId: string;
  tabCounter: number;
  queryResults: Record<string, QueryResult>;  // tabId → result
  queryErrors: Record<string, AppError>;      // tabId → error
  queryingTabs: Record<string, boolean>;      // tabId → isQuerying

  // Python
  pythonResults: Record<string, PythonResult>; // tabId → python result
  isPythonRunning: boolean;
  pythonOpen: boolean;

  // Theme
  theme: Theme;
  palette: Palette;

  // Saved queries + history
  savedQueries: SavedQuery[];
  history: HistoryEntry[];

  // Tab actions
  addTab: () => void;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  updateTabSql: (tabId: string, sql: string) => void;
  renameTab: (tabId: string, name: string) => void;

  // Environment actions
  loadEnvironments: () => Promise<void>;
  switchEnv: (env: string) => Promise<void>;
  reloadConfig: () => Promise<void>;

  // Query actions
  runQuery: (sql: string) => Promise<void>;
  runPython: (code: string) => Promise<void>;
  clearQueryError: () => void;

  // Saved query actions
  loadSavedQueries: () => Promise<void>;
  saveQuery: (name: string, sql: string, folder?: string) => Promise<SavedQuery>;
  updateSavedQuery: (id: string, patch: Partial<Pick<SavedQuery, "name" | "sql" | "folder">>) => Promise<void>;
  deleteSavedQuery: (id: string) => Promise<void>;
  openQueryInTab: (sql: string, name?: string) => void;

  // Theme actions
  setTheme: (theme: Theme) => void;
  setPalette: (palette: Palette) => void;
  setPythonOpen: (open: boolean) => void;
}

function applyTheme(theme: Theme, palette: Palette) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.dataset.palette = palette;
  localStorage.setItem(THEME_KEY, theme);
  localStorage.setItem(PALETTE_KEY, palette);
}

const initialTabs = loadTabs();

export const useAppStore = create<AppStore>((set, get) => ({
  environments: [],
  activeEnv: null,
  activeHost: null,
  dbStatus: {},
  schema: {},
  discoveredDbs: [],
  excludedDbs: [],
  sessionId: getOrCreateSessionId(),

  tabs: initialTabs.tabs,
  activeTabId: initialTabs.activeTabId,
  tabCounter: loadTabCounter(initialTabs.tabs.length),
  queryResults: {},
  queryErrors: {},
  queryingTabs: {},

  pythonResults: {},
  isPythonRunning: false,
  pythonOpen: false,

  savedQueries: [],
  history: loadHistory(),

  theme: (localStorage.getItem(THEME_KEY) as Theme) || "dark",
  palette: (localStorage.getItem(PALETTE_KEY) as Palette) || "default",

  // ── Tab actions ──────────────────────────────────────────────────────────

  addTab: () => {
    const { tabs, tabCounter } = get();
    if (tabs.length >= 10) return;
    const n = tabCounter + 1;
    const tab = createTab(n);
    const newTabs = [...tabs, tab];
    set({ tabs: newTabs, activeTabId: tab.id, tabCounter: n });
    persistTabs(newTabs, tab.id);
    persistTabCounter(n);
  },

  closeTab: (tabId: string) => {
    const { tabs, activeTabId } = get();
    if (tabs.length <= 1) {
      // Replace with a fresh tab
      const fresh = createTab(1);
      set({ tabs: [fresh], activeTabId: fresh.id });
      persistTabs([fresh], fresh.id);
      return;
    }
    const idx = tabs.findIndex(t => t.id === tabId);
    const newTabs = tabs.filter(t => t.id !== tabId);
    let newActiveId = activeTabId;
    if (activeTabId === tabId) {
      newActiveId = newTabs[Math.min(idx, newTabs.length - 1)].id;
    }
    set({ tabs: newTabs, activeTabId: newActiveId });
    persistTabs(newTabs, newActiveId);
  },

  setActiveTab: (tabId: string) => {
    set({ activeTabId: tabId });
    localStorage.setItem(ACTIVE_TAB_KEY, tabId);
  },

  updateTabSql: (tabId: string, sql: string) => {
    const newTabs = get().tabs.map(t =>
      t.id === tabId ? { ...t, sql, dirty: true } : t
    );
    set({ tabs: newTabs });
    persistTabs(newTabs, get().activeTabId);
  },

  renameTab: (tabId: string, name: string) => {
    const newTabs = get().tabs.map(t =>
      t.id === tabId ? { ...t, name } : t
    );
    set({ tabs: newTabs });
    persistTabs(newTabs, get().activeTabId);
  },

  // ── Environment actions ──────────────────────────────────────────────────

  loadEnvironments: async () => {
    try {
      const res = await api.getEnvironments();
      set({ environments: res.environments });
      const targetEnv = res.active || res.environments[0]?.name;
      if (targetEnv && !get().activeEnv) {
        await get().switchEnv(targetEnv);
      }
      get().loadSavedQueries();
    } catch (err) {
      console.error("Failed to load environments:", err);
    }
  },

  switchEnv: async (env: string) => {
    try {
      const res = await api.switchEnv(env);

      // Apply cached schema immediately for instant sidebar display
      const cached = loadCachedSchema(env);
      set({
        activeEnv: res.env,
        activeHost: res.host,
        dbStatus: res.status,
        schema: cached ?? res.db_schema,
        discoveredDbs: res.discovered_dbs,
        excludedDbs: res.excluded_dbs,
        queryResults: {},
        queryErrors: {},
        pythonResults: {},
      });

      // If backend already returned schema (from lifespan fetch), use and cache it
      if (Object.keys(res.db_schema).length > 0) {
        cacheSchema(env, res.db_schema);
        set({ schema: res.db_schema });
      } else {
        // Fetch schema in background (lazy pool creation happens here)
        api.getSchema().then((schemaRes) => {
          const schema = schemaRes.schema_;
          cacheSchema(env, schema);
          set({ schema });
        }).catch(console.error);
      }
    } catch (err) {
      console.error("Failed to switch environment:", err);
    }
  },

  reloadConfig: async () => {
    try {
      const res = await api.reloadConfig();
      if (Object.keys(res.db_schema).length > 0) {
        cacheSchema(res.env, res.db_schema);
      }
      set({
        activeEnv: res.env,
        activeHost: res.host,
        dbStatus: res.status,
        schema: res.db_schema,
        discoveredDbs: res.discovered_dbs,
        excludedDbs: res.excluded_dbs,
      });
      const envRes = await api.getEnvironments();
      set({ environments: envRes.environments });
    } catch (err) {
      console.error("Failed to reload config:", err);
    }
  },

  // ── Saved query actions ──────────────────────────────────────────────────

  loadSavedQueries: async () => {
    try {
      const res = await api.getQueries();
      set({ savedQueries: res.queries });
    } catch (e) {
      console.error("Failed to load saved queries:", e);
    }
  },

  saveQuery: async (name: string, sql: string, folder = "") => {
    const q = await api.createQuery(name, sql, folder);
    set(s => ({ savedQueries: [...s.savedQueries, q] }));
    return q;
  },

  updateSavedQuery: async (id: string, patch) => {
    const q = await api.updateQuery(id, patch);
    set(s => ({ savedQueries: s.savedQueries.map(sq => sq.id === id ? q : sq) }));
  },

  deleteSavedQuery: async (id: string) => {
    await api.deleteQuery(id);
    set(s => ({ savedQueries: s.savedQueries.filter(sq => sq.id !== id) }));
  },

  openQueryInTab: (sql: string, name?: string) => {
    const { tabs, addTab } = get();
    if (tabs.length < 10) {
      addTab();
    }
    // After addTab, the new tab is active — update its SQL
    const { activeTabId } = get();
    const newTabs = get().tabs.map(t =>
      t.id === activeTabId ? { ...t, sql, name: name ?? t.name, dirty: false } : t
    );
    set({ tabs: newTabs });
    persistTabs(newTabs, activeTabId);
  },

  // ── Query actions ────────────────────────────────────────────────────────

  runQuery: async (sql: string) => {
    const { activeTabId, sessionId, activeEnv } = get();
    const compositeSession = `${sessionId}:${activeTabId}`;
    const startMs = Date.now();

    set(s => ({
      queryingTabs: { ...s.queryingTabs, [activeTabId]: true },
      queryErrors: { ...s.queryErrors, [activeTabId]: undefined as unknown as AppError },
      queryResults: { ...s.queryResults, [activeTabId]: undefined as unknown as QueryResult },
      pythonResults: { ...s.pythonResults, [activeTabId]: undefined as unknown as PythonResult },
    }));

    try {
      const result = await api.runQuery(sql, compositeSession);
      if ("code" in result) {
        const entry: HistoryEntry = { sql, env: activeEnv, timestamp: new Date().toISOString(), rowCount: null, ms: Date.now() - startMs, success: false };
        const history = appendHistory(entry);
        set(s => ({
          queryErrors: { ...s.queryErrors, [activeTabId]: result as AppError },
          queryingTabs: { ...s.queryingTabs, [activeTabId]: false },
          history,
        }));
        return;
      }
      const qr = result as QueryResult;
      const entry: HistoryEntry = { sql, env: activeEnv, timestamp: new Date().toISOString(), rowCount: qr.row_count, ms: qr.timing.total_ms, success: true };
      const history = appendHistory(entry);
      set(s => ({
        queryResults: { ...s.queryResults, [activeTabId]: qr },
        queryingTabs: { ...s.queryingTabs, [activeTabId]: false },
        history,
      }));
    } catch (err: unknown) {
      const appErr = (err && typeof err === "object" && "code" in err)
        ? err as AppError
        : { error: String(err), detail: "", code: "CONNECTION_ERROR" as const };
      const entry: HistoryEntry = { sql, env: activeEnv, timestamp: new Date().toISOString(), rowCount: null, ms: Date.now() - startMs, success: false };
      const history = appendHistory(entry);
      set(s => ({
        queryErrors: { ...s.queryErrors, [activeTabId]: appErr },
        queryingTabs: { ...s.queryingTabs, [activeTabId]: false },
        history,
      }));
    }
  },

  runPython: async (code: string) => {
    const { activeTabId, sessionId } = get();
    const compositeSession = `${sessionId}:${activeTabId}`;

    set({ isPythonRunning: true });
    try {
      const result = await api.runPython(code, compositeSession);
      set(s => ({
        pythonResults: { ...s.pythonResults, [activeTabId]: result },
        isPythonRunning: false,
      }));
    } catch (err) {
      set(s => ({
        pythonResults: { ...s.pythonResults, [activeTabId]: { output: "", error: String(err) } },
        isPythonRunning: false,
      }));
    }
  },

  clearQueryError: () => {
    const { activeTabId } = get();
    set(s => ({
      queryErrors: { ...s.queryErrors, [activeTabId]: undefined as unknown as AppError },
    }));
  },

  setTheme: (theme: Theme) => {
    set({ theme });
    applyTheme(theme, get().palette);
  },

  setPalette: (palette: Palette) => {
    set({ palette });
    applyTheme(get().theme, palette);
  },

  setPythonOpen: (open: boolean) => set({ pythonOpen: open }),
}));
