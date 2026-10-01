// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { createPaneManager, definePaneConfig } from "../src/index.js";
import { usePaneSnapshot, useVisiblePanes } from "../src/react.js";

type TestPanes = {
  home: { params: undefined };
  details: { params: { itemId: string } };
};

const config = definePaneConfig<TestPanes>({
  panes: {
    home: {},
    details: { canOpenFrom: ["home"] },
  },
  initialStack: [{ pane: "home" }],
});

describe("React hooks", () => {
  it("updates components when the manager snapshot changes", () => {
    const manager = createPaneManager(config);
    const { result, unmount } = renderHook(() => {
      const snapshot = usePaneSnapshot(manager);
      const visiblePanes = useVisiblePanes(manager);

      expect(visiblePanes).toBe(snapshot.visiblePanes);
      return snapshot;
    });

    expect(result.current.visiblePanes.map((entry) => entry.pane)).toEqual([
      "home",
    ]);

    act(() => {
      manager.navigate({
        pane: "details",
        params: { itemId: "item-123" },
      });
    });

    expect(result.current.visiblePanes.map((entry) => entry.pane)).toEqual([
      "home",
      "details",
    ]);

    unmount();
  });
});
