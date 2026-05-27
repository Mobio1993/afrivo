import { useEffect, useState } from "react";

export const FONT_SIZE_STORAGE_KEY = "afrivo_font_size";

const DEFAULT_FONT_SIZE = "100%";

const FONT_SIZE_VALUES = new Set(["80%", "90%", "100%", "110%", "120%"]);

const FONT_SIZES = [
  { value: "80%", label: "Tres petite", key: "xs" },
  { value: "90%", label: "Petite", key: "sm" },
  { value: "100%", label: "Normale", key: "md" },
  { value: "110%", label: "Grande", key: "lg" },
  { value: "120%", label: "Tres grande", key: "xl" },
];

function isValidFontSize(value) {
  return FONT_SIZE_VALUES.has(value);
}

export function getSavedFontSize() {
  const saved = localStorage.getItem(FONT_SIZE_STORAGE_KEY);
  return isValidFontSize(saved) ? saved : DEFAULT_FONT_SIZE;
}

export function applyDocumentFontSize(value) {
  document.documentElement.style.fontSize = isValidFontSize(value) ? value : DEFAULT_FONT_SIZE;
}

export function useFontSize() {
  const [fontSize, setFontSize] = useState(getSavedFontSize);

  useEffect(() => {
    applyDocumentFontSize(fontSize);
    localStorage.setItem(FONT_SIZE_STORAGE_KEY, fontSize);
  }, [fontSize]);

  function applyFontSize(value) {
    if (isValidFontSize(value)) setFontSize(value);
  }

  function resetFontSize() {
    setFontSize(DEFAULT_FONT_SIZE);
  }

  const currentOption = FONT_SIZES.find((option) => option.value === fontSize) || FONT_SIZES[2];

  return {
    fontSize,
    currentOption,
    fontSizeOptions: FONT_SIZES,
    applyFontSize,
    resetFontSize,
  };
}

export { FONT_SIZES };
