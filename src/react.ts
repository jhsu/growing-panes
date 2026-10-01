import { useSyncExternalStore } from "react";

import type {
  PaneEntry,
  PaneManager,
  PaneSchema,
  PaneSnapshot,
} from "./types.js";

/**
 * Subscribe a React component to a pane manager and return its current
 * immutable snapshot.
 */
export function usePaneSnapshot<Schema extends PaneSchema>(
  manager: PaneManager<Schema>,
): PaneSnapshot<Schema> {
  return useSyncExternalStore(
    manager.subscribe,
    manager.getSnapshot,
    manager.getSnapshot,
  );
}

/** Return the pane entries currently selected by the display policy. */
export function useVisiblePanes<Schema extends PaneSchema>(
  manager: PaneManager<Schema>,
): readonly PaneEntry<Schema>[] {
  return usePaneSnapshot(manager).visiblePanes;
}
