"use client";

import { useSyncExternalStore } from "react";
import {
  activeModel,
  getModelSnapshot,
  getServerModelSnapshot,
  modelReady,
  subscribeModels,
} from "@/lib/models";

export function useModels() {
  const snapshot = useSyncExternalStore(subscribeModels, getModelSnapshot, getServerModelSnapshot);
  const current = activeModel(snapshot);
  return { ...snapshot, current, ready: modelReady(current) };
}
