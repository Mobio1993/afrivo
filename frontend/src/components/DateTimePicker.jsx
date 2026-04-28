import { forwardRef, useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

import "./DateTimePicker.css";

const MONTHS_FR = [
  "Janvier", "Fevrier", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Aout", "Septembre", "Octobre", "Novembre", "Decembre",
];

const DAYS_FR = ["Lu", "Ma", "Me", "Je", "Ve", "Sa", "Di"];

function parseDateTime(value) {
  if (!value) return null;
  const [datePart, timePart = "00:00"] = value.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hours = 0, minutes = 0] = timePart.split(":").map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day, hours, minutes, 0, 0);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function toYMD(date) {
  if (!date) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toTime(date) {
  if (!date) return "";
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function toDateTimeLocal(date) {
  if (!date) return "";
  const time = toTime(date);
  return `${toYMD(date)}T${time}`;
}

function formatDisplay(date) {
  if (!date) return "";
  return date.toLocaleString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
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
  const lastDay = new Date(year, month + 1, 0);
  let startDow = firstDay.getDay() - 1;
  if (startDow < 0) startDow = 6;

  const days = [];

  for (let index = startDow - 1; index >= 0; index -= 1) {
    days.push({ date: new Date(year, month, -index), outside: true });
  }

  for (let day = 1; day <= lastDay.getDate(); day += 1) {
    days.push({ date: new Date(year, month, day), outside: false });
  }

  const remaining = 7 - (days.length % 7);
  if (remaining < 7) {
    for (let day = 1; day <= remaining; day += 1) {
      days.push({ date: new Date(year, month + 1, day), outside: true });
    }
  }

  return days;
}

function setTimeOnDate(date, timeValue) {
  const next = new Date(date);
  const [hours = 0, minutes = 0] = (timeValue || "00:00").split(":").map(Number);
  next.setHours(hours, minutes, 0, 0);
  return next;
}

function normalizeDateOnly(value) {
  if (!value) return null;
  const parsed = parseDateTime(value.includes("T") ? value : `${value}T00:00`);
  if (!parsed) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

function DateTimePopover({
  anchorRef,
  onClose,
  selectedDateTime,
  onSelect,
  minDate,
  maxDate,
}) {
  const popoverRef = useRef(null);
  const now = new Date();
  const initial = selectedDateTime || now;

  const [viewYear, setViewYear] = useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial.getMonth());
  const [draftDate, setDraftDate] = useState(initial);
  const [draftTime, setDraftTime] = useState(toTime(initial) || "12:00");
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });

  useEffect(() => {
    function updatePos() {
      if (!anchorRef.current) return;
      const rect = anchorRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const popoverHeight = popoverRef.current?.offsetHeight || 420;
      const top = spaceBelow > popoverHeight + 8
        ? rect.bottom + window.scrollY + 6
        : rect.top + window.scrollY - popoverHeight - 6;
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

  useEffect(() => {
    function handleClick(event) {
      if (
        popoverRef.current && !popoverRef.current.contains(event.target) &&
        anchorRef.current && !anchorRef.current.contains(event.target)
      ) {
        onClose();
      }
    }

    function handleKey(event) {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    }

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey, true);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey, true);
    };
  }, [anchorRef, onClose]);

  function prevMonth() {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((year) => year - 1);
      return;
    }
    setViewMonth((month) => month - 1);
  }

  function nextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((year) => year + 1);
      return;
    }
    setViewMonth((month) => month + 1);
  }

  function isDisabled(date) {
    const normalized = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    return (minDate && normalized < minDate) || (maxDate && normalized > maxDate);
  }

  function handleDayClick(date) {
    if (isDisabled(date)) {
      return;
    }
    const nextDraft = setTimeOnDate(date, draftTime);
    setDraftDate(nextDraft);
    setViewMonth(date.getMonth());
    setViewYear(date.getFullYear());
  }

  function applySelection() {
    onSelect(setTimeOnDate(draftDate, draftTime));
    onClose();
  }

  const days = buildCalendarDays(viewYear, viewMonth);

  return createPortal(
    <div
      ref={popoverRef}
      className="dtp-popover"
      role="dialog"
      aria-modal="true"
      aria-label="Choisir une date et une heure"
      style={{ top: pos.top, left: pos.left, width: Math.max(pos.width, 320) }}
    >
      <div className="dtp-header">
        <button type="button" className="dtp-nav" onClick={prevMonth} aria-label="Mois precedent">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="10 4 6 8 10 12" />
          </svg>
        </button>

        <div className="dtp-month-row">
          <select
            className="dtp-month-select"
            value={viewMonth}
            onChange={(event) => setViewMonth(Number(event.target.value))}
            aria-label="Mois"
          >
            {MONTHS_FR.map((month, index) => (
              <option key={month} value={index}>{month}</option>
            ))}
          </select>
          <select
            className="dtp-year-select"
            value={viewYear}
            onChange={(event) => setViewYear(Number(event.target.value))}
            aria-label="Annee"
          >
            {Array.from({ length: now.getFullYear() + 10 - 1900 + 1 }, (_, index) => now.getFullYear() + 10 - index).map((year) => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>

        <button type="button" className="dtp-nav" onClick={nextMonth} aria-label="Mois suivant">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 4 10 8 6 12" />
          </svg>
        </button>
      </div>

      <div className="dtp-grid">
        {DAYS_FR.map((day) => (
          <div key={day} className="dtp-dow">{day}</div>
        ))}

        {days.map(({ date, outside }, index) => {
          const today = isSameDay(date, now);
          const selected = isSameDay(date, draftDate);
          const disabled = isDisabled(date);

          return (
            <button
              key={`${date.toISOString()}-${index}`}
              type="button"
              className={[
                "dtp-day",
                outside ? "dtp-day--outside" : "",
                today ? "dtp-day--today" : "",
                selected ? "dtp-day--selected" : "",
                disabled ? "dtp-day--disabled" : "",
              ].filter(Boolean).join(" ")}
              onClick={() => handleDayClick(date)}
              aria-pressed={selected}
              aria-disabled={disabled}
              tabIndex={disabled ? -1 : 0}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>

      <div className="dtp-time-panel">
        <div className="dtp-time-copy">
          <strong>Heure</strong>
          <span>Conserve le format metier AFRIVO pour les operations.</span>
        </div>
        <input
          type="time"
          className="dtp-time-input"
          value={draftTime}
          step="60"
          onChange={(event) => setDraftTime(event.target.value)}
        />
      </div>

      <div className="dtp-footer">
        <button
          type="button"
          className="dtp-now-btn"
          onClick={() => {
            const current = new Date();
            setDraftDate(current);
            setDraftTime(toTime(current));
            setViewMonth(current.getMonth());
            setViewYear(current.getFullYear());
          }}
        >
          Maintenant
        </button>
        <div className="dtp-footer-actions">
          <button
            type="button"
            className="dtp-clear-btn"
            onClick={() => {
              onSelect(null);
              onClose();
            }}
          >
            Effacer
          </button>
          <button type="button" className="dtp-apply-btn" onClick={applySelection}>
            Appliquer
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export const DateTimePicker = forwardRef(function DateTimePicker(
  {
    value = "",
    onChange,
    placeholder = "Choisir une date et une heure",
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
  const anchorRef = useRef(null);
  const [open, setOpen] = useState(false);

  const selectedDateTime = parseDateTime(value);

  const mergedRef = useCallback((node) => {
    anchorRef.current = node;
    if (typeof ref === "function") ref(node);
    else if (ref) ref.current = node;
  }, [ref]);

  function handleSelect(date) {
    onChange?.({ target: { value: toDateTimeLocal(date), name } });
  }

  return (
    <>
      <input type="hidden" name={name} value={value} required={required} />

      <button
        ref={mergedRef}
        id={id}
        type="button"
        className={[
          "dtp-trigger",
          open ? "dtp-trigger--open" : "",
          disabled ? "dtp-trigger--disabled" : "",
          ariaInvalid === true || ariaInvalid === "true" ? "dtp-trigger--invalid" : "",
          className,
        ].filter(Boolean).join(" ")}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedBy}
        onClick={() => !disabled && setOpen((current) => !current)}
      >
        <span className="dtp-trigger-icon" aria-hidden="true">
          <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="14" height="13" rx="2" />
            <line x1="6" y1="1.5" x2="6" y2="5" />
            <line x1="12" y1="1.5" x2="12" y2="5" />
            <line x1="2" y1="8" x2="16" y2="8" />
            <path d="M6.5 11.5h1.5v1.5" />
            <path d="M11 11.5v2" />
          </svg>
        </span>

        <span className={`dtp-trigger-label ${!selectedDateTime ? "dtp-trigger-label--placeholder" : ""}`}>
          {selectedDateTime ? formatDisplay(selectedDateTime) : placeholder}
        </span>

        <span className="dtp-trigger-chevron" aria-hidden="true">
          <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="2 4 6 8 10 4" />
          </svg>
        </span>
      </button>

      {open ? (
        <DateTimePopover
          anchorRef={anchorRef}
          onClose={() => setOpen(false)}
          selectedDateTime={selectedDateTime}
          onSelect={handleSelect}
          minDate={normalizeDateOnly(minDate)}
          maxDate={normalizeDateOnly(maxDate)}
        />
      ) : null}
    </>
  );
});
