"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ConfirmModal } from "@/components/ui/confirm-modal";

interface CreationChoiceEditContextValue {
  requestEdit: (onAllowed: () => void) => void;
  registerDirty: (featureId: string, dirty: boolean) => void;
  hasUnsavedEdits: boolean;
}

const CreationChoiceEditContext = createContext<CreationChoiceEditContextValue | null>(
  null
);

export function useCreationChoiceEdit() {
  const context = useContext(CreationChoiceEditContext);
  if (!context) {
    throw new Error("useCreationChoiceEdit must be used within CreationChoiceEditProvider");
  }
  return context;
}

export function useCreationChoiceEditOptional() {
  return useContext(CreationChoiceEditContext);
}

export function CreationChoiceEditProvider({ children }: { children: ReactNode }) {
  const [warnAcknowledged, setWarnAcknowledged] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const pendingEditRef = useRef<(() => void) | null>(null);
  const dirtyFeaturesRef = useRef(new Set<string>());
  const [dirtyVersion, setDirtyVersion] = useState(0);

  const bumpDirty = useCallback(() => {
    setDirtyVersion((version) => version + 1);
  }, []);

  const registerDirty = useCallback(
    (featureId: string, dirty: boolean) => {
      const set = dirtyFeaturesRef.current;
      const had = set.has(featureId);
      if (dirty && !had) {
        set.add(featureId);
        bumpDirty();
      } else if (!dirty && had) {
        set.delete(featureId);
        bumpDirty();
      }
    },
    [bumpDirty]
  );

  const hasUnsavedEdits = dirtyFeaturesRef.current.size > 0;
  void dirtyVersion;

  const requestEdit = useCallback(
    (onAllowed: () => void) => {
      if (warnAcknowledged) {
        onAllowed();
        return;
      }
      pendingEditRef.current = onAllowed;
      setShowWarning(true);
    },
    [warnAcknowledged]
  );

  const handleConfirmWarning = useCallback(() => {
    setWarnAcknowledged(true);
    setShowWarning(false);
    const pending = pendingEditRef.current;
    pendingEditRef.current = null;
    pending?.();
  }, []);

  const handleCancelWarning = useCallback(() => {
    setShowWarning(false);
    pendingEditRef.current = null;
  }, []);

  const value = useMemo(
    () => ({
      requestEdit,
      registerDirty,
      hasUnsavedEdits: dirtyFeaturesRef.current.size > 0,
    }),
    [requestEdit, registerDirty, dirtyVersion]
  );

  return (
    <CreationChoiceEditContext.Provider value={value}>
      {children}
      <ConfirmModal
        open={showWarning}
        title="Edit character creation choice?"
        description="This was picked at character creation. Changing it is technically cheating — only continue if you're okay with that."
        confirmLabel="I'm okay with that"
        cancelLabel="Cancel"
        onConfirm={handleConfirmWarning}
        onCancel={handleCancelWarning}
      />
    </CreationChoiceEditContext.Provider>
  );
}
