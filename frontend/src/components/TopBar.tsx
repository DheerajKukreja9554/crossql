import { useRef, useEffect, useState } from "react";
import { Icons } from "./Icons";
import type { EnvironmentInfo } from "../api/client";
import type { QueryTab } from "../store/useAppStore";

interface TopBarProps {
  envId: string | null;
  environments: EnvironmentInfo[];
  activeHost: string | null;
  onSwitchEnv: (env: string) => void;
  theme: "dark" | "light";
  onToggleTheme: () => void;
  onReloadConfig: () => void;
  // Tabs
  tabs: QueryTab[];
  activeTabId: string;
  onSetActiveTab: (id: string) => void;
  onAddTab: () => void;
  onCloseTab: (id: string) => void;
  onRenameTab: (id: string, name: string) => void;
  onManageConnections: () => void;
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
  tabs,
  activeTabId,
  onSetActiveTab,
  onAddTab,
  onCloseTab,
  onRenameTab,
  onManageConnections,
}: TopBarProps) {
  const [envOpen, setEnvOpen] = useState(false);
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  const editRef = useRef<HTMLInputElement>(null);

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

  // Focus edit input when editing starts
  useEffect(() => {
    if (editingTabId && editRef.current) {
      editRef.current.focus();
      editRef.current.select();
    }
  }, [editingTabId]);

  const commitRename = () => {
    if (editingTabId && editName.trim()) {
      onRenameTab(editingTabId, editName.trim());
    }
    setEditingTabId(null);
  };

  const activeEnvInfo = environments.find((e) => e.name === envId);

  return (
    <div className="topbar">
      <div className="topbar-left">
        {/* Logo */}
        <div className="logo">
          <span style={{ color: "var(--acc)" }}>
            <Icons.logo size={18} />
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
            {activeHost && (
              <span className="env-host">
                {activeHost.length > 25 ? activeHost.slice(0, 22) + "..." : activeHost}
              </span>
            )}
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
                  <span className="env-dot" style={{ background: envColor(env.name) }} />
                  <span className="env-label">{env.name}</span>
                  <span className="env-menu-sub">{env.host}:{env.port}</span>
                </button>
              ))}
              <div className="env-menu-foot">
                {activeEnvInfo && (
                  <span>{activeEnvInfo.user}@{activeEnvInfo.host}:{activeEnvInfo.port}</span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Query tabs */}
        <div className="tabs">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={`tab ${tab.id === activeTabId ? "tab-active" : ""}`}
              onClick={() => onSetActiveTab(tab.id)}
              onDoubleClick={() => {
                setEditingTabId(tab.id);
                setEditName(tab.name);
              }}
            >
              <span
                className="tab-dot"
                style={{ background: tab.dirty ? "var(--warn)" : "var(--tx-4)" }}
              />
              {editingTabId === tab.id ? (
                <input
                  ref={editRef}
                  className="tab-edit-input"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitRename();
                    if (e.key === "Escape") setEditingTabId(null);
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span className="tab-label">{tab.name}</span>
              )}
              {tabs.length > 1 && (
                <button
                  className="tab-close"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseTab(tab.id);
                  }}
                  aria-label="Close tab"
                >
                  <Icons.close size={10} />
                </button>
              )}
            </div>
          ))}
          <button
            className="tab-add"
            onClick={onAddTab}
            title={tabs.length >= 10 ? "Close a tab to open a new one" : "New query tab"}
            disabled={tabs.length >= 10}
          >
            <Icons.plus size={12} />
          </button>
        </div>
      </div>

      <div className="topbar-right">
        <button
          className="icon-btn"
          onClick={onManageConnections}
          title="Manage connections"
        >
          <Icons.plug size={14} />
        </button>

        <button
          className="icon-btn"
          onClick={onToggleTheme}
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          {theme === "dark" ? <Icons.sun size={14} /> : <Icons.moon size={14} />}
        </button>

        <button
          className="btn-ghost"
          onClick={onReloadConfig}
          title="Reload connections.yaml and re-discover databases"
          style={{ display: "flex", alignItems: "center", gap: 6 }}
        >
          <Icons.refresh size={13} />
          <span>Refresh</span>
        </button>
      </div>
    </div>
  );
}
