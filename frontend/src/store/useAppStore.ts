import { create } from "zustand";
import { v4 as uuidv4 } from "uuid";
import {
  api,
  AppError,
  DbStatus,
  PythonResult,
  QueryResult,
  SchemaCache,
} from "../api/client";

const SESSION_KEY = "db-simplifier-session-id";

function getOrCreateSessionId(): string {
  const existing = localStorage.getItem(SESSION_KEY);
  if (existing) return existing;
  const id = uuidv4();
  localStorage.setItem(SESSION_KEY, id);
  return id;
}

interface AppStore {
  // State
  environments: string[];
  activeEnv: string | null;
  dbStatus: DbStatus;
  schema: SchemaCache;
  sessionId: string;
  queryResult: QueryResult | null;
  isQuerying: boolean;
  queryError: AppError | null;
  pythonResult: PythonResult | null;
  isPythonRunning: boolean;

  // Actions
  loadEnvironments: () => Promise<void>;
  switchEnv: (env: string) => Promise<void>;
  runQuery: (sql: string) => Promise<void>;
  runPython: (code: string) => Promise<void>;
  clearQueryError: () => void;
}

export const useAppStore = create<AppStore>((set, get) => ({
  environments: [],
  activeEnv: null,
  dbStatus: {},
  schema: {},
  sessionId: getOrCreateSessionId(),
  queryResult: null,
  isQuerying: false,
  queryError: null,
  pythonResult: null,
  isPythonRunning: false,

  loadEnvironments: async () => {
    try {
      const res = await api.getEnvironments();
      set({ environments: res.environments });

      // Auto-switch to first environment
      if (res.environments.length > 0 && !get().activeEnv) {
        await get().switchEnv(res.environments[0]);
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
        dbStatus: res.status,
        schema: res.schema,
        queryResult: null,
        queryError: null,
        pythonResult: null,
      });
    } catch (err) {
      console.error("Failed to switch environment:", err);
    }
  },

  runQuery: async (sql: string) => {
    set({ isQuerying: true, queryError: null, queryResult: null, pythonResult: null });
    try {
      const result = await api.runQuery(sql, get().sessionId);
      // Check if result is an error shape
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
}));
