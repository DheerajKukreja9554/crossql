// editor.jsx — SQL editor with syntax highlight, autocomplete, run bar

const { useState: useStateE, useRef: useRefE, useEffect: useEffectE } = React;

// Lightweight SQL tokenizer for colored rendering
const SQL_KEYWORDS = new Set([
  'SELECT','FROM','WHERE','AND','OR','NOT','JOIN','LEFT','RIGHT','INNER','OUTER','FULL','ON',
  'GROUP','BY','ORDER','LIMIT','OFFSET','AS','ASC','DESC','HAVING','WITH','UNION','ALL','DISTINCT',
  'CASE','WHEN','THEN','ELSE','END','IN','IS','NULL','BETWEEN','LIKE','ILIKE','INTERVAL','NOW','CAST',
  'INSERT','UPDATE','DELETE','VALUES','SET','INTO','RETURNING','EXPLAIN','ANALYZE','COUNT','SUM','AVG','MIN','MAX',
]);

function tokenizeSQL(src) {
  const out = [];
  let i = 0;
  const push = (t, v) => out.push({ t, v });
  while (i < src.length) {
    const ch = src[i];
    // comment
    if (ch === '-' && src[i+1] === '-') {
      let j = i; while (j < src.length && src[j] !== '\n') j++;
      push('comment', src.slice(i, j)); i = j; continue;
    }
    // newline
    if (ch === '\n') { push('nl', '\n'); i++; continue; }
    // whitespace
    if (/\s/.test(ch)) { let j = i; while (j < src.length && /\s/.test(src[j]) && src[j] !== '\n') j++; push('ws', src.slice(i, j)); i = j; continue; }
    // string
    if (ch === "'" || ch === '"') {
      const q = ch; let j = i + 1;
      while (j < src.length && src[j] !== q) { if (src[j] === '\\') j++; j++; }
      j = Math.min(src.length, j + 1);
      push('string', src.slice(i, j)); i = j; continue;
    }
    // number
    if (/[0-9]/.test(ch)) {
      let j = i; while (j < src.length && /[0-9.]/.test(src[j])) j++;
      push('number', src.slice(i, j)); i = j; continue;
    }
    // identifier / keyword / db.table.column
    if (/[A-Za-z_]/.test(ch)) {
      let j = i; while (j < src.length && /[A-Za-z0-9_.]/.test(src[j])) j++;
      const word = src.slice(i, j);
      // Determine role based on upper-case match
      if (SQL_KEYWORDS.has(word.toUpperCase())) {
        push('keyword', word);
      } else if (word.includes('.')) {
        // dotted reference — color segments
        const parts = word.split('.');
        parts.forEach((p, idx) => {
          if (idx > 0) push('operator', '.');
          // first segment likely DB, middle likely table, last likely column
          if (parts.length === 3) push(idx === 0 ? 'db' : idx === 1 ? 'table' : 'column', p);
          else if (parts.length === 2) push(idx === 0 ? 'db' : 'table', p);
          else push('identifier', p);
        });
      } else {
        // Might be a function if followed by '('
        let k = j; while (k < src.length && /\s/.test(src[k])) k++;
        if (src[k] === '(') push('fn', word);
        else push('identifier', word);
      }
      i = j; continue;
    }
    // operator / punctuation
    push('operator', ch); i++;
  }
  return out;
}

function Highlight({ src }) {
  const toks = tokenizeSQL(src);
  return (
    <>{toks.map((t, i) => {
      if (t.t === 'nl') return <br key={i} />;
      const color = ({
        keyword: 'var(--sx-keyword)',
        string: 'var(--sx-string)',
        number: 'var(--sx-number)',
        fn: 'var(--sx-fn)',
        comment: 'var(--sx-comment)',
        operator: 'var(--sx-operator)',
        table: 'var(--sx-table)',
        column: 'var(--sx-column)',
        db: 'var(--sx-db)',
        identifier: 'var(--tx-1)',
        ws: 'inherit',
      })[t.t] || 'inherit';
      const style = { color };
      if (t.t === 'keyword') { style.fontWeight = 600; }
      if (t.t === 'comment') { style.fontStyle = 'italic'; }
      if (t.t === 'db') { style.fontWeight = 500; }
      return <span key={i} style={style}>{t.v}</span>;
    })}</>
  );
}

