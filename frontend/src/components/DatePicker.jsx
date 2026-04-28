import { forwardRef, useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

import "./DatePicker.css";

// ─── Constants ───────────────────────────────────────────────────
const MONTHS_FR = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

const DAYS_FR = ["Lu", "Ma", "Me", "Je", "Ve", "Sa", "Di"];

// ─── Helpers ─────────────────────────────────────────────────────
function parseDate(value) {
  if (!value) return null;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return null;
  const date = new Date(y, m - 1, d);
  if (isNaN(date.getTime())) return null;
  return date;
}

function toYMD(date) {
  if (!date) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDisplay(date) {
  if (!date) return "";
  return date.toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function isSameDay(a, b) {
  return a && b
    && a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function buildCalendarDays(year, month) {
  const firstDay = new Date(year, month, 1);
  const lastDay  = new Date(year, month + 1, 0);

  // Monday-first: 0=Mon … 6=Sun
  let startDow = firstDay.getDay() - 1;
  if (startDow < 0) startDow = 6;

  const days = [];

  // Pad with prev month
  for (let i = startDow - 1; i >= 0; i--) {
    const d = new Date(year, month, -i);
    days.push({ date: d, outside: true });
  }

  // Current month
  for (let i = 1; i <= lastDay.getDate(); i++) {
    days.push({ date: new Date(year, month, i), outside: false });
  }

  // Pad to complete the grid (multiples of 7)
  const remaining = 7 - (days.length % 7);
  if (remaining < 7) {
    for (let i = 1; i <= remaining; i++) {
      days.push({ date: new Date(year, month + 1, i), outside: true });
    }
  }

  return days;
}

// ─── Portal-based popover ─────────────────────────────────────────
function CalendarPopover({ anchorRef, onClose, selectedDate, onSelect, minDate, maxDate }) {
  const popoverRef = useRef(null);
  const today = new Date();

  const [viewYear, setViewYear]   = useState(selectedDate?.getFullYear() ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(selectedDate?.getMonth() ?? today.getMonth());

  // Position relative to anchor
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });

  useEffect(() => {
    function updatePos() {
      if (!anchorRef.current) return;
      const rect = anchorRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const popoverH = popoverRef.current?.offsetHeight || 320;
      const top = spaceBelow > popoverH + 8
        ? rect.bottom + window.scrollY + 6
        : rect.top  + window.scrollY - popoverH - 6;
      setPos({ top, left: rect.left + window.scrollX, width: rect.width });
    }

    updatePos();
    window.addEventListener("resize",   updatePos);
    window.addEventListener("scroll",   updatePos, true);
    return () => {
      window.removeEventListener("resize",  updatePos);
      window.removeEventListener("scroll",  updatePos, true);
    };
  }, [anchorRef]);

  // Close on outside click / Escape
  useEffect(() => {
    function handleClick(e) {
      if (
        popoverRef.current && !popoverRef.current.contains(e.target) &&
        anchorRef.current  && !anchorRef.current.contains(e.target)
      ) {
        onClose();
      }
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

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  }

  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  }

  function handleDayClick(date, outside) {
    if (outside) {
      setViewMonth(date.getMonth());
      setViewYear(date.getFullYear());
    }
    if (minDate && date < minDate) return;
    if (maxDate && date > maxDate) return;
    onSelect(date);
    onClose();
  }

  const days = buildCalendarDays(viewYear, viewMonth);

  return createPortal(
    <div
      ref={popoverRef}
      className="dp-popover"
      role="dialog"
      aria-modal="true"
      aria-label="Choisir une date"
      style={{ top: pos.top, left: pos.left, width: Math.max(pos.width, 280) }}
    >
      {/* Header */}
      <div className="dp-header">
        <button type="button" className="dp-nav" onClick={prevMonth} aria-label="Mois précédent">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="10 4 6 8 10 12" />
          </svg>
        </button>

        <div className="dp-month-row">
          <select
            className="dp-month-select"
            value={viewMonth}
            onChange={e => setViewMonth(Number(e.target.value))}
            aria-label="Mois"
          >
            {MONTHS_FR.map((m, i) => (
              <option key={m} value={i}>{m}</option>
            ))}
          </select>
          <select
            className="dp-year-select"
            value={viewYear}
            onChange={e => setViewYear(Number(e.target.value))}
            aria-label="Année"
          >
            {Array.from(
                { length: today.getFullYear() + 10 - 1900 + 1 },
                (_, i) => today.getFullYear() + 10 - i
              ).map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        <button type="button" className="dp-nav" onClick={nextMonth} aria-label="Mois suivant">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 4 10 8 6 12" />
          </svg>
        </button>
      </div>

      {/* Day-of-week headers */}
      <div className="dp-grid">
        {DAYS_FR.map(d => (
          <div key={d} className="dp-dow">{d}</div>
        ))}

        {/* Day cells */}
        {days.map(({ date, outside }, idx) => {
          const isToday    = isSameDay(date, today);
          const isSelected = isSameDay(date, selectedDate);
          const isDisabled =
            (minDate && date < new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate())) ||
            (maxDate && date > new Date(maxDate.getFullYear(), maxDate.getMonth(), maxDate.getDate()));

          return (
            <button
              key={idx}
              type="button"
              className={[
                "dp-day",
                outside   ? "dp-day--outside"   : "",
                isToday   ? "dp-day--today"     : "",
                isSelected? "dp-day--selected"  : "",
                isDisabled? "dp-day--disabled"  : "",
              ].filter(Boolean).join(" ")}
              onClick={() => !isDisabled && handleDayClick(date, outside)}
              aria-label={date.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
              aria-pressed={isSelected}
              aria-disabled={isDisabled}
              tabIndex={isDisabled ? -1 : 0}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>

      {/* Footer — today shortcut */}
      <div className="dp-footer">
        <button
          type="button"
          className="dp-today-btn"
          onClick={() => { onSelect(today); onClose(); }}
        >
          Aujourd'hui
        </button>
        <button
          type="button"
          className="dp-clear-btn"
          onClick={() => { onSelect(null); onClose(); }}
        >
          Effacer
        </button>
      </div>
    </div>,
    document.body,
  );
}

// ─── Main component ───────────────────────────────────────────────
export const DatePicker = forwardRef(function DatePicker(
  {
    value = "",
    onChange,
    placeholder = "Choisir une date",
    disabled = false,
    required = false,
    "aria-invalid": ariaInvalid,
    "aria-describedby": ariaDescribedBy,
    minDate,
    maxDate,
    id: externalId,
    className = "",
    name,
  },
  ref,
) {
  const generatedId = useId();
  const id = externalId || generatedId;

  const anchorRef  = useRef(null);
  const hiddenRef  = useRef(null);

  const [open, setOpen] = useState(false);

  const selectedDate = parseDate(value);

  // Merge external ref with our anchor ref
  const mergedRef = useCallback(node => {
    anchorRef.current = node;
    if (typeof ref === "function") ref(node);
    else if (ref) ref.current = node;
  }, [ref]);

  function handleSelect(date) {
    const ymd = toYMD(date);
    // Fire a synthetic onChange compatible with input[type=date]
    onChange?.({ target: { value: ymd, name } });
  }

  return (
    <>
      {/* Hidden input for form submission & ref forwarding */}
      <input
        ref={hiddenRef}
        type="hidden"
        name={name}
        value={value}
        required={required}
      />

      {/* Visible trigger */}
      <button
        ref={mergedRef}
        id={id}
        type="button"
        className={[
          "dp-trigger",
          open     ? "dp-trigger--open"    : "",
          disabled ? "dp-trigger--disabled": "",
          ariaInvalid === true || ariaInvalid === "true" ? "dp-trigger--invalid" : "",
          className,
        ].filter(Boolean).join(" ")}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedBy}
        onClick={() => !disabled && setOpen(v => !v)}
      >
        <span className="dp-trigger-icon" aria-hidden="true">
          <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="14" height="13" rx="2" />
            <line x1="6" y1="1.5" x2="6" y2="5" />
            <line x1="12" y1="1.5" x2="12" y2="5" />
            <line x1="2" y1="8" x2="16" y2="8" />
          </svg>
        </span>

        <span className={`dp-trigger-label ${!selectedDate ? "dp-trigger-label--placeholder" : ""}`}>
          {selectedDate ? formatDisplay(selectedDate) : placeholder}
        </span>

        <span className="dp-trigger-chevron" aria-hidden="true">
          <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="2 4 6 8 10 4" />
          </svg>
        </span>
      </button>

      {open && (
        <CalendarPopover
          anchorRef={anchorRef}
          onClose={() => setOpen(false)}
          selectedDate={selectedDate}
          onSelect={handleSelect}
          minDate={minDate ? parseDate(minDate) : undefined}
          maxDate={maxDate ? parseDate(maxDate) : undefined}
        />
      )}
    </>
  );
});