import { useAppStore } from "../store/useAppStore";

export function StatusBar() {
  const { activeEnv, activeHost, dbStatus, discoveredDbs } = useAppStore();
  const connectedCount = Object.values(dbStatus).filter((s) => s === "ok").length;
  const discoveredCount = discoveredDbs.length;

  return (
    <div className="statusbar">
      <div className="sb-left">
        <span className={`dot ${connectedCount > 0 ? "ok" : "warn"}`} />
        <span>
          {discoveredCount} discovered
          {connectedCount > 0 && ` · ${connectedCount} connected`}
        </span>
        <span className="sb-sep">·</span>
        <span>{activeEnv || "no env"}</span>
        {activeHost && (
          <>
            <span className="sb-sep">·</span>
            <span className="mono">{activeHost}</span>
          </>
        )}
      </div>
      <div className="sb-right">
        <span>DuckDB · in-memory</span>
        <span className="sb-sep">·</span>
        <span>asyncpg</span>
      </div>
    </div>
  );
}
