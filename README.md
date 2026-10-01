# growing-panes

Headless stack-based pane navigation for JavaScript and TypeScript.

Growing Panes manages pane definitions, navigation state, and the set of panes
that should be displayed. It does not require a DOM, router, or UI framework.

[View the interactive demo](https://jhsu.github.io/growing-panes/).

## Install

```sh
pnpm add growing-panes
```

## Usage

Define the pane types and their navigation relationships:

```ts
import { createPaneManager, definePaneConfig } from "growing-panes";

type AppPanes = {
  projects: {
    params: undefined;
    meta: { title: string };
  };
  project: {
    params: { projectId: string };
    meta: { title: string };
  };
  task: {
    params: { taskId: string };
    meta: { title: string };
  };
  preview: {
    params: { taskId: string };
    meta: { title: string };
  };
};

const config = definePaneConfig<AppPanes>({
  display: { maxVisible: 2 },
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
  params: { taskId: "t-456" },
});

const snapshot = panes.getSnapshot();

snapshot.stack;        // projects, project, task
snapshot.visiblePanes; // project, task
snapshot.activePane;   // task
snapshot.canGoBack;    // true

panes.back();
```

## Manager API

The manager provides these navigation operations:

- `navigate(target)` appends a pane and makes it active.
- `back({ steps })` removes panes from the end of the stack.
- `backTo({ key })` or `backTo({ pane })` selects an existing ancestor.
- `replace(target)` replaces the active pane.
- `reset(stack)` replaces the complete stack.
- `canNavigate(target)` checks a transition without changing state.
- `subscribe(listener)` observes successful state changes.
- `dispatch(event)` sends a state-machine event directly.

Snapshots are immutable. `visiblePanes`, `activePane`, and `canGoBack` are
derived from the stack rather than stored independently.

## Pure state transitions

The core can also be used without the manager wrapper:

```ts
import { createPaneState, transitionPaneState } from "growing-panes";

const state = createPaneState(config);
const transition = transitionPaneState(config, state, {
  type: "navigate",
  target: {
    pane: "project",
    params: { projectId: "p-123" },
  },
});

transition.state;
transition.change;
```

This reducer-style API is synchronous and deterministic. Data loading, URL
synchronization, rendering, animations, and focus management belong in
application code or framework adapters.

## React

React applications can subscribe through the optional `growing-panes/react`
entry point. Importing the core package does not load React.

```tsx
import { usePaneSnapshot } from "growing-panes/react";

function PaneContainer({ manager }) {
  const snapshot = usePaneSnapshot(manager);

  return snapshot.visiblePanes.map((entry) => (
    <PaneRenderer key={entry.key} entry={entry} />
  ));
}
```

Use `useVisiblePanes(manager)` when only the visible entry list is needed.
React 18 or newer is required for these hooks.

## Development

```sh
pnpm install
pnpm check
pnpm changeset
pnpm site:dev
```

The fuller design discussion is in
[`docs/core-api-draft.md`](docs/core-api-draft.md).

## Examples

- [`examples/manager.ts`](examples/manager.ts) uses the subscription-based
  manager API for a projects and tasks flow.
- [`examples/state-machine.ts`](examples/state-machine.ts) uses the pure
  transition API for a recursive file browser.
