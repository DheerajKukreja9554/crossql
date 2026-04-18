import { useAppStore } from "../store/useAppStore";

export function EnvSwitcher() {
  const { environments, activeEnv, dbStatus, switchEnv } = useAppStore();

  return (
    <div className="env-switcher">
      <label htmlFor="env-select" className="env-label">
        Environment
      </label>
      <select
        id="env-select"
        value={activeEnv ?? ""}
        onChange={(e) => switchEnv(e.target.value)}
        className="env-select"
        disabled={environments.length === 0}
      >
        {environments.length === 0 && (
          <option value="">Loading...</option>
        )}
        {environments.map((env) => (
          <option key={env} value={env}>
            {env}
          </option>
        ))}
      </select>

      <div className="db-status-list">
        {Object.entries(dbStatus).map(([db, status]) => (
          <span key={db} className={`db-badge db-badge--${status}`} title={db}>
            <span className="db-badge__dot" />
            {db}
          </span>
        ))}
      </div>
    </div>
  );
}
