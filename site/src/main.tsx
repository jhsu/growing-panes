import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";

import {
  createPaneManager,
  definePaneConfig,
  type PaneEntry,
  type PaneTarget,
} from "growing-panes";
import { usePaneSnapshot } from "growing-panes/react";

import "./styles.css";

type DemoPanes = {
  projects: {
    params: undefined;
    meta: { label: string; eyebrow: string };
  };
  project: {
    params: { projectId: string };
    meta: { label: string; eyebrow: string };
  };
  task: {
    params: { projectId: string; taskId: string };
    meta: { label: string; eyebrow: string };
  };
  preview: {
    params: { projectId: string; taskId: string };
    meta: { label: string; eyebrow: string };
  };
};

const projects = [
  {
    id: "atlas",
    name: "Atlas",
    description: "A research workspace for connected notes and sources.",
    progress: 68,
    tasks: [
      {
        id: "search",
        title: "Design global search",
        owner: "Mina",
        status: "In review",
        summary:
          "Unify documents, highlights, and people in one keyboard-first search experience.",
      },
      {
        id: "citations",
        title: "Prototype citations",
        owner: "Theo",
        status: "In progress",
        summary:
          "Create a compact citation model that keeps source context attached to every note.",
      },
    ],
  },
  {
    id: "harbor",
    name: "Harbor",
    description: "Operations tooling for small, distributed teams.",
    progress: 42,
    tasks: [
      {
        id: "handoff",
        title: "Improve shift handoff",
        owner: "Nora",
        status: "Planned",
        summary:
          "Turn incomplete work into a clear, structured handoff for the next teammate.",
      },
      {
        id: "alerts",
        title: "Group related alerts",
        owner: "Ishan",
        status: "In progress",
        summary:
          "Reduce noise by collecting alerts that share the same service and root cause.",
      },
    ],
  },
  {
    id: "canopy",
    name: "Canopy",
    description: "A lightweight planning tool for community gardens.",
    progress: 81,
    tasks: [
      {
        id: "calendar",
        title: "Build planting calendar",
        owner: "Ari",
        status: "Ready",
        summary:
          "Visualize planting windows using local climate data and shared garden plans.",
      },
      {
        id: "plots",
        title: "Map shared plots",
        owner: "Lena",
        status: "In review",
        summary:
          "Make plot ownership, crop rotation, and open space visible at a glance.",
      },
    ],
  },
] as const;

const config = definePaneConfig<DemoPanes>({
  display: { maxVisible: 3 },
  panes: {
    projects: {
      meta: { label: "Projects", eyebrow: "Workspace" },
    },
    project: {
      canOpenFrom: ["projects"],
      meta: { label: "Project", eyebrow: "Overview" },
    },
    task: {
      canOpenFrom: ["project"],
      meta: { label: "Task", eyebrow: "Detail" },
    },
    preview: {
      canOpenFrom: ["task"],
      display: { maxVisible: 4 },
      meta: { label: "Preview", eyebrow: "Focus mode" },
    },
  },
  initialStack: [{ pane: "projects", key: "projects-root" }],
});

const exampleCode = `const panes = createPaneManager(config)

panes.navigate({
  pane: "project",
  params: { projectId: "atlas" }
})

const snapshot = panes.getSnapshot()

snapshot.stack        // every pane
snapshot.visiblePanes // render these
snapshot.activePane   // deepest pane`;

function findProject(projectId: string) {
  return projects.find((project) => project.id === projectId);
}

function findTask(projectId: string, taskId: string) {
  return findProject(projectId)?.tasks.find((task) => task.id === taskId);
}

interface PaneViewProps {
  entry: PaneEntry<DemoPanes>;
  openFrom: (sourceKey: string, target: PaneTarget<DemoPanes>) => void;
}

