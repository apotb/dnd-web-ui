"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

function storageKey(campaignId: string) {
  return `dm-view-enabled-${campaignId}`;
}

function readEnabled(campaignId: string): boolean {
  if (typeof window === "undefined") return true;
  try {
    const stored = localStorage.getItem(storageKey(campaignId));
    if (stored === "false") return false;
    if (stored === "true") return true;
    return true;
  } catch {
    return true;
  }
}

interface DmViewContextValue {
  dmViewEnabled: boolean;
  setDmViewEnabled: (enabled: boolean) => void;
}

const DmViewContext = createContext<DmViewContextValue | null>(null);

interface DmViewProviderProps {
  campaignId: string;
  isDm: boolean;
  children: ReactNode;
}

export function DmViewProvider({
  campaignId,
  isDm,
  children,
}: DmViewProviderProps) {
  const [dmViewEnabled, setDmViewEnabledState] = useState(() =>
    readEnabled(campaignId)
  );

  useEffect(() => {
    setDmViewEnabledState(readEnabled(campaignId));
  }, [campaignId]);

  const setDmViewEnabled = useCallback(
    (enabled: boolean) => {
      if (!isDm) return;
      setDmViewEnabledState(enabled);
      try {
        localStorage.setItem(storageKey(campaignId), String(enabled));
      } catch {
        // ignore storage errors
      }
    },
    [campaignId, isDm]
  );

  const value = useMemo(
    () => ({ dmViewEnabled: isDm ? dmViewEnabled : true, setDmViewEnabled }),
    [dmViewEnabled, isDm, setDmViewEnabled]
  );

  return (
    <DmViewContext.Provider value={value}>{children}</DmViewContext.Provider>
  );
}

export function useDmViewEnabled(): {
  dmViewEnabled: boolean;
  setDmViewEnabled: (enabled: boolean) => void;
} {
  const ctx = useContext(DmViewContext);
  if (!ctx) {
    return {
      dmViewEnabled: true,
      setDmViewEnabled: () => {},
    };
  }
  return ctx;
}

/** UI visibility flag: true when DM chrome should show. Pass the real isDm prop. */
export function useShowDmUi(isDm: boolean): boolean {
  const { dmViewEnabled } = useDmViewEnabled();
  if (!isDm) return false;
  return dmViewEnabled;
}
