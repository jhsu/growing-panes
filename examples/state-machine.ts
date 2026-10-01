import {
  createPaneSnapshot,
  createPaneState,
  definePaneConfig,
  transitionPaneState,
  type PaneEvent,
  type PaneState,
} from "growing-panes";

type BrowserPanes = {
  root: {
    params: undefined;
    meta: { label: string };
  };
  folder: {
    params: { path: string };
    meta: { label: string };
  };
  file: {
    params: { path: string };
    meta: { label: string };
  };
};

const config = definePaneConfig<BrowserPanes>({
  panes: {
    root: {
      meta: { label: "Files" },
    },
    folder: {
      // A folder can open from the root or another folder.
      canOpenFrom: ["root", "folder"],
      meta: { label: "Folder" },
    },
    file: {
      canOpenFrom: ["folder"],
      meta: { label: "File" },
    },
  },
  initialStack: [{ pane: "root" }],

  // Always display the root and active pane. This demonstrates that display
  // policy is derived independently from navigation state.
  selectVisiblePanes(stack) {
    return stack.length <= 2 ? stack : [stack[0]!, stack.at(-1)!];
  },
});

let state: PaneState<BrowserPanes> = createPaneState(config);

function send(event: PaneEvent<BrowserPanes>): void {
  const transition = transitionPaneState(config, state, event);
  state = transition.state;

  const snapshot = createPaneSnapshot(config, state);
  console.log({
    event: transition.change?.type ?? "no-op",
    stack: snapshot.stack.map((entry) => entry.pane),
    visible: snapshot.visiblePanes.map((entry) => entry.pane),
  });
}

send({
  type: "navigate",
  target: { pane: "folder", params: { path: "/documents" } },
});

send({
  type: "navigate",
  target: { pane: "folder", params: { path: "/documents/projects" } },
});

send({
  type: "navigate",
  target: {
    pane: "file",
    params: { path: "/documents/projects/README.md" },
  },
});

send({ type: "back", steps: 2 });
