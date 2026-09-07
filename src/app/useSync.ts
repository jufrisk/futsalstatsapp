import { useSyncExternalStore } from "react";
import {
  getSyncStatus,
  subscribeSyncStatus,
  type SyncStatus,
} from "@/services/sync/syncEngine";

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(subscribeSyncStatus, getSyncStatus, getSyncStatus);
}
