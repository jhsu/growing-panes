import { createPaneState, internal } from "./core.js";
import type {
  PaneBackToTarget,
  PaneListener,
  PaneManager,
  PaneManagerConfig,
  PaneName,
  PaneSchema,
  PaneSnapshot,
  PaneTarget,
  PaneTargetFor,
} from "./types.js";

export function createPaneManager<Schema extends PaneSchema>(
  config: PaneManagerConfig<Schema>,
): PaneManager<Schema> {
  const resolved = internal.resolveConfig(config);
  let state = createPaneState(config);
  let snapshot = internal.snapshotFromResolvedConfig(resolved, state);
  const listeners = new Set<PaneListener<Schema>>();

  const dispatch: PaneManager<Schema>["dispatch"] = (event) => {
    const transition = internal.transitionWithResolvedConfig(
      resolved,
      state,
      event,
    );

    if (transition.change === undefined) {
      return snapshot;
    }

    const nextSnapshot = internal.snapshotFromResolvedConfig(
      resolved,
      transition.state,
    );
    state = transition.state;
    snapshot = nextSnapshot;

    for (const listener of [...listeners]) {
      listener(snapshot, transition.change);
    }

    return snapshot;
  };

  return {
    getSnapshot() {
      return snapshot;
    },

    getDefinition<Name extends PaneName<Schema>>(pane: Name) {
      if (!Object.prototype.hasOwnProperty.call(resolved.panes, pane)) {
        throw new Error(`Unknown pane "${pane}".`);
      }

      return resolved.panes[pane];
    },

    navigate<Name extends PaneName<Schema>>(
      target: PaneTargetFor<Schema, Name>,
    ): PaneSnapshot<Schema> {
      return dispatch({ type: "navigate", target } as Parameters<
        typeof dispatch
      >[0]);
    },

    back(options = {}) {
      return dispatch(
        options.steps === undefined
          ? { type: "back" }
          : { type: "back", steps: options.steps },
      );
    },

    backTo(target: PaneBackToTarget<Schema>) {
      return dispatch({ type: "back-to", target });
    },

    replace<Name extends PaneName<Schema>>(
      target: PaneTargetFor<Schema, Name>,
    ): PaneSnapshot<Schema> {
      return dispatch({ type: "replace", target } as Parameters<
        typeof dispatch
      >[0]);
    },

    reset(stack?: readonly PaneTarget<Schema>[]) {
      return dispatch(
        stack === undefined ? { type: "reset" } : { type: "reset", stack },
      );
    },

    canNavigate<Name extends PaneName<Schema>>(
      target: PaneTargetFor<Schema, Name>,
    ): boolean {
      try {
        internal.transitionWithResolvedConfig(resolved, state, {
          type: "navigate",
          target,
        } as Parameters<typeof dispatch>[0]);
        return true;
      } catch {
        return false;
      }
    },

    dispatch,

    subscribe(listener: PaneListener<Schema>) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
