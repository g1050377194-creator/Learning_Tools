"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { createContext, useContext, useSyncExternalStore } from "react";
import { loadStudy } from "@/lib/study";
import type { StudyData } from "@/lib/types";

const StudyContext = createContext<StudyData | undefined>(undefined);

function subscribe() {
  return () => {};
}

export function StudyProvider({ children }: { children: React.ReactNode }) {
  const client = useSyncExternalStore(subscribe, () => true, () => false);
  if (!client) {
    return <StudyContext.Provider value={undefined}>{children}</StudyContext.Provider>;
  }
  return <LiveStudy>{children}</LiveStudy>;
}

function LiveStudy({ children }: { children: React.ReactNode }) {
  const data = useLiveQuery(loadStudy, [], undefined);
  return <StudyContext.Provider value={data}>{children}</StudyContext.Provider>;
}

export function useStudy() {
  return useContext(StudyContext);
}
