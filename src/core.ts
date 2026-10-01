import type {
  DefinedPaneConfig,
  PaneChange,
  PaneDefinition,
  PaneDefinitions,
  PaneEntry,
  PaneEvent,
  PaneManagerConfig,
  PaneName,
  PaneSchema,
  PaneSnapshot,
  PaneState,
  PaneTarget,
  PaneTransition,
} from "./types.js";

const DEFAULT_MAX_VISIBLE = 2;

interface ResolvedPaneConfig<Schema extends PaneSchema> {
  readonly panes: PaneDefinitions<Schema>;
  readonly initialStack: readonly PaneTarget<Schema>[];
  readonly maxVisible: number;
  readonly minimumDepth: number;
  readonly selectVisiblePanes: PaneManagerConfig<Schema>["selectVisiblePanes"];
}

function assertPositiveInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${label} must be a positive integer.`);
  }
}

function assertNonNegativeInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer.`);
  }
}

function hasOwn(object: object, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function resolveConfig<Schema extends PaneSchema>(
  config: PaneManagerConfig<Schema>,
): ResolvedPaneConfig<Schema> {
  const paneNames = Object.keys(config.panes) as PaneName<Schema>[];

  if (paneNames.length === 0) {
    throw new Error("At least one pane definition is required.");
  }

  const maxVisible = config.display?.maxVisible ?? DEFAULT_MAX_VISIBLE;
  assertPositiveInteger(maxVisible, "display.maxVisible");

  for (const pane of paneNames) {
    const definition = config.panes[pane] as PaneDefinition<
      Schema,
      PaneName<Schema>
    >;
    const paneMaxVisible = definition.display?.maxVisible;

    if (paneMaxVisible !== undefined) {
      assertPositiveInteger(
        paneMaxVisible,
        `panes.${pane}.display.maxVisible`,
      );
    }

    for (const parent of definition.canOpenFrom ?? []) {
      if (!hasOwn(config.panes, parent)) {
        throw new Error(
          `Pane "${pane}" references unknown parent pane "${parent}".`,
        );
      }
    }
  }

  const initialStack = config.initialStack ?? [];
  const minimumDepth =
    config.minimumDepth ?? (initialStack.length === 0 ? 0 : 1);
  assertNonNegativeInteger(minimumDepth, "minimumDepth");

  if (minimumDepth > initialStack.length) {
    throw new Error(
      "minimumDepth cannot be greater than the initial stack length.",
    );
  }

  return {
    panes: config.panes,
    initialStack,
    maxVisible,
    minimumDepth,
    selectVisiblePanes: config.selectVisiblePanes,
  };
}

function definitionFor<Schema extends PaneSchema>(
  config: ResolvedPaneConfig<Schema>,
  pane: string,
): PaneDefinition<Schema, PaneName<Schema>> {
  if (!hasOwn(config.panes, pane)) {
    throw new Error(`Unknown pane "${pane}".`);
  }

  return config.panes[pane as PaneName<Schema>] as PaneDefinition<
    Schema,
    PaneName<Schema>
  >;
}

function generatedKey<Schema extends PaneSchema>(
  pane: PaneName<Schema>,
  seed: number,
  stack: readonly PaneEntry<Schema>[],
): string {
  const base = `${pane}:${seed}`;
  let key = base;
  let suffix = 2;

  while (stack.some((entry) => entry.key === key)) {
    key = `${base}:${suffix}`;
    suffix += 1;
  }

  return key;
}

function entryFromTarget<Schema extends PaneSchema>(
  target: PaneTarget<Schema>,
  depth: number,
  seed: number,
  stack: readonly PaneEntry<Schema>[],
): PaneEntry<Schema> {
  const key = target.key ?? generatedKey(target.pane, seed, stack);

  if (key.length === 0) {
    throw new Error("Pane keys cannot be empty.");
  }

  if (stack.some((entry) => entry.key === key)) {
    throw new Error(`Duplicate pane key "${key}".`);
  }

  return Object.freeze({
    key,
    pane: target.pane,
    params: "params" in target ? target.params : undefined,
    data: "data" in target ? target.data : undefined,
    depth,
  }) as PaneEntry<Schema>;
}

function assertCanOpen<Schema extends PaneSchema>(
  config: ResolvedPaneConfig<Schema>,
  pane: PaneName<Schema>,
  parent: PaneEntry<Schema> | undefined,
): void {
  const definition = definitionFor(config, pane);
  const allowedParents = definition.canOpenFrom;

  if (allowedParents === undefined) {
    return;
  }

  if (parent === undefined || !allowedParents.includes(parent.pane)) {
    const from = parent === undefined ? "an empty stack" : `"${parent.pane}"`;
    throw new Error(`Pane "${pane}" cannot open from ${from}.`);
  }
}

function buildStack<Schema extends PaneSchema>(
  config: ResolvedPaneConfig<Schema>,
  targets: readonly PaneTarget<Schema>[],
  seedOffset: number,
): readonly PaneEntry<Schema>[] {
  const stack: PaneEntry<Schema>[] = [];

  targets.forEach((target, index) => {
    definitionFor(config, target.pane);

    if (index > 0) {
      assertCanOpen(config, target.pane, stack[index - 1]);
    }

    stack.push(
      entryFromTarget(target, index, seedOffset + index + 1, stack),
    );
  });

  return Object.freeze(stack);
}

function freezeState<Schema extends PaneSchema>(
  stack: readonly PaneEntry<Schema>[],
  revision: number,
): PaneState<Schema> {
  return Object.freeze({
    stack: Object.freeze([...stack]),
    revision,
  });
}

function validateVisiblePanes<Schema extends PaneSchema>(
  stack: readonly PaneEntry<Schema>[],
  selected: readonly PaneEntry<Schema>[],
): readonly PaneEntry<Schema>[] {
  const indexes = selected.map((selectedEntry) =>
    stack.findIndex((entry) => entry.key === selectedEntry.key),
  );

  if (indexes.some((index) => index === -1)) {
    throw new Error("selectVisiblePanes returned an entry outside the stack.");
  }

  if (new Set(indexes).size !== indexes.length) {
    throw new Error("selectVisiblePanes returned duplicate entries.");
  }

  if (
    indexes.some(
      (index, position) => position > 0 && index <= indexes[position - 1]!,
    )
  ) {
    throw new Error("selectVisiblePanes must preserve stack order.");
  }

  if (stack.length > 0 && !indexes.includes(stack.length - 1)) {
    throw new Error("selectVisiblePanes must include the active pane.");
  }

  return Object.freeze(indexes.map((index) => stack[index]!));
}

function snapshotFromResolvedConfig<Schema extends PaneSchema>(
  config: ResolvedPaneConfig<Schema>,
  state: PaneState<Schema>,
): PaneSnapshot<Schema> {
  const activePane = state.stack.at(-1);
  const activeDefinition = activePane
    ? definitionFor(config, activePane.pane)
    : undefined;
  const selected = config.selectVisiblePanes
    ? config.selectVisiblePanes(state.stack, {
        activeDefinition,
        definitions: config.panes,
      })
    : state.stack.slice(
        -(activeDefinition?.display?.maxVisible ?? config.maxVisible),
      );
  const visiblePanes = validateVisiblePanes(state.stack, selected);

  return Object.freeze({
    stack: state.stack,
    revision: state.revision,
    visiblePanes,
    activePane,
    canGoBack: state.stack.length > config.minimumDepth,
  });
}

function transitionWithResolvedConfig<Schema extends PaneSchema>(
  config: ResolvedPaneConfig<Schema>,
  state: PaneState<Schema>,
  event: PaneEvent<Schema>,
): PaneTransition<Schema> {
  const nextRevision = state.revision + 1;

  switch (event.type) {
    case "navigate": {
      definitionFor(config, event.target.pane);
      assertCanOpen(config, event.target.pane, state.stack.at(-1));
      const added = entryFromTarget(
        event.target,
        state.stack.length,
        nextRevision,
        state.stack,
      );
      const nextState = freezeState([...state.stack, added], nextRevision);
      return {
        state: nextState,
        change: Object.freeze({ type: "navigate", added }),
      };
    }

    case "back": {
      const steps = event.steps ?? 1;
      assertPositiveInteger(steps, "back steps");
      const removeCount = Math.min(
        steps,
        Math.max(0, state.stack.length - config.minimumDepth),
      );

      if (removeCount === 0) {
        return { state, change: undefined };
      }

      const removed = Object.freeze(state.stack.slice(-removeCount));
      const nextState = freezeState(
        state.stack.slice(0, -removeCount),
        nextRevision,
      );
      return {
        state: nextState,
        change: Object.freeze({ type: "back", removed }),
      };
    }

    case "back-to": {
      let index = -1;

      if (event.target.key !== undefined) {
        index = state.stack.findIndex(
          (entry) => entry.key === event.target.key,
        );
      } else {
        for (let cursor = state.stack.length - 1; cursor >= 0; cursor -= 1) {
          if (state.stack[cursor]?.pane === event.target.pane) {
            index = cursor;
            break;
          }
        }
      }

      if (index === -1) {
        const description =
          event.target.key !== undefined
            ? `key "${event.target.key}"`
            : `pane "${event.target.pane}"`;
        throw new Error(
          `Cannot go back to ${description}; it is not in the stack.`,
        );
      }

      if (index + 1 < config.minimumDepth) {
        throw new Error("Cannot go back below minimumDepth.");
      }

      if (index === state.stack.length - 1) {
        return { state, change: undefined };
      }

      const removed = Object.freeze(state.stack.slice(index + 1));
      const nextState = freezeState(
        state.stack.slice(0, index + 1),
        nextRevision,
      );
      return {
        state: nextState,
        change: Object.freeze({ type: "back-to", removed }),
      };
    }

    case "replace": {
      if (state.stack.length === 0) {
        throw new Error("Cannot replace a pane in an empty stack.");
      }

      definitionFor(config, event.target.pane);
      const parent = state.stack.at(-2);
      assertCanOpen(config, event.target.pane, parent);

      const removed = state.stack.at(-1)!;
      const parentStack = state.stack.slice(0, -1);
      const added = entryFromTarget(
        event.target,
        state.stack.length - 1,
        nextRevision,
        parentStack,
      );
      const nextState = freezeState([...parentStack, added], nextRevision);
      return {
        state: nextState,
        change: Object.freeze({ type: "replace", added, removed }),
      };
    }

    case "reset": {
      const targets = event.stack ?? config.initialStack;

      if (targets.length < config.minimumDepth) {
        throw new Error("Reset stack cannot be smaller than minimumDepth.");
      }

      const added = buildStack(config, targets, nextRevision);
      const removed = Object.freeze([...state.stack]);

      if (
        added.length === state.stack.length &&
        added.every((entry, index) => {
          const current = state.stack[index];
          return (
            current?.key === entry.key &&
            current.pane === entry.pane &&
            current.params === entry.params &&
            current.data === entry.data
          );
        })
      ) {
        return { state, change: undefined };
      }

      const nextState = freezeState(added, nextRevision);
      return {
        state: nextState,
        change: Object.freeze({ type: "reset", added, removed }),
      };
    }
  }
}

export function definePaneConfig<Schema extends PaneSchema>(
  config: PaneManagerConfig<Schema>,
): DefinedPaneConfig<Schema> {
  return config;
}

export function createPaneState<Schema extends PaneSchema>(
  config: PaneManagerConfig<Schema>,
): PaneState<Schema> {
  const resolved = resolveConfig(config);
  const stack = buildStack(resolved, resolved.initialStack, 0);
  return freezeState(stack, 0);
}

export function transitionPaneState<Schema extends PaneSchema>(
  config: PaneManagerConfig<Schema>,
  state: PaneState<Schema>,
  event: PaneEvent<Schema>,
): PaneTransition<Schema> {
  return transitionWithResolvedConfig(resolveConfig(config), state, event);
}

export function createPaneSnapshot<Schema extends PaneSchema>(
  config: PaneManagerConfig<Schema>,
  state: PaneState<Schema>,
): PaneSnapshot<Schema> {
  return snapshotFromResolvedConfig(resolveConfig(config), state);
}

export const internal = {
  resolveConfig,
  snapshotFromResolvedConfig,
  transitionWithResolvedConfig,
};
