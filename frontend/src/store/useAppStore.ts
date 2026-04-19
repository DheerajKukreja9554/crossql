import { create } from "zustand";
import { v4 as uuidv4 } from "uuid";
import {
  api,
  AppError,
  DbStatus,
  EnvironmentInfo,
  PythonResult,
  QueryResult,
  SchemaCache,
} from "../api/client";

const SESSION_KEY = "crossql-session-id";
const THEME_KEY = "crossql-theme";
const PALETTE_KEY = "crossql-palette";

function getOrCreateSessionId(): string {
  const existing = localStorage.getItem(SESSION_KEY);
  if (existing) return existing;
  const id = uuidv4();
  localStorage.setItem(SESSION_KEY, id);
  return id;
}

export type Theme = "dark" | "light";
export type Palette = "default" | "material" | "dracula" | "solarized" | "github" | "nightowl";

interface AppStore {
  // State
  environments: EnvironmentInfo[];
  activeEnv: string | null;
  activeHost: string | null;
  dbStatus: DbStatus;
  schema: SchemaCache;
  discoveredDbs: string[];
  excludedDbs: string[];
  sessionId: string;
  queryResult: QueryResult | null;
  isQuerying: boolean;
  queryError: AppError | null;
  pythonResult: PythonResult | null;
  isPythonRunning: boolean;
  pythonOpen: boolean;

  // Theme
  theme: Theme;
  palette: Palette;

  // Actions
  loadEnvironments: () => Promise<void>;
  switchEnv: (env: string) => Promise<void>;
  reloadConfig: () => Promise<void>;
  runQuery: (sql: string) => Promise<void>;
  runPython: (code: string) => Promise<void>;
  clearQueryError: () => void;
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

export const useAppStore = create<AppStore>((set, get) => ({
  environments: [],
  activeEnv: null,
  activeHost: null,
  dbStatus: {},
  schema: {},
  discoveredDbs: [],
  excludedDbs: [],
  sessionId: getOrCreateSessionId(),
  queryResult: null,
  isQuerying: false,
  queryError: null,
  pythonResult: null,
  isPythonRunning: false,
  pythonOpen: false,

  theme: (localStorage.getItem(THEME_KEY) as Theme) || "dark",
  palette: (localStorage.getItem(PALETTE_KEY) as Palette) || "default",

  loadEnvironments: async () => {
    try {
      const res = await api.getEnvironments();
      set({ environments: res.environments });

      // Auto-switch to active env or first env
      const targetEnv = res.active || res.environments[0]?.name;
      if (targetEnv && !get().activeEnv) {
        await get().switchEnv(targetEnv);
      }
    } catch (err) {
      console.error("Failed to load environments:", err);
    }
  },

  switchEnv: async (env: string) => {
    try {
      const res = await api.switchEnv(env);
      set({
        activeEnv: res.env,
        activeHost: res.host,
        dbStatus: res.status,
        schema: res.db_schema,
        discoveredDbs: res.discovered_dbs,
        excludedDbs: res.excluded_dbs,
        queryResult: null,
        queryError: null,
        pythonResult: null,
      });
    } catch (err) {
      console.error("Failed to switch environment:", err);
    }
  },

  reloadConfig: async () => {
    try {
      const res = await api.reloadConfig();
      set({
        activeEnv: res.env,
        activeHost: res.host,
        dbStatus: res.status,
        schema: res.db_schema,
        discoveredDbs: res.discovered_dbs,
        excludedDbs: res.excluded_dbs,
      });
      // Reload environments list too
      const envRes = await api.getEnvironments();
      set({ environments: envRes.environments });
    } catch (err) {
      console.error("Failed to reload config:", err);
    }
  },

  runQuery: async (sql: string) => {
    set({ isQuerying: true, queryError: null, queryResult: null, pythonResult: null });
    try {
      const result = await api.runQuery(sql, get().sessionId);
      if ("code" in result) {
        set({ queryError: result as AppError, isQuerying: false });
        return;
      }
      set({ queryResult: result as QueryResult, isQuerying: false });
    } catch (err) {
      set({ queryError: err as AppError, isQuerying: false });
    }
  },

  runPython: async (code: string) => {
    set({ isPythonRunning: true, pythonResult: null });
    try {
      const result = await api.runPython(code, get().sessionId);
      set({ pythonResult: result, isPythonRunning: false });
    } catch (err) {
      set({
        pythonResult: { output: "", error: String(err) },
        isPythonRunning: false,
      });
    }
  },

  clearQueryError: () => set({ queryError: null }),

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
