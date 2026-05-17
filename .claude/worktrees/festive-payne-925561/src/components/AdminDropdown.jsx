import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * AdminDropdown — modern select/combobox for admin modals.
 *
 * Props:
 *  value        – current value (must match an option.value, or free text if freeInput)
 *  onChange     – called with the new value
 *  options      – [{ value, label }]
 *  placeholder  – shown when no value selected
 *  searchable   – shows a text input for filtering the list
 *  freeInput    – (requires searchable) typing also sets the value directly (combobox).
 *                 Use for string fields. For UUID fields keep freeInput=false so
 *                 typing only filters; onChange is only called on selection.
 *  disabled
 *  emptyText    – message shown when filter has no matches
 */
export function Dropdown({
  value,
  onChange,
  options,
  placeholder = 'Selecione...',
  searchable = false,
  freeInput = false,
  disabled = false,
  emptyText = 'Nenhuma opção',
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(-1);
  const ref = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onEsc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  const filtered = useMemo(() => {
    if (!searchable || !query.trim()) return options;
    const q = query.trim().toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query, searchable]);

  const selectedLabel = useMemo(() => {
    const found = options.find((o) => o.value === value);
    return found ? found.label : (freeInput ? value : '');
  }, [options, value, freeInput]);

  const commit = (v) => {
    onChange(v);
    setOpen(false);
    setQuery('');
    setActiveIdx(-1);
  };

  const close = () => { setOpen(false); setQuery(''); setActiveIdx(-1); };

  const onKeyDown = (e) => {
    if (disabled) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) { setOpen(true); return; }
      setActiveIdx((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      if (open && activeIdx >= 0 && filtered[activeIdx]) {
        e.preventDefault();
        commit(filtered[activeIdx].value);
      }
    }
  };

  const inputDisplayValue = open ? query : (selectedLabel || '');

  return (
    <div ref={ref} className={`admin-dd ${open ? 'open' : ''} ${disabled ? 'disabled' : ''}`}>
      {searchable ? (
        <div className="admin-dd-trigger" onClick={() => !disabled && setOpen(true)}>
          <input
            className="admin-dd-input"
            value={inputDisplayValue}
            onChange={(e) => {
              setQuery(e.target.value);
              if (freeInput) onChange(e.target.value);
              if (!open) setOpen(true);
            }}
            onFocus={() => !disabled && setOpen(true)}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            disabled={disabled}
          />
          <button
            type="button"
            className="admin-dd-arrow-btn"
            onClick={(e) => { e.stopPropagation(); if (!disabled) setOpen((o) => !o); }}
            tabIndex={-1}
            aria-label="Abrir lista"
            disabled={disabled}
          >
            <svg className={`admin-dd-arrow ${open ? 'open' : ''}`} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="admin-dd-trigger admin-dd-trigger-btn"
          onClick={() => !disabled && setOpen((o) => !o)}
          onKeyDown={onKeyDown}
          disabled={disabled}
        >
          <span className={`admin-dd-value ${!selectedLabel ? 'placeholder' : ''}`}>
            {selectedLabel || placeholder}
          </span>
          <svg className={`admin-dd-arrow ${open ? 'open' : ''}`} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
      )}

      {open && !disabled && (
        <div ref={listRef} className="admin-dd-panel" role="listbox">
          {filtered.length === 0 ? (
            <div className="admin-dd-empty">{emptyText}</div>
          ) : (
            filtered.map((o, idx) => {
              const selected = o.value === value;
              const active = idx === activeIdx;
              return (
                <button
                  key={o.value}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={`admin-dd-option ${selected ? 'selected' : ''} ${active ? 'active' : ''}`}
                  onMouseEnter={() => setActiveIdx(idx)}
                  onClick={() => commit(o.value)}
                >
                  <span className="admin-dd-option-label">{o.label}</span>
                  {selected && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  )}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

export function DropdownStyles() {
  return (
    <style>{`
      @keyframes admin-dd-in {
        from { opacity: 0; transform: translateY(-6px) scale(0.98); }
        to   { opacity: 1; transform: translateY(0)    scale(1); }
      }
      .admin-dd { position: relative; width: 100%; }
      .admin-dd.disabled { opacity: 0.55; pointer-events: none; }
      .admin-dd-trigger {
        position: relative; display: flex; align-items: center;
        width: 100%; padding: 0; margin: 0; border-radius: 10px;
        background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1);
        color: #eeede9; font-size: 0.9rem; font-family: inherit;
        outline: none; cursor: pointer;
        transition: border-color 0.18s, background 0.18s, box-shadow 0.18s;
      }
      .admin-dd-trigger:hover { border-color: rgba(124,58,237,0.45); background: rgba(255,255,255,0.05); }
      .admin-dd.open .admin-dd-trigger { border-color: #7C3AED; background: rgba(124,58,237,0.06); box-shadow: 0 0 0 3px rgba(124,58,237,0.18); }
      .admin-dd-trigger-btn { padding: 10px 12px; justify-content: space-between; text-align: left; }
      .admin-dd-input {
        flex: 1; min-width: 0; padding: 10px 12px;
        background: transparent; border: none; outline: none;
        color: inherit; font: inherit;
      }
      .admin-dd-input::placeholder { color: rgba(255,255,255,0.32); }
      .admin-dd-arrow-btn {
        display: inline-flex; align-items: center; justify-content: center;
        width: 36px; height: 100%; min-height: 38px;
        background: transparent; border: none;
        color: rgba(255,255,255,0.55); cursor: pointer;
        border-left: 1px solid rgba(255,255,255,0.06);
      }
      .admin-dd-arrow-btn:hover { color: #7C3AED; background: rgba(124,58,237,0.06); }
      .admin-dd-arrow {
        transition: transform 0.22s cubic-bezier(0.16,1,0.3,1);
        color: rgba(255,255,255,0.55);
      }
      .admin-dd-trigger-btn .admin-dd-arrow { color: rgba(255,255,255,0.55); margin-left: 10px; }
      .admin-dd-arrow.open { transform: rotate(180deg); color: #7C3AED; }
      .admin-dd-value { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .admin-dd-value.placeholder { color: rgba(255,255,255,0.32); }
      .admin-dd-panel {
        position: absolute; top: calc(100% + 6px); left: 0; right: 0;
        z-index: 300; max-height: 240px; overflow-y: auto;
        background: #15151a; border: 1px solid rgba(255,255,255,0.10);
        border-radius: 10px; padding: 4px;
        box-shadow:
          0 12px 32px -8px rgba(0,0,0,0.55),
          0 0 0 1px rgba(124,58,237,0.10),
          0 6px 16px -6px rgba(124,58,237,0.20);
        animation: admin-dd-in 0.18s cubic-bezier(0.16,1,0.3,1) both;
      }
      .admin-dd-option {
        display: flex; align-items: center; justify-content: space-between;
        width: 100%; padding: 9px 12px;
        background: transparent; border: none;
        color: rgba(255,255,255,0.85); font: inherit; text-align: left;
        border-radius: 7px; cursor: pointer;
        transition: background 0.14s, color 0.14s;
      }
      .admin-dd-option:hover, .admin-dd-option.active { background: rgba(124,58,237,0.14); color: #fff; }
      .admin-dd-option.selected { background: rgba(124,58,237,0.20); color: #fff; }
      .admin-dd-option.selected svg { color: #a78bfa; }
      .admin-dd-option-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .admin-dd-empty { padding: 14px 12px; text-align: center; color: rgba(255,255,255,0.4); font-size: 0.85rem; }
      .admin-dd-panel::-webkit-scrollbar { width: 8px; }
      .admin-dd-panel::-webkit-scrollbar-thumb { background: rgba(124,58,237,0.30); border-radius: 8px; }
    `}</style>
  );
}
