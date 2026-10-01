# Headless core API draft

Status: initial implementation. This document still records design rationale
and possible follow-up work.

## Goals

The core library should:

- model navigation as a stack of pane instances;
- expose which panes are currently displayed;
- support moving deeper, moving back, replacing the active pane, and resetting;
- keep pane configuration separate from runtime pane state;
- work in Node.js, browsers, tests, SSR, and other JavaScript runtimes;
- have no dependency on a DOM, router, or UI framework.

Rendering, animation, URL synchronization, and component lifecycle belong in
optional adapters rather than the core package.

## Proposed mental model

There are three separate concepts:

1. **Pane definition**: static configuration for a kind of pane.
2. **Pane entry**: one instance of a pane in the navigation stack.
3. **Snapshot**: the complete stack plus the entries selected for display.

For example, two different projects may create two entries using the same
`project` definition but different parameters and instance keys.

## Example

```ts
import { createPaneManager, definePaneConfig } from "growing-panes";

type AppPanes = {
  projects: {
    params: undefined;
  };
  project: {
    params: { projectId: string };
  };
  task: {
    params: { projectId: string; taskId: string };
  };
  preview: {
    params: { taskId: string };
  };
};

const config = definePaneConfig<AppPanes>({
  display: {
    maxVisible: 2,
  },

  panes: {
    projects: {
      meta: { title: "Projects" },
    },
    project: {
      canOpenFrom: ["projects"],
      meta: { title: "Project" },
    },
    task: {
      canOpenFrom: ["project"],
      meta: { title: "Task" },
    },
    preview: {
      canOpenFrom: ["task"],
      // When preview is active, display the deepest three panes instead of two.
      display: { maxVisible: 3 },
      meta: { title: "Preview" },
    },
  },

  initialStack: [{ pane: "projects" }],
});

const panes = createPaneManager(config);

panes.navigate({
  pane: "project",
  params: { projectId: "p-123" },
});

panes.navigate({
  pane: "task",
  params: { projectId: "p-123", taskId: "t-456" },
});

const snapshot = panes.getSnapshot();

snapshot.stack;        // projects, project, task
snapshot.visiblePanes; // project, task
snapshot.activePane;   // task
snapshot.canGoBack;    // true

panes.back();          // active pane is now project
panes.back({ steps: 1 });
```

The type map is optional in JavaScript. In TypeScript it makes pane names and
their parameters type-safe.

## Pane configuration

```ts
interface PaneDefinition<TMeta = unknown> {
  /** Optional navigation constraint. Omit to allow any parent. */
  canOpenFrom?: readonly string[];

  /** Overrides the manager's display policy while this pane is active. */
  display?: {
    maxVisible?: number;
  };

  /** Application-owned configuration; the core does not interpret it. */
  meta?: TMeta;
}

interface PaneManagerConfig {
  panes: Record<string, PaneDefinition>;

  initialStack?: readonly PaneTarget[];

  display?: {
    /** Number of deepest stack entries to display. Default: 2. */
    maxVisible?: number;
  };

  /** Optional replacement for the default "last N entries" policy. */
  selectVisiblePanes?: (
    stack: readonly PaneEntry[],
    context: { activeDefinition?: PaneDefinition },
  ) => readonly PaneEntry[];
}
```

`meta` is intentionally opaque. A React, Vue, terminal, or native
adapter could use it for labels, component identifiers, preferred sizes, or
animation hints without making those concepts dependencies of the core.

`canOpenFrom` describes valid stack relationships, not rendering nesting. It
can also contain the pane's own name for recursive flows such as folders or
drill-down category browsers. When omitted, navigation to that pane is
unrestricted.

## Runtime entries

```ts
interface PaneTarget<TParams = unknown, TData = unknown> {
  pane: string;
  params?: TParams;

  /** Optional instance data that is not part of the static definition. */
  data?: TData;

  /** Optional stable key; the manager generates one when omitted. */
  key?: string;
}

interface PaneEntry<TParams = unknown, TData = unknown> {
  readonly key: string;
  readonly pane: string;
  readonly params: TParams;
  readonly data: TData;
  readonly depth: number;
}
```

`params` should normally contain serializable identity such as record IDs.
`data` may contain transient application data. The core stores both but does
not fetch data, render content, or mutate either value.

## Snapshot

