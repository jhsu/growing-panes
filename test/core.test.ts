import { describe, expect, expectTypeOf, it, vi } from "vitest";

import {
  createPaneManager,
  createPaneState,
  definePaneConfig,
  transitionPaneState,
  type PaneTarget,
} from "../src/index.js";

type TestPanes = {
  home: {
    params: undefined;
    meta: { title: string };
  };
  project: {
    params: { projectId: string };
    data: { cachedName: string } | undefined;
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
  folder: {
    params: { path: string };
    meta: { title: string };
  };
};

const config = definePaneConfig<TestPanes>({
  panes: {
    home: { meta: { title: "Home" } },
    project: {
      canOpenFrom: ["home"],
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
    folder: {
      canOpenFrom: ["home", "folder"],
      meta: { title: "Folder" },
    },
  },
  initialStack: [{ pane: "home" }],
  display: { maxVisible: 2 },
});

describe("createPaneManager", () => {
  it("creates an immutable initial snapshot", () => {
    const manager = createPaneManager(config);
    const snapshot = manager.getSnapshot();

    expect(snapshot.stack.map((entry) => entry.pane)).toEqual(["home"]);
    expect(snapshot.visiblePanes).toEqual(snapshot.stack);
    expect(snapshot.activePane?.pane).toBe("home");
    expect(snapshot.canGoBack).toBe(false);
    expect(snapshot.revision).toBe(0);
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.stack)).toBe(true);
  });

  it("navigates deeper and derives the visible window", () => {
    const manager = createPaneManager(config);

    manager.navigate({
      pane: "project",
      params: { projectId: "p-1" },
      data: { cachedName: "One" },
    });
    const snapshot = manager.navigate({
      pane: "task",
      params: { taskId: "t-1" },
    });

    expect(snapshot.stack.map((entry) => entry.pane)).toEqual([
      "home",
      "project",
      "task",
    ]);
    expect(snapshot.visiblePanes.map((entry) => entry.pane)).toEqual([
      "project",
      "task",
    ]);
    expect(snapshot.activePane?.depth).toBe(2);
    expect(snapshot.canGoBack).toBe(true);
  });

  it("uses the active pane visibility override", () => {
    const manager = createPaneManager(config);
    manager.navigate({ pane: "project", params: { projectId: "p-1" } });
    manager.navigate({ pane: "task", params: { taskId: "t-1" } });
    const snapshot = manager.navigate({
      pane: "preview",
      params: { taskId: "t-1" },
    });

    expect(snapshot.visiblePanes.map((entry) => entry.pane)).toEqual([
      "project",
      "task",
      "preview",
    ]);
  });

  it("enforces navigation constraints and exposes canNavigate", () => {
    const manager = createPaneManager(config);

    expect(
      manager.canNavigate({ pane: "task", params: { taskId: "t-1" } }),
    ).toBe(false);
    expect(() =>
      manager.navigate({ pane: "task", params: { taskId: "t-1" } }),
    ).toThrow('Pane "task" cannot open from "home".');

    expect(
      manager.canNavigate({
        pane: "project",
        params: { projectId: "p-1" },
      }),
    ).toBe(true);
  });

  it("moves back without crossing the configured root", () => {
    const manager = createPaneManager(config);
    const listener = vi.fn();
    manager.subscribe(listener);

    manager.navigate({ pane: "project", params: { projectId: "p-1" } });
    const atRoot = manager.back({ steps: 10 });

    expect(atRoot.stack.map((entry) => entry.pane)).toEqual(["home"]);
    expect(listener).toHaveBeenCalledTimes(2);

    const unchanged = manager.back();
    expect(unchanged).toBe(atRoot);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("goes back to the nearest matching pane instance", () => {
    const manager = createPaneManager(config);
    manager.navigate({ pane: "folder", params: { path: "/a" }, key: "a" });
    manager.navigate({ pane: "folder", params: { path: "/a/b" }, key: "b" });
    manager.navigate({ pane: "folder", params: { path: "/a/b/c" }, key: "c" });

    expect(manager.backTo({ pane: "folder" }).activePane?.key).toBe("c");
    expect(manager.backTo({ key: "a" }).stack.map((entry) => entry.key)).toEqual([
      "home:1",
      "a",
    ]);
  });

  it("replaces the active pane and validates it against the parent", () => {
    const manager = createPaneManager(config);
    manager.navigate({ pane: "project", params: { projectId: "p-1" } });
    manager.navigate({ pane: "task", params: { taskId: "t-1" } });

    const snapshot = manager.replace({
      pane: "task",
      params: { taskId: "t-2" },
    });

    expect(snapshot.stack).toHaveLength(3);
    expect(snapshot.activePane?.params).toEqual({ taskId: "t-2" });
  });

  it("resets to the configured initial stack", () => {
    const manager = createPaneManager(config);
    manager.navigate({ pane: "project", params: { projectId: "p-1" } });

    const snapshot = manager.reset();

    expect(snapshot.stack.map((entry) => entry.pane)).toEqual(["home"]);
    expect(snapshot.revision).toBe(2);
  });

  it("supports a custom visibility selector", () => {
    const manager = createPaneManager<TestPanes>({
      ...config,
      selectVisiblePanes(stack) {
        return stack.length < 2 ? stack : [stack[0]!, stack.at(-1)!];
      },
    });
    manager.navigate({ pane: "project", params: { projectId: "p-1" } });
    const snapshot = manager.navigate({
      pane: "task",
      params: { taskId: "t-1" },
    });

    expect(snapshot.visiblePanes.map((entry) => entry.pane)).toEqual([
      "home",
      "task",
    ]);
  });

  it("notifies subscribers with structured changes", () => {
    const manager = createPaneManager(config);
    const listener = vi.fn();
    const unsubscribe = manager.subscribe(listener);

    manager.navigate({ pane: "project", params: { projectId: "p-1" } });
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ revision: 1 }),
      expect.objectContaining({ type: "navigate" }),
    );

    unsubscribe();
    manager.back();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("provides typed targets", () => {
    const target: PaneTarget<TestPanes> = {
      pane: "project",
      params: { projectId: "p-1" },
    };

    expectTypeOf(target.params).toEqualTypeOf<{ projectId: string }>();
  });
});

describe("state transitions", () => {
  it("can be used as a pure reducer without a manager", () => {
    const state = createPaneState(config);
    const transition = transitionPaneState(config, state, {
      type: "navigate",
      target: { pane: "project", params: { projectId: "p-1" } },
    });

    expect(state.stack.map((entry) => entry.pane)).toEqual(["home"]);
    expect(transition.state.stack.map((entry) => entry.pane)).toEqual([
      "home",
      "project",
    ]);
    expect(transition.change?.type).toBe("navigate");
  });

  it("rejects invalid configuration", () => {
    expect(() =>
      createPaneManager<TestPanes>({
        ...config,
        display: { maxVisible: 0 },
      }),
    ).toThrow("display.maxVisible must be a positive integer.");
  });
});
