import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

import { ToastContainer } from "./Toast";

const ToastContext = createContext(null);
const EXIT_MS = 380;

function normalizeOptions(options, fallbackDuration) {
  if (typeof options === "number") {
    return { duration: options };
  }
  return { duration: fallbackDuration, ...(options || {}) };
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const counterRef = useRef(0);
  const timersRef = useRef(new Map());

  const removeToast = useCallback((id) => {
    const timer = timersRef.current.get(id);
    if (timer) window.clearTimeout(timer);
    timersRef.current.delete(id);

    setToasts((current) => current.map((toast) => (
      toast.id === id ? { ...toast, closing: true } : toast
    )));

    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, EXIT_MS);
  }, []);

  const addToast = useCallback((config) => {
    const {
      message,
      type = "success",
      duration = 4000,
      actionLabel = null,
      actionPath = null,
      onAction = null,
    } = config;

    const id = ++counterRef.current;
    const nextToast = {
      id,
      message,
      type,
      duration,
      actionLabel,
      actionPath,
      onAction,
      closing: false,
    };
    setToasts((current) => [...current, nextToast]);

    const timer = window.setTimeout(() => removeToast(id), duration);
    timersRef.current.set(id, timer);
    return id;
  }, [removeToast]);

  const toast = useMemo(() => ({
    success: (message, options) => addToast({
      message,
      type: "success",
      ...normalizeOptions(options, 4000),
    }),
    error: (message, options) => addToast({
      message,
      type: "error",
      ...normalizeOptions(options, 6000),
    }),
    warning: (message, options) => addToast({
      message,
      type: "warning",
      ...normalizeOptions(options, 4000),
    }),
    info: (message, options) => addToast({
      message,
      type: "info",
      ...normalizeOptions(options, 4000),
    }),
    remove: removeToast,
  }), [addToast, removeToast]);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast doit etre utilise dans ToastProvider");
  }
  return context;
}