function LineNumbers({ count, errorLine }) {
  return (
    <div className="ln-gutter">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={`ln ${errorLine === i + 1 ? 'ln-err' : ''}`}>{i + 1}</div>
      ))}
    </div>
  );
}

function SqlEditor({
  value, onChange, onRun, running, onCancel, autocompleteOpen, onInsertSuggestion, error,
}) {
  const lines = value.split('\n').length;
  const taRef = useRefE(null);

  useEffectE(() => {
    // Keep scroll in sync between textarea and highlight layer
    const ta = taRef.current; if (!ta) return;
    const syncScroll = () => {
      const hl = ta.parentElement.querySelector('.editor-highlight');
      const gu = ta.parentElement.querySelector('.ln-gutter');
      if (hl) { hl.scrollTop = ta.scrollTop; hl.scrollLeft = ta.scrollLeft; }
      if (gu) { gu.scrollTop = ta.scrollTop; }
    };
    ta.addEventListener('scroll', syncScroll);
    return () => ta.removeEventListener('scroll', syncScroll);
  }, []);

  const onKey = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); onRun(); }
    if (e.key === 'Tab') {
      e.preventDefault();
      const ta = taRef.current;
      const s = ta.selectionStart, en = ta.selectionEnd;
      const v = ta.value;
      const next = v.slice(0, s) + '  ' + v.slice(en);
      onChange(next);
      requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = s + 2; });
    }
  };

  return (
    <div className="editor-wrap">
      <div className="editor-head">
        <div className="editor-head-left">
          <span style={{ color: 'var(--tx-3)' }}>{I.code(13)}</span>
          <span className="editor-head-title">SQL</span>
          <span className="editor-head-sub">
            <span style={{ color: 'var(--sx-db)' }}>3 databases referenced</span>
            <span style={{ color: 'var(--tx-4)', marginLeft: 8 }}>
              · <span style={{ color: 'var(--sx-db)' }}>ledger</span>, <span style={{ color: 'var(--sx-db)' }}>account_management</span>, <span style={{ color: 'var(--sx-db)' }}>on_boarding</span>
            </span>
          </span>
        </div>
        <div className="editor-head-right">
          <CapChip />
          <div className="vdiv" />
          <button className="btn-ghost" title="Format SQL">Format</button>
          <button className="btn-ghost" title="Explain plan">Explain</button>
          <div className="vdiv" />
          {running ? (
            <button className="btn btn-danger" onClick={onCancel}>
              {I.stop(10)} <span>Cancel</span>
            </button>
          ) : (
            <button className="btn btn-primary" onClick={onRun}>
              {I.play(11)} <span>Run</span>
              <span className="kbd" style={{ background: 'rgba(255,255,255,.12)', border: 'none', color: 'rgba(255,255,255,.8)' }}>⌘↵</span>
            </button>
          )}
        </div>
      </div>

      <div className="editor-pane">
        <LineNumbers count={lines} errorLine={error?.line} />
        <div className="editor-body">
          <pre className="editor-highlight" aria-hidden>
            <Highlight src={value + '\u200b'} />
          </pre>
          <textarea
            ref={taRef}
            className="editor-textarea mono"
            value={value}
            spellCheck={false}
            onChange={e => onChange(e.target.value)}
            onKeyDown={onKey}
          />
          {autocompleteOpen && (
            <AutocompletePopup onPick={onInsertSuggestion} />
          )}
          {error && (
            <div className="editor-err-squiggle" style={{ top: (error.line - 1) * 20 + 2 }}>
              <div className="squiggle" style={{ left: error.col * 7.5, width: error.len * 7.5 }} />
            </div>
          )}
        </div>
      </div>

      <style>{`
        .editor-wrap { display: flex; flex-direction: column; flex: 1; min-height: 0; background: var(--bg-0); }
        .editor-head {
          display: flex; align-items: center; justify-content: space-between;
          padding: 6px 10px 6px 12px;
          background: var(--bg-1);
          border-bottom: 1px solid var(--line-1);
          min-height: 36px;
        }
        .editor-head-left { display: flex; align-items: center; gap: 8px; }
        .editor-head-title { font-size: var(--tx-sm); font-weight: 600; color: var(--tx-1); letter-spacing: -.01em; }
        .editor-head-sub { font-size: var(--tx-xs); color: var(--tx-3); padding-left: 8px; border-left: 1px solid var(--line-2); margin-left: 4px; }
        .editor-head-right { display: flex; align-items: center; gap: 6px; }
        .vdiv { width: 1px; height: 16px; background: var(--line-2); margin: 0 3px; }

        .btn {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 5px 10px; border-radius: var(--r-md);
          font-size: var(--tx-sm); font-weight: 500;
          border: 1px solid transparent;
        }
        .btn-primary {
          background: var(--acc); color: white;
          box-shadow: 0 0 0 1px color-mix(in oklch, var(--acc) 60%, transparent) inset, 0 1px 0 rgba(255,255,255,.15) inset;
        }
        .btn-primary:hover { background: color-mix(in oklch, var(--acc) 92%, white); }
        .btn-danger { background: var(--err); color: white; }
        .btn-danger:hover { background: color-mix(in oklch, var(--err) 90%, white); }
        .btn-ghost {
          padding: 5px 9px; border-radius: var(--r-md); color: var(--tx-2);
          font-size: var(--tx-sm);
        }
        .btn-ghost:hover { background: var(--bg-3); color: var(--tx-1); }

        .editor-pane {
          display: flex; flex: 1; min-height: 0; overflow: hidden; position: relative;
        }
        .ln-gutter {
          width: 44px; flex-shrink: 0;
          background: var(--bg-1);
          border-right: 1px solid var(--line-1);
          overflow: hidden;
          padding: 10px 0;
          font-family: var(--font-mono); font-size: 11.5px;
          color: var(--tx-4); text-align: right;
          user-select: none;
        }
        .ln { padding: 0 10px 0 0; line-height: 20px; height: 20px; }
        .ln-err { color: var(--err); font-weight: 600; background: color-mix(in oklch, var(--err) 10%, transparent); }

        .editor-body {
          flex: 1; position: relative; min-height: 0; min-width: 0;
        }
        .editor-highlight, .editor-textarea {
          position: absolute; inset: 0;
          margin: 0; padding: 10px 12px;
          font-family: var(--font-mono) !important; font-size: 12.5px; line-height: 20px;
          white-space: pre; tab-size: 2;
          overflow: auto;
          letter-spacing: 0;
        }
        .editor-highlight {
          pointer-events: none;
          color: var(--tx-1);
        }
        .editor-textarea {
          background: transparent; color: transparent;
          caret-color: var(--tx-1);
          border: 0; outline: 0; resize: none;
        }
        .editor-textarea::selection { background: color-mix(in oklch, var(--acc) 35%, transparent); color: transparent; }

        .editor-err-squiggle { position: absolute; left: 12px; height: 20px; pointer-events: none; }
        .squiggle { position: absolute; bottom: 0; height: 3px;
          background: linear-gradient(135deg, transparent 45%, var(--err) 45%, var(--err) 55%, transparent 55%) repeat-x;
          background-size: 6px 3px;
        }
      `}</style>
    </div>
  );
}

