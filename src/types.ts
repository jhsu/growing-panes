export type PaneSchema = Record<string, unknown>;

export type PaneName<Schema extends PaneSchema> = Extract<keyof Schema, string>;

type Field<
  Definition,
  Name extends PropertyKey,
  Fallback,
> = Definition extends Record<Name, infer Value>
  ? Value
  : Fallback;

export type PaneParams<
  Schema extends PaneSchema,
  Name extends PaneName<Schema>,
> = Field<Schema[Name], "params", undefined>;

export type PaneData<
  Schema extends PaneSchema,
  Name extends PaneName<Schema>,
> = Field<Schema[Name], "data", undefined>;

export type PaneMeta<
  Schema extends PaneSchema,
  Name extends PaneName<Schema>,
> = Field<Schema[Name], "meta", unknown>;

type InputProperty<Name extends PropertyKey, Value> = undefined extends Value
  ? { [Key in Name]?: Value }
  : { [Key in Name]: Value };

export type PaneTargetFor<
  Schema extends PaneSchema,
  Name extends PaneName<Schema>,
> = {
  readonly pane: Name;
  readonly key?: string;
} & InputProperty<"params", PaneParams<Schema, Name>> &
  InputProperty<"data", PaneData<Schema, Name>>;

export type PaneTarget<Schema extends PaneSchema> = {
  [Name in PaneName<Schema>]: PaneTargetFor<Schema, Name>;
}[PaneName<Schema>];

export type PaneEntryFor<
  Schema extends PaneSchema,
  Name extends PaneName<Schema>,
> = Readonly<{
  key: string;
  pane: Name;
  params: PaneParams<Schema, Name>;
  data: PaneData<Schema, Name>;
  /** Zero-based position in the stack. */
  depth: number;
}>;

export type PaneEntry<Schema extends PaneSchema> = {
  [Name in PaneName<Schema>]: PaneEntryFor<Schema, Name>;
}[PaneName<Schema>];

export type PaneDefinition<
  Schema extends PaneSchema,
  Name extends PaneName<Schema>,
> = Readonly<{
  canOpenFrom?: readonly PaneName<Schema>[];
  display?: Readonly<{
    maxVisible?: number;
  }>;
  meta?: PaneMeta<Schema, Name>;
}>;

export type PaneDefinitions<Schema extends PaneSchema> = {
  readonly [Name in PaneName<Schema>]: PaneDefinition<Schema, Name>;
};

export interface PaneDisplayContext<Schema extends PaneSchema> {
  readonly activeDefinition:
    | PaneDefinition<Schema, PaneName<Schema>>
    | undefined;
  readonly definitions: PaneDefinitions<Schema>;
}

export interface PaneManagerConfig<Schema extends PaneSchema> {
  readonly panes: PaneDefinitions<Schema>;
  readonly initialStack?: readonly PaneTarget<Schema>[];
  readonly display?: Readonly<{
    maxVisible?: number;
  }>;
  /**
   * Smallest stack depth reachable with back navigation. Defaults to one when
   * an initial stack exists, and zero otherwise.
   */
  readonly minimumDepth?: number;
  readonly selectVisiblePanes?: (
    stack: readonly PaneEntry<Schema>[],
    context: PaneDisplayContext<Schema>,
  ) => readonly PaneEntry<Schema>[];
}

export interface DefinedPaneConfig<Schema extends PaneSchema>
  extends PaneManagerConfig<Schema> {
  /** Carries the schema through inference without creating a runtime field. */
  readonly __schema?: Schema;
}

export interface PaneState<Schema extends PaneSchema> {
  readonly stack: readonly PaneEntry<Schema>[];
  readonly revision: number;
}

export interface PaneSnapshot<Schema extends PaneSchema>
  extends PaneState<Schema> {
  readonly visiblePanes: readonly PaneEntry<Schema>[];
  readonly activePane: PaneEntry<Schema> | undefined;
  readonly canGoBack: boolean;
}

export type PaneBackToTarget<Schema extends PaneSchema> =
  | Readonly<{ key: string; pane?: never }>
  | Readonly<{ pane: PaneName<Schema>; key?: never }>;

export type PaneEvent<Schema extends PaneSchema> =
  | Readonly<{ type: "navigate"; target: PaneTarget<Schema> }>
  | Readonly<{ type: "back"; steps?: number }>
  | Readonly<{ type: "back-to"; target: PaneBackToTarget<Schema> }>
  | Readonly<{ type: "replace"; target: PaneTarget<Schema> }>
  | Readonly<{ type: "reset"; stack?: readonly PaneTarget<Schema>[] }>;

export type PaneChange<Schema extends PaneSchema> =
  | Readonly<{ type: "navigate"; added: PaneEntry<Schema> }>
  | Readonly<{ type: "back"; removed: readonly PaneEntry<Schema>[] }>
  | Readonly<{ type: "back-to"; removed: readonly PaneEntry<Schema>[] }>
  | Readonly<{
      type: "replace";
      added: PaneEntry<Schema>;
      removed: PaneEntry<Schema>;
    }>
  | Readonly<{
      type: "reset";
      added: readonly PaneEntry<Schema>[];
      removed: readonly PaneEntry<Schema>[];
    }>;

export interface PaneTransition<Schema extends PaneSchema> {
  readonly state: PaneState<Schema>;
  readonly change: PaneChange<Schema> | undefined;
}

export type PaneListener<Schema extends PaneSchema> = (
  snapshot: PaneSnapshot<Schema>,
  change: PaneChange<Schema>,
) => void;

export interface PaneManager<Schema extends PaneSchema> {
  getSnapshot(): PaneSnapshot<Schema>;
  getDefinition<Name extends PaneName<Schema>>(
    pane: Name,
  ): PaneDefinition<Schema, Name>;
  navigate<Name extends PaneName<Schema>>(
    target: PaneTargetFor<Schema, Name>,
  ): PaneSnapshot<Schema>;
  back(options?: Readonly<{ steps?: number }>): PaneSnapshot<Schema>;
  backTo(target: PaneBackToTarget<Schema>): PaneSnapshot<Schema>;
  replace<Name extends PaneName<Schema>>(
    target: PaneTargetFor<Schema, Name>,
  ): PaneSnapshot<Schema>;
  reset(stack?: readonly PaneTarget<Schema>[]): PaneSnapshot<Schema>;
  canNavigate<Name extends PaneName<Schema>>(
    target: PaneTargetFor<Schema, Name>,
  ): boolean;
  dispatch(event: PaneEvent<Schema>): PaneSnapshot<Schema>;
  subscribe(listener: PaneListener<Schema>): () => void;
}