function PaneView({ entry, openFrom }: PaneViewProps) {
  if (entry.pane === "projects") {
    return (
      <div className="pane-content">
        <div className="pane-heading">
          <span className="pane-kicker">Choose a project</span>
          <h3>Active work</h3>
          <p>Open a project to grow the workspace one pane deeper.</p>
        </div>
        <div className="project-list">
          {projects.map((project) => (
            <button
              className="project-row"
              key={project.id}
              onClick={() =>
                openFrom(entry.key, {
                  pane: "project",
                  params: { projectId: project.id },
                })
              }
            >
              <span className="project-monogram">{project.name.at(0)}</span>
              <span className="project-copy">
                <strong>{project.name}</strong>
                <small>{project.description}</small>
              </span>
              <span className="row-arrow" aria-hidden="true">
                ↗
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (entry.pane === "project") {
    const project = findProject(entry.params.projectId);

    if (!project) return null;

    return (
      <div className="pane-content">
        <div className="pane-heading">
          <span className="pane-kicker">{project.progress}% complete</span>
          <h3>{project.name}</h3>
          <p>{project.description}</p>
        </div>
        <div className="progress-track" aria-label={`${project.progress}% complete`}>
          <span style={{ width: `${project.progress}%` }} />
        </div>
        <div className="section-label">Current tasks</div>
        <div className="task-list">
          {project.tasks.map((task) => (
            <button
              className="task-row"
              key={task.id}
              onClick={() =>
                openFrom(entry.key, {
                  pane: "task",
                  params: { projectId: project.id, taskId: task.id },
                })
              }
            >
              <span>
                <strong>{task.title}</strong>
                <small>
                  {task.owner} · {task.status}
                </small>
              </span>
              <span className="row-arrow" aria-hidden="true">
                →
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (entry.pane === "task") {
    const task = findTask(entry.params.projectId, entry.params.taskId);

    if (!task) return null;

    return (
      <div className="pane-content">
        <div className="status-pill">{task.status}</div>
        <div className="pane-heading task-heading">
          <span className="pane-kicker">Owned by {task.owner}</span>
          <h3>{task.title}</h3>
          <p>{task.summary}</p>
        </div>
        <dl className="task-facts">
          <div>
            <dt>Priority</dt>
            <dd>High</dd>
          </div>
          <div>
            <dt>Cycle</dt>
            <dd>October</dd>
          </div>
        </dl>
        <button
          className="primary-action"
          onClick={() =>
            openFrom(entry.key, {
              pane: "preview",
              params: entry.params,
            })
          }
        >
          Open focus preview
          <span aria-hidden="true">→</span>
        </button>
      </div>
    );
  }

  const task = findTask(entry.params.projectId, entry.params.taskId);

  if (!task) return null;

  return (
    <div className="pane-content preview-content">
      <span className="preview-orbit" aria-hidden="true" />
      <div className="preview-mark">GP</div>
      <span className="pane-kicker">Focused task</span>
      <h3>{task.title}</h3>
      <p>{task.summary}</p>
      <div className="preview-owner">
        <span>{task.owner.at(0)}</span>
        <div>
          <small>Task owner</small>
          <strong>{task.owner}</strong>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [manager] = useState(() => createPaneManager(config));
  const snapshot = usePaneSnapshot(manager);

  function openFrom(sourceKey: string, target: PaneTarget<DemoPanes>) {
    if (manager.getSnapshot().activePane?.key !== sourceKey) {
      manager.backTo({ key: sourceKey });
    }

    manager.navigate(target);
  }

  const statePreview = JSON.stringify(
    {
      stack: snapshot.stack.map((entry) => entry.pane),
      visible: snapshot.visiblePanes.map((entry) => entry.pane),
      active: snapshot.activePane?.pane,
      revision: snapshot.revision,
    },
    null,
    2,
  );

  return (
    <>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Growing Panes home">
          <span className="brand-mark">
            <i />
            <i />
            <i />
          </span>
          <span>Growing Panes</span>
        </a>
        <nav>
          <a href="#demo">Demo</a>
          <a href="#api">API</a>
          <a href="https://github.com/jhsu/growing-panes">GitHub ↗</a>
        </nav>
      </header>

      <main id="top">
        <section className="hero">
          <div className="hero-copy">
            <div className="eyebrow">
              <span /> Headless navigation primitives
            </div>
            <h1>
              Interfaces that grow
              <br />
              <em>with the conversation.</em>
            </h1>
            <p>
              A tiny, typed state machine for interfaces that move deeper into
              context—then make the path back obvious.
            </p>
            <div className="hero-actions">
              <a className="button button-primary" href="#demo">
                Try the live demo <span>↓</span>
              </a>
              <code>pnpm add growing-panes</code>
            </div>
          </div>
          <div className="hero-visual" aria-hidden="true">
            <div className="visual-grid" />
            <div className="floating-pane pane-one">
              <span>01</span>
              <strong>Browse</strong>
            </div>
            <div className="floating-pane pane-two">
              <span>02</span>
              <strong>Explore</strong>
            </div>
            <div className="floating-pane pane-three">
              <span>03</span>
              <strong>Focus</strong>
            </div>
          </div>
        </section>

        <section className="principles" aria-label="Library principles">
          <div>
            <span>01</span>
            <strong>Framework agnostic</strong>
            <p>Run the core anywhere JavaScript runs.</p>
          </div>
          <div>
            <span>02</span>
            <strong>State machine core</strong>
            <p>Every transition is explicit and testable.</p>
          </div>
          <div>
            <span>03</span>
            <strong>Render what matters</strong>
            <p>Derive a visible window from the full stack.</p>
          </div>
        </section>

        <section className="demo-section" id="demo">
          <div className="section-heading">
            <div>
              <span className="eyebrow-label">Interactive example</span>
              <h2>Follow the stack.</h2>
            </div>
            <p>
              Choose a project, open a task, and enter focus mode. The manager
              decides which panes remain visible as the stack grows.
            </p>
          </div>

          <div className="demo-shell">
            <div className="demo-toolbar">
              <nav className="breadcrumbs" aria-label="Pane stack">
                {snapshot.stack.map((entry, index) => {
                  const definition = manager.getDefinition(entry.pane);
                  const isActive = entry.key === snapshot.activePane?.key;

                  return (
                    <span key={entry.key}>
                      {index > 0 && <b>/</b>}
                      <button
                        className={isActive ? "active" : ""}
                        onClick={() => manager.backTo({ key: entry.key })}
                      >
                        {definition.meta?.label ?? entry.pane}
                      </button>
                    </span>
                  );
                })}
              </nav>
              <div className="demo-controls">
                <button
                  onClick={() => manager.back()}
                  disabled={!snapshot.canGoBack}
                >
                  ← Back
                </button>
                <button onClick={() => manager.reset()}>Reset</button>
              </div>
            </div>

            <div className="pane-stage">
              {snapshot.visiblePanes.map((entry, index) => {
                const definition = manager.getDefinition(entry.pane);
                const isActive = entry.key === snapshot.activePane?.key;

                return (
                  <article
                    className={`demo-pane pane-${entry.pane} ${isActive ? "is-active" : ""}`}
                    key={entry.key}
                  >
                    <div className="pane-chrome">
                      <span>
                        {String(entry.depth + 1).padStart(2, "0")} ·{" "}
                        {definition.meta?.eyebrow}
                      </span>
                      <i>{isActive ? "Active" : `Visible ${index + 1}`}</i>
                    </div>
                    <PaneView entry={entry} openFrom={openFrom} />
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="api-section" id="api">
          <div className="section-heading api-heading">
            <div>
              <span className="eyebrow-label">Small surface area</span>
              <h2>State in. Snapshot out.</h2>
            </div>
            <p>
              The manager is an external store with immutable snapshots. Use it
              directly or subscribe through the optional React hooks.
            </p>
          </div>

          <div className="api-grid">
            <div className="code-card">
              <div className="code-title">
                <span>manager.ts</span>
                <i />
              </div>
              <pre>
                <code>{exampleCode}</code>
              </pre>
            </div>
            <div className="state-card">
              <div className="state-title">
                <span>Live snapshot</span>
                <i>revision {snapshot.revision}</i>
              </div>
              <pre>{statePreview}</pre>
              <div className="state-note">
                <span /> Updates synchronously with the demo above
              </div>
            </div>
          </div>
        </section>

        <section className="closing">
          <span className="eyebrow-label">Build the adapter you need</span>
          <h2>Own the view. Keep the navigation predictable.</h2>
          <div>
            <a className="button button-primary" href="https://github.com/jhsu/growing-panes">
              View on GitHub <span>↗</span>
            </a>
            <a className="text-link" href="#top">
              Back to top ↑
            </a>
          </div>
        </section>
      </main>

      <footer>
        <span>Growing Panes</span>
        <span>MIT licensed · Headless by design</span>
      </footer>
    </>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