function AutocompletePopup({ onPick }) {
  const items = [
    { kind: 'table', name: 'transactions', detail: '48.2M rows' },
    { kind: 'table', name: 'postings', detail: '96.4M rows' },
    { kind: 'table', name: 'reversals', detail: '210K rows' },
  ];
  return (
    <div className="ac-pop">
      <div className="ac-head">ledger · tables</div>
      {items.map((it, idx) => (
        <button key={it.name} className={`ac-item ${idx === 0 ? 'ac-item-active' : ''}`} onClick={() => onPick(it.name)}>
          <span style={{ color: 'var(--sx-table)' }}>{I.table(12)}</span>
          <span className="mono ac-name">{it.name}</span>
          <span className="ac-detail">{it.detail}</span>
        </button>
      ))}
      <div className="ac-foot">
        <span><span className="kbd">↑↓</span> navigate</span>
        <span><span className="kbd">↵</span> insert</span>
        <span><span className="kbd">esc</span> close</span>
      </div>
      <style>{`
        .ac-pop {
          position: absolute;
          top: 210px; left: 240px;
          width: 320px;
          background: var(--bg-2); border: 1px solid var(--line-2);
          border-radius: var(--r-md); box-shadow: var(--shadow-overlay);
          z-index: 50; overflow: hidden;
        }
        .ac-head {
          padding: 6px 10px; font-size: var(--tx-xs); text-transform: uppercase; letter-spacing: .08em;
          color: var(--tx-3); background: var(--bg-1); border-bottom: 1px solid var(--line-1);
        }
        .ac-item {
          display: flex; align-items: center; gap: 8px;
          width: 100%; padding: 6px 10px; text-align: left;
          color: var(--tx-2); font-size: var(--tx-sm);
        }
        .ac-item:hover, .ac-item-active { background: var(--bg-3); color: var(--tx-1); }
        .ac-name { flex: 1; font-size: 12px; }
        .ac-detail { color: var(--tx-4); font-size: 11px; font-family: var(--font-mono); }
        .ac-foot {
          display: flex; gap: 12px; padding: 5px 10px;
          border-top: 1px solid var(--line-1);
          background: var(--bg-1);
          font-size: 10.5px; color: var(--tx-4);
        }
      `}</style>
    </div>
  );
}

