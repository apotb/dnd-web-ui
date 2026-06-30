"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";

export interface DraftNumberInputProps {
  value: number | undefined;
  onCommit: (value: number | undefined) => void;
  min?: number;
  max?: number;
  allowDecimal?: boolean;
  allowNegative?: boolean;
  /** When true, empty input commits as undefined instead of min/0. */
  optional?: boolean;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  "aria-label"?: string;
}

function formatValue(
  value: number | undefined,
  allowDecimal: boolean,
  optional: boolean
): string {
  if (optional && value == null) return "";
  const n = value ?? 0;
  if (allowDecimal) {
    const rounded = Math.round(n * 100) / 100;
    if (Number.isInteger(rounded)) return String(rounded);
    return rounded.toFixed(2).replace(/\.?0+$/, "");
  }
  return String(Math.trunc(n));
}

function sanitizeDraft(
  raw: string,
  allowDecimal: boolean,
  allowNegative: boolean
): string {
  if (raw === "") return "";

  if (allowDecimal) {
    let next = "";
    let hasDot = false;
    for (let i = 0; i < raw.length; i++) {
      const ch = raw[i];
      if (ch >= "0" && ch <= "9") {
        next += ch;
        continue;
      }
      if (allowNegative && ch === "-" && next === "") {
        next = "-";
        continue;
      }
      if (ch === "." && !hasDot) {
        hasDot = true;
        next += ch;
      }
    }
    return next;
  }

  let next = "";
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (ch >= "0" && ch <= "9") {
      next += ch;
      continue;
    }
    if (allowNegative && ch === "-" && next === "") {
      next = "-";
    }
  }
  return next;
}

function parseDraft(
  raw: string,
  allowDecimal: boolean
): number | null {
  const trimmed = raw.trim();
  if (trimmed === "" || trimmed === "-" || trimmed === "." || trimmed === "-.") {
    return null;
  }
  const n = allowDecimal ? parseFloat(trimmed) : parseInt(trimmed, 10);
  return Number.isFinite(n) ? n : null;
}

function clampValue(
  n: number,
  min: number | undefined,
  max: number | undefined,
  allowDecimal: boolean,
  allowNegative: boolean
): number {
  let value = n;
  if (!allowNegative && value < 0) value = min ?? 0;
  if (min != null && value < min) value = min;
  if (max != null && value > max) value = max;
  return allowDecimal ? Math.round(value * 100) / 100 : Math.trunc(value);
}

export function DraftNumberInput({
  value,
  onCommit,
  min,
  max,
  allowDecimal = false,
  allowNegative = false,
  optional = false,
  className,
  placeholder,
  disabled,
  "aria-label": ariaLabel,
}: DraftNumberInputProps) {
  const [draft, setDraft] = useState(() =>
    formatValue(value, allowDecimal, optional)
  );
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) {
      setDraft(formatValue(value, allowDecimal, optional));
    }
  }, [value, allowDecimal, optional]);

  function commit(raw: string) {
    const parsed = parseDraft(raw, allowDecimal);
    if (parsed === null) {
      if (optional) {
        onCommit(undefined);
        setDraft("");
        return;
      }
      const fallback = min ?? 0;
      onCommit(fallback);
      setDraft(formatValue(fallback, allowDecimal, false));
      return;
    }

    const next = clampValue(parsed, min, max, allowDecimal, allowNegative);
    onCommit(next);
    setDraft(formatValue(next, allowDecimal, false));
  }

  return (
    <Input
      type="text"
      inputMode={allowDecimal ? "decimal" : "numeric"}
      className={className}
      placeholder={placeholder}
      disabled={disabled}
      aria-label={ariaLabel}
      value={draft}
      onFocus={() => {
        focused.current = true;
      }}
      onBlur={() => {
        focused.current = false;
        commit(draft);
      }}
      onChange={(e) =>
        setDraft(
          sanitizeDraft(e.target.value, allowDecimal, allowNegative)
        )
      }
    />
  );
}
