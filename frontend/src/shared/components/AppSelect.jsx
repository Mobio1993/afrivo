import { Children, forwardRef, isValidElement, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

import "./AppSelect.css";

// ─── Parse children <option> / <optgroup> ────────────────────────
function getNodeText(node) {
  if (node == null || typeof node === "boolean") {
    return "";
  }
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }
  return Children.toArray(node).map(getNodeText).join(" ").trim();
}

function parseOptions(children) {
  const items = [];

  function walk(nodes) {
    if (!nodes) return;
    const arr = Children.toArray(nodes);

    for (const child of arr) {
      if (!isValidElement(child)) continue;

      if (child.type === "option") {
        items.push({
          type: "option",
          value: String(child.props.value ?? ""),
          label: child.props.children ?? "",
          searchText: getNodeText(child.props.children ?? ""),
          disabled: child.props.disabled ?? false,
        });
      } else if (child.type === "optgroup") {
        items.push({ type: "group", label: child.props.label, searchText: String(child.props.label ?? "") });
        walk(child.props.children);
      } else if (child.props?.children) {
        walk(child.props.children);
      }
    }
  }

  walk(children);
  return items;
}

// ─── Popover (portaled) ───────────────────────────────────────────
function SelectPopover({ anchorRef, items, value, onSelect, onClose, searchable }) {
  const popoverRef = useRef(null);
  const searchRef  = useRef(null);
  const [query, setQuery]   = useState("");
  const [pos, setPos]       = useState({ top: 0, left: 0, width: 0 });

  const filtered = query
    ? items.filter(
        (i) => i.type === "group" ||
          String(i.searchText || i.label).toLowerCase().includes(query.toLowerCase())
      )
    : items;

  // ── Positioning ──
  useEffect(() => {
    function updatePos() {
      if (!anchorRef.current) return;
      const rect = anchorRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const popH = popoverRef.current?.offsetHeight || 280;
      const top = spaceBelow > popH + 8
        ? rect.bottom + window.scrollY + 5
        : rect.top   + window.scrollY - popH - 5;
      setPos({ top, left: rect.left + window.scrollX, width: rect.width });
    }
    updatePos();
    window.addEventListener("resize", updatePos);
    window.addEventListener("scroll", updatePos, true);
    return () => {
      window.removeEventListener("resize", updatePos);
      window.removeEventListener("scroll", updatePos, true);
    };
  }, [anchorRef]);

  // ── Close on outside click / Escape ──
  useEffect(() => {
    function handleClick(e) {
      if (
        popoverRef.current && !popoverRef.current.contains(e.target) &&
        anchorRef.current  && !anchorRef.current.contains(e.target)
      ) onClose();
    }
    function handleKey(e) {
      if (e.key === "Escape") { e.stopPropagation(); onClose(); }
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown",   handleKey, true);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown",   handleKey, true);
    };
  }, [anchorRef, onClose]);

  // ── Focus search on open ──
  useEffect(() => {
    if (searchable) searchRef.current?.focus();
  }, [searchable]);

  return createPortal(
    <div
      ref={popoverRef}
      className="as-popover"
      role="listbox"
      style={{ top: pos.top, left: pos.left, width: Math.max(pos.width, 280) }}
    >
      {searchable && (
        <div className="as-search-wrap">
          <svg className="as-search-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <circle cx="6.5" cy="6.5" r="4" />
            <line x1="10" y1="10" x2="14" y2="14" />
          </svg>
          <input
            ref={searchRef}
            type="text"
            className="as-search-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher..."
            aria-label="Rechercher une option"
          />
          {query && (
            <button type="button" className="as-search-clear" onClick={() => setQuery("")} aria-label="Effacer">
              ×
            </button>
          )}
        </div>
      )}

      <div className="as-list">
        {filtered.length === 0 && (
          <div className="as-empty">Aucun résultat</div>
        )}
        {filtered.map((item, idx) => {
          if (item.type === "group") {
            return (
              <div key={`group-${idx}`} className="as-group-label">
                {item.label}
              </div>
            );
          }

          const isActive   = String(item.value) === String(value);
          const isEmpty    = item.value === "";

          return (
            <button
              key={`${item.value}-${idx}`}
              type="button"
              role="option"
              aria-selected={isActive}
              disabled={item.disabled}
              className={[
                "as-item",
                isActive  ? "as-item--active"   : "",
                isEmpty   ? "as-item--placeholder" : "",
                item.disabled ? "as-item--disabled" : "",
              ].filter(Boolean).join(" ")}
              onClick={() => {
                if (!item.disabled) { onSelect(item.value); onClose(); }
              }}
            >
              <span className="as-item-label">{item.label}</span>
              {isActive && !isEmpty && (
                <svg className="as-item-check" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="2 7 5.5 10.5 12 3" />
                </svg>
              )}
            </button>
          );
        })}
      </div>
    </div>,
    document.body,
  );
}