function CapChip() {
  const [open, setOpen] = React.useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <button className="cap-chip" onClick={() => setOpen(!open)} title="Row cap for this query">
        <span style={{ color: 'var(--tx-4)' }}>cap</span>
        <span className="mono" style={{ color: 'var(--tx-1)' }}>50K</span>
        <span style={{ color: 'var(--tx-4)', fontSize: 10 }}>{I.chev(open ? 'up' : 'down')}</span>
      </button>
      {open && (
        <div className="cap-chip-pop">
          <div className="cap-chip-head">Row cap (this query)</div>
          {[['10K', 10000], ['50K', 50000], ['100K', 100000], ['500K', 500000], ['1M', 1000000], ['No cap', 0]].map(([l, v]) => (
            <button key={l} className={`cap-chip-opt ${v === 50000 ? 'cap-chip-a' : ''}`} onClick={() => setOpen(false)}>
              <span className="mono">{l}</span>
              {v === 0 && <span style={{ color: 'var(--warn)', fontSize: 10 }}>{I.warn(10)}</span>}
              {v === 50000 && <span style={{ color: 'var(--ok)', marginLeft: 'auto' }}>{I.check(11)}</span>}
            </button>
          ))}
          <div className="cap-chip-foot">Per-DB caps apply first. <a style={{ color: 'var(--acc-text, var(--acc))', cursor: 'pointer' }}>Edit per-DB caps →</a></div>
        </div>
      )}
      <style>{`
        .cap-chip { display: inline-flex; align-items: center; gap: 6px; padding: 3px 8px; border-radius: 999px; background: var(--bg-2); border: 1px solid var(--line-2); font-size: 11px; }
        .cap-chip:hover { background: var(--bg-3); border-color: var(--line-3); }
        .cap-chip-pop { position: absolute; top: calc(100% + 4px); right: 0; width: 220px; background: var(--bg-2); border: 1px solid var(--line-2); border-radius: var(--r-md); box-shadow: var(--shadow-overlay); padding: 4px; z-index: 60; }
        .cap-chip-head { padding: 6px 8px 4px; font-size: 10.5px; color: var(--tx-3); text-transform: uppercase; letter-spacing: .07em; }
        .cap-chip-opt { display: flex; align-items: center; gap: 6px; width: 100%; padding: 5px 8px; border-radius: var(--r-sm); color: var(--tx-2); font-size: var(--tx-sm); text-align: left; }
        .cap-chip-opt:hover { background: var(--bg-3); color: var(--tx-1); }
        .cap-chip-a { background: var(--bg-3); color: var(--tx-1); }
        .cap-chip-foot { padding: 6px 8px; border-top: 1px solid var(--line-1); margin-top: 3px; font-size: 10.5px; color: var(--tx-4); }
      `}</style>
    </div>
  );
}

window.SqlEditor = SqlEditor;
