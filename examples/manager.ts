import {
  createPaneManager,
  definePaneConfig,
  type PaneSnapshot,
} from "growing-panes";

type AppPanes = {
  projects: {
    params: undefined;
    meta: { title: string };
  };
  project: {
    params: { projectId: string };
    data: { name: string } | undefined;
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

const manager = createPaneManager(config);

function printSnapshot(snapshot: PaneSnapshot<AppPanes>): void {
  console.log({
    stack: snapshot.stack.map((entry) => entry.pane),
    visible: snapshot.visiblePanes.map((entry) => entry.pane),
    active: snapshot.activePane?.pane,
    canGoBack: snapshot.canGoBack,
  });
}

const unsubscribe = manager.subscribe((snapshot, change) => {
  console.log(`Navigation event: ${change.type}`);
  printSnapshot(snapshot);
});

manager.navigate({
  pane: "project",
  params: { projectId: "project-123" },
  data: { name: "Growing Panes" },
});

manager.navigate({
  pane: "task",
  params: { taskId: "task-456" },
});

// The preview definition overrides maxVisible, so project, task, and preview
// are all selected for display.
manager.navigate({
  pane: "preview",
  params: { taskId: "task-456" },
});

manager.back();
manager.backTo({ pane: "projects" });

unsubscribe();