```ts
interface PaneSnapshot {
  /** Every entry in navigation order, including currently hidden entries. */
  readonly stack: readonly PaneEntry[];

  /** Entries selected by the current display policy, in stack order. */
  readonly visiblePanes: readonly PaneEntry[];

  /** The deepest entry, if the stack is not empty. */
  readonly activePane: PaneEntry | undefined;

  readonly canGoBack: boolean;
  readonly revision: number;
}
```

Snapshots and their arrays should be immutable. A UI adapter can use
`visiblePanes` as its render model while retaining `stack` for breadcrumbs,
navigation controls, or debugging.

## Manager API

```ts
interface PaneManager {
  getSnapshot(): PaneSnapshot;

  /** Append a pane entry and make it active. */
  navigate(target: PaneTarget): PaneSnapshot;

  /** Remove one or more entries from the end of the stack. */
  back(options?: { steps?: number }): PaneSnapshot;

  /** Remove entries after the selected existing entry. */
  backTo(target: { key: string } | { pane: string }): PaneSnapshot;

  /** Replace the active entry without changing the stack depth. */
  replace(target: PaneTarget): PaneSnapshot;

  /** Replace the entire stack. Useful for logout or workspace changes. */
  reset(stack?: readonly PaneTarget[]): PaneSnapshot;

  /** Check definitions and transition constraints without changing state. */
  canNavigate(target: PaneTarget): boolean;

  /** Send a state-machine event directly. */
  dispatch(event: PaneEvent): PaneSnapshot;

  /** Called after each state change. Returns an unsubscribe function. */
  subscribe(listener: PaneListener): () => void;
}

type PaneListener = (
  snapshot: PaneSnapshot,
  change: PaneChange,
) => void;
```

`navigate` always means “go one level deeper.” It does not search the existing
stack, modify browser history, or infer a route. `backTo` is the explicit API
for selecting an existing ancestor.

`backTo({ pane })` selects the nearest matching pane starting from the active
entry. Selecting an exact instance by `key` avoids ambiguity when a pane kind
appears more than once.

## Change events

Subscribers need enough information to coordinate effects and animations
without diffing snapshots themselves:

```ts
type PaneChange =
  | { type: "navigate"; added: PaneEntry }
  | { type: "back"; removed: readonly PaneEntry[] }
  | { type: "back-to"; removed: readonly PaneEntry[] }
  | { type: "replace"; added: PaneEntry; removed: PaneEntry }
  | {
      type: "reset";
      added: readonly PaneEntry[];
      removed: readonly PaneEntry[];
    };
```

All operations are synchronous in the first version. Data loading, async
confirmation, and URL updates can happen before an operation or in a framework
adapter. This keeps the state machine deterministic and easy to test.

## Display policy

The default policy is deliberately small:

1. Read `maxVisible` from the active pane definition when present.
2. Otherwise use the manager-level `display.maxVisible`.
3. Otherwise use `2`.
4. Select the last `maxVisible` entries in the stack.

This preserves the main behavior of the original library without relying on a
manually maintained depth value. A custom `selectVisiblePanes` function can
implement policies such as always showing the root pane or varying visibility
based on viewport information supplied by an adapter.

## Error and boundary behavior

Recommended first-version behavior:

- unknown pane names, duplicate keys, invalid initial stacks, and disallowed
  transitions throw descriptive errors;
- `back()` at the root is a no-op;
- `back({ steps })` never removes more entries than allowed by the configured
  minimum stack size;
- `backTo` throws when no matching entry exists;
- subscribers are not called for no-op operations;
- definitions, entries, and snapshots are treated as immutable values.

The default minimum stack size is one when an initial stack is configured, and
zero otherwise. This preserves the root while still allowing a hydrated deep
stack to navigate back. It can be changed with `minimumDepth`.

## Deliberately outside the core

- DOM elements and component references
- CSS classes, widths, and animation implementation
- React, Vue, or other framework lifecycle behavior
- browser history and URL parsing
- server requests and loading/error states
- persistence format
- focus management and keyboard bindings

Those concerns can be added as adapters after the core behavior is stable.

## Open design questions

1. Should `canOpenFrom` be enforced by default, or should all navigation rules
   live in one global guard callback?
2. Should normal back navigation preserve the entire `initialStack`, or only
   its first/root entry?
3. Should a custom display selector receive only core state, or an explicit
   caller-provided environment value for responsive policies?
4. Should serialization and hydration be part of the first release or a later
   extension?