// ─── Main component ───────────────────────────────────────────────
export const AppSelect = forwardRef(function AppSelect(
  {
    value,
    onChange,
    children,
    disabled   = false,
    required   = false,
    invalid    = false,
    searchable,          // auto si > 6 options
    placeholder,
    className  = "",
    id: externalId,
    name,
    "aria-invalid":      ariaInvalid,
    "aria-describedby":  ariaDescribedBy,
    ...rest
  },
  ref,
) {
  const generatedId = useId();
  const id          = externalId || generatedId;
  const anchorRef   = useRef(null);
  const [open, setOpen] = useState(false);

  const items         = parseOptions(children);
  const optionItems   = items.filter((i) => i.type === "option");
  const isInvalid     = invalid || ariaInvalid === true || ariaInvalid === "true";
  const autoSearch    = searchable ?? optionItems.length > 6;

  const selectedItem = optionItems.find((i) => String(i.value) === String(value ?? ""));
  const displayLabel = selectedItem
    ? (selectedItem.value === "" ? selectedItem.label : selectedItem.label)
    : (placeholder || "Choisir...");
  const isPlaceholder = !selectedItem || selectedItem.value === "";

  // Merge refs
  function mergeRef(node) {
    anchorRef.current = node;
    if (typeof ref === "function") ref(node);
    else if (ref) ref.current = node;
  }

  // Body scroll lock when open
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else       document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  function handleSelect(val) {
    onChange?.({ target: { value: val, name } });
  }

  return (
    <>
      {/* Hidden native select for form submission */}
      <select
        name={name}
        value={value}
        required={required}
        disabled={disabled}
        onChange={() => {}}
        aria-hidden="true"
        tabIndex={-1}
        style={{ position: "absolute", opacity: 0, pointerEvents: "none", width: 0, height: 0 }}
      >
        {children}
      </select>

      {/* Visible custom trigger */}
      <button
        ref={mergeRef}
        id={id}
        type="button"
        className={[
          "as-trigger",
          open        ? "as-trigger--open"    : "",
          isInvalid   ? "as-trigger--invalid" : "",
          disabled    ? "as-trigger--disabled": "",
          className,
        ].filter(Boolean).join(" ")}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-invalid={isInvalid || undefined}
        aria-describedby={ariaDescribedBy}
        aria-required={required}
        onClick={() => !disabled && setOpen((v) => !v)}
        {...rest}
      >
        <span className={`as-trigger-label ${isPlaceholder ? "as-trigger-label--placeholder" : ""}`}>
          {displayLabel}
        </span>
        <span className="as-trigger-chevron" aria-hidden="true">
          <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="2 4 6 8 10 4" />
          </svg>
        </span>
      </button>

      {open && (
        <SelectPopover
          anchorRef={anchorRef}
          items={items}
          value={value}
          onSelect={handleSelect}
          onClose={() => setOpen(false)}
          searchable={autoSearch}
        />
      )}
    </>
  );
});
