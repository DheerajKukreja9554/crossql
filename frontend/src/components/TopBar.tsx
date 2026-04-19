import { useRef, useEffect, useState } from "react";
import { Icons } from "./Icons";
import type { EnvironmentInfo } from "../api/client";

interface TopBarProps {
  envId: string | null;
  environments: EnvironmentInfo[];
  activeHost: string | null;
  onSwitchEnv: (env: string) => void;
  theme: "dark" | "light";
  onToggleTheme: () => void;
  onReloadConfig: () => void;
}

function envColor(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes("prod")) return "var(--env-prod)";
  if (lower.includes("staging")) return "var(--env-staging)";
  if (lower.includes("sandbox")) return "var(--env-sandbox)";
  return "var(--env-dev)";
}

export function TopBar({
  envId,
  environments,
  activeHost,
  onSwitchEnv,
  theme,
  onToggleTheme,
  onReloadConfig,
}: TopBarProps) {
  const [envOpen, setEnvOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!envOpen) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setEnvOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [envOpen]);

  const activeEnvInfo = environments.find((e) => e.name === envId);

  return (
    <div className="topbar">
      <div className="topbar-left">
        {/* Logo */}
        <div className="logo">
          <span style={{ color: "var(--accent)" }}>
            <Icons.logo size={20} />
          </span>
          <span className="logo-text">CrossQL</span>
        </div>

        {/* Environment switcher */}
        <div className="env" ref={menuRef}>
          <button
            className="env-pill"
            onClick={() => setEnvOpen((o) => !o)}
            aria-expanded={envOpen}
          >
            <span
              className="env-dot"
              style={{ background: envId ? envColor(envId) : "var(--env-dev)" }}
            />
            <span className="env-label">{envId ?? "No env"}</span>
            {activeHost && <span className="env-host">{activeHost}</span>}
            <Icons.chev size={12} />
          </button>

          {envOpen && (
            <div className="env-menu">
              <div className="env-menu-head">Environments</div>
              {environments.map((env) => (
                <button
                  key={env.name}
                  className={`env-menu-item${env.name === envId ? " active" : ""}`}
                  onClick={() => {
                    onSwitchEnv(env.name);
                    setEnvOpen(false);
                  }}
                >
                  <span
                    className="env-dot"
                    style={{ background: envColor(env.name) }}
                  />
                  <span className="env-label">{env.name}</span>
                  <span className="env-menu-sub">
                    {env.host}:{env.port}
                  </span>
                </button>
              ))}
              <div className="env-menu-foot">
                {activeEnvInfo && (
                  <span>
                    {activeEnvInfo.user}@{activeEnvInfo.host}:{activeEnvInfo.port}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="topbar-right">
        {/* Theme toggle */}
        <button
          className="icon-btn"
          onClick={onToggleTheme}
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          {theme === "dark" ? <Icons.sun size={14} /> : <Icons.moon size={14} />}
        </button>

        {/* Refresh config */}
        <button
          className="icon-btn"
          onClick={onReloadConfig}
          title="Reload configuration"
        >
          <Icons.refresh size={14} />
        </button>
      </div>
    </div>
  );
}
