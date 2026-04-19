/** Typed API client — wraps all backend endpoints. */

export interface EnvironmentInfo {
  name: string;
  host: string;
  port: number;
  user: string;
}

export interface DbStatus {
  [dbName: string]: "ok" | "error";
}

export type SchemaCache = Record<string, Record<string, string[]>>;

export interface TimingInfo {
  total_ms: number;
  per_db: Record<string, number>;
  duckdb_ms: number;
}

export interface QueryResult {
  rows: Record<string, unknown>[];
  columns: string[];
  row_count: number;
  timing: TimingInfo;
  session_id: string;
  warning?: string;
}

export interface SwitchEnvResult {
  env: string;
  host: string;
  status: DbStatus;
  db_schema: SchemaCache;
  discovered_dbs: string[];
  excluded_dbs: string[];
}

export interface ReloadConfigResult {
  env: string;
  host: string;
  status: DbStatus;
  db_schema: SchemaCache;
  discovered_dbs: string[];
  excluded_dbs: string[];
}

export interface PythonResult {
  output: string;
  error?: string;
}

export interface AppError {
  error: string;
  detail: string;
  code:
    | "PARSE_ERROR"
    | "ROW_LIMIT_EXCEEDED"
    | "CONNECTION_ERROR"
    | "TIMEOUT"
    | "SANDBOX_ERROR"
    | "NOT_FOUND";
}

// ── Fetch helper ──────────────────────────────────────────────────────────────

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      headers: { "Content-Type": "application/json" },
      ...init,
    });
  } catch (e) {
    throw {
      error: "Network error",
      detail: `Could not connect to backend: ${e}`,
      code: "CONNECTION_ERROR",
    } as AppError;
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    throw {
      error: `HTTP ${res.status}`,
      detail: `Server returned non-JSON response (${res.statusText})`,
      code: "CONNECTION_ERROR",
    } as AppError;
  }

  if (!res.ok) {
    // Ensure the error has the expected shape
    const err = data as Record<string, unknown>;
    throw {
      error: String(err.error || `HTTP ${res.status}`),
      detail: String(err.detail || err.error || res.statusText),
      code: String(err.code || "CONNECTION_ERROR"),
    } as AppError;
  }
  return data as T;
}

// ── Endpoints ─────────────────────────────────────────────────────────────────

export const api = {
  getEnvironments(): Promise<{
    environments: EnvironmentInfo[];
    active: string | null;
  }> {
    return request("/api/environments");
  },

  switchEnv(env: string): Promise<SwitchEnvResult> {
    return request("/api/environments/switch", {
      method: "POST",
      body: JSON.stringify({ env }),
    });
  },

  reloadConfig(): Promise<ReloadConfigResult> {
    return request("/api/config/reload", {
      method: "POST",
    });
  },

  getSchema(): Promise<{ schema_: SchemaCache }> {
    return request("/api/schema");
  },

  runQuery(sql: string, sessionId: string): Promise<QueryResult | AppError> {
    return request("/api/query/run", {
      method: "POST",
      body: JSON.stringify({ sql, session_id: sessionId }),
    });
  },

  runPython(code: string, sessionId: string): Promise<PythonResult> {
    return request("/api/python/run", {
      method: "POST",
      body: JSON.stringify({ code, session_id: sessionId }),
    });
  },
};
