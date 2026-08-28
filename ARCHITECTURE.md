# Architecture — Obsidian Notion Bases Plugin

> Living technical reference. Only confirmed implementation is documented as canonical.

## 1. Project overview

This Obsidian plugin provides Notion Bases-style database views, including table, list,
board, gallery, Calendar, timeline, and chart views. Shared infrastructure covers data
loading, filtering, conditional formatting, inline title editing, desktop controls, and
database navigation.

### Supported platform

The maintained target is desktop Obsidian only. Mobile-specific UI and interaction
paths are intentionally unsupported. Architecture changes must not add mobile branches,
touch-only behavior, responsive toolbars, or BottomSheet alternatives.

## 2. Calendar entry point and ownership

`src/components/DatabaseCalendar.tsx` remains the public Calendar entry point imported by
`DatabaseRoot.tsx`:

```ts
interface DatabaseCalendarProps {
    dbFile: TFile | null
    manager: DatabaseManager
    externalView: ViewConfig
    onViewChange: (view: ViewConfig) => Promise<void>
}
```

It is an orchestration component. It owns:

- database-row loading and debounced filtering;
- local view state and persistence through `onViewChange`;
- selected date, month/week navigation, and current-time tracking;
- grouping rows by date and deriving rows without a date;
- note creation and drag/drop frontmatter updates;
- desktop toolbar/dropdown state;
- selection of month or week rendering.

`DatabaseRoot` continues to import from `./DatabaseCalendar`, so the refactor does not
change the integration API.

## 3. Calendar module layout

Focused rendering modules live in `src/components/Calendar/`:

```text
DatabaseCalendar
├── DatabaseWeekView
│   ├── all-day row
│   ├── weekday headers
│   └── 24-hour timed grid
├── DatabaseMonthView
│   └── DatabaseMonthWeek
│       └── DatabaseMonthCell
│           └── DatabaseMonthlyCard
├── DatabaseNoDateRows
├── calendar-utils
└── calendar-types
```

File responsibilities:

| File | Responsibility |
| --- | --- |
| `DatabaseWeekView.tsx` | All-day cards, timed cards, visible-date editing, time slots, and current-time line. |
| `DatabaseMonthView.tsx` | Weekday headings and division of the month grid into seven-day rows. |
| `DatabaseMonthWeek.tsx` | One seven-cell month row. |
| `DatabaseMonthCell.tsx` | Day state, desktop note creation, card rendering, and drop target. |
| `DatabaseMonthlyCard.tsx` | Monthly card title, time, folder path, properties, and conditional style. |
| `DatabaseNoDateRows.tsx` | Draggable cards whose selected date field is empty, with inline date assignment. |
| `calendar-utils.ts` | Pure date parsing, grid construction, keys, time/range formatting, and labels. |
| `calendar-types.ts` | Shared handler and row-map types used across Calendar modules. |

All extracted React components use explicit props. State-changing operations remain in
the orchestration layer and are passed down as callbacks. This keeps Obsidian mutations
and persistence out of presentational components.

## 4. Data and filtering flow

```text
external ViewConfig
       ↓
DatabaseCalendar.activeView
       ├── useDatabaseRows
       │        ↓
       │      rows + schema + active filters
       │        ↓
       ├── useDebouncedValue(200 ms)
       │        ↓
       ├── applyFilters
       │        ↓
       ├── rowsByDate + noDateRows
       │        ↓
       └── extracted Calendar views
```

View changes flow through:

```text
UI action → saveView(updated) → setActiveView(updated) → onViewChange(updated)
```

Filter-pill persistence uses the same view-update path.

## 5. Date model

The Calendar uses native JavaScript `Date`; no external date library is involved.
`parseDateValue` supports date-only and date-time strings and returns a zero-based month:

```ts
interface ParsedDateValue {
    year: number
    month: number
    day: number
    hour?: number
    minute?: number
}
```

Rows are grouped with `dateKey(year, month, day)` into a
`Map<string, NoteRow[]>`. Within a day, untimed entries sort before timed entries.

### Monday-first invariant

The current implementation is Monday-first:

- `daysShort()` returns Monday through Sunday;
- `buildCalendarGrid()` converts JavaScript's Sunday-based weekday with
  `(getDay() + 6) % 7`;
- `buildWeekGrid()` finds the Monday containing the selected date and returns seven days.

A future configurable week start must update all three behaviors together. The setting
belongs on `ViewConfig` beside `calendarDateField` and `calendarViewMode`.

## 6. Month view

`DatabaseMonthView` chunks the flat calendar cell array into seven-day weeks.
`DatabaseMonthCell` preserves these behavior contracts:

- outside-month placeholders;
- current-day and drag-over styling;
- desktop click-to-create;
- all cards displayed with automatic cell height;
- date-changing drag/drop.

`DatabaseMonthlyCard` uses the complete schema for conditional-format evaluation and the
visible-column subset for property display. It reuses `EditableTitle` and delegates
`select`, `status`, and `multiselect` values to `EditableSelector`.

## 7. Week view

`DatabaseWeekView` receives the already-derived week dates and row map. It separates
rows without a time from timed rows, renders 24 hourly slots, and positions a timed card
with:

```ts
((hour * 60 + minute) / 1440) * 100
```

The orchestration component owns the week-body ref and auto-scroll effect. The view owns
only rendering and interaction forwarding.

## 8. Mutations and Obsidian integration

The entry component keeps all operations that write to the vault:

- creating a note from the configured template;
- setting its selected date field;
- changing a dragged note's date while preserving an existing time suffix;

Extracted child components signal these operations through callbacks and never call
frontmatter APIs directly.

## 9. Shared dependencies

```text
context/useApp                    Obsidian app access
DatabaseManager                   note creation/editing operations
useDatabaseRows                   rows, schema, filter state
virtual-properties               canonical virtual catalog, resolver, capabilities
useDebouncedValue                 filter debounce
useSaveTracker + SaveIndicator    persistence feedback
filter-utils                      filtering, icons, conditional formats
EditableFields                    inline title and selector editing
FilterPillsRow                    active-filter UI
ConditionalFormatPanel            formatting rule editor
```

## 10. Stability constraints

Calendar changes must preserve:

1. automatic month-cell height and multiple cards per day;
2. seven-column month layout;
3. desktop click-to-create and drag/drop interactions;
4. drag/drop date changes, including preservation of times;
5. week all-day/timed separation and vertical positioning;
6. current-time indicator and auto-scroll;
7. filtering, conditional formatting, and subfolder paths;
8. the `DatabaseCalendar` integration API used by `DatabaseRoot`.

## 11. Board architecture

`src/components/DatabaseBoard.tsx` remains the public Board entry point used by
`DatabaseRoot`. It owns row loading, filter/sort derivation, group-column selection,
column ordering, view persistence, and frontmatter mutations.

```text
DatabaseBoard
├── BoardToolbar
├── BoardColumn × N
│   ├── LazyBoardCard (for large columns)
│   │   └── BoardCard
│   └── add-card / column-limit controls
└── Obsidian Menu (card right-click actions)
```

Files under `src/components/Board/`:

| File | Responsibility |
| --- | --- |
| `BoardToolbar.tsx` | Desktop menus, view toggles, filter pills, save state, and conditional-format controls. |
| `BoardColumn.tsx` | Column drag/drop, limits, expansion, cards, and add-card action. |
| `BoardCard.tsx` | Editable title/selectors/dates, visible properties, folder path, card drag, and right-click forwarding. |
| `LazyBoardCard.tsx` | IntersectionObserver-based rendering for large columns. |
| `board-types.ts` | Column data contract, drag MIME keys, and virtualization threshold. |

Board interactions are desktop-only:

- cards and columns use native HTML drag/drop;
- right-click opens Obsidian's native `Menu` for open, duplicate, and delete actions;
- no touch listeners, drag ghosts, long-press logic, responsive toolbar, or BottomSheet
  dependency remains.

Board stability constraints:

1. group by select/status and the no-value column;
2. saved column ordering and card movement through frontmatter;
3. column limits and show more/less state;
4. conditional formatting and visible card properties;
5. subfolder paths and inline title editing;
6. virtualization for columns with at least 30 visible cards;
7. the `DatabaseBoard` integration API used by `DatabaseRoot`.

## 12. Shared note context menu

`src/components/ContextMenu/showNoteContextMenu.ts` is the single owner of native note
context-menu construction. Callers provide the desktop mouse event, Obsidian `App`,
`DatabaseManager`, and target `TFile`.

```text
BoardCard / Calendar card
          ↓ right-click
showNoteContextMenu
          ↓
Obsidian Menu
├── Open note
├── Duplicate note
└── Delete note
```

Current consumers are Board cards, Calendar monthly cards, weekly all-day cards, weekly
timed cards, and Calendar rows without a date. New note-based views should reuse this
helper instead of rebuilding the three actions locally.

## 13. Editable fields

Reusable inline editors live in `src/components/EditableFields/`.

| Component | Responsibility |
| --- | --- |
| `EditableCardProperties.tsx` | Shared Board/Calendar routing for editable dates, selectors, and read-only scalar properties. |
| `EditableTitle.tsx` | Single-click open, double-click rename, and rename persistence through `DatabaseManager`. |
| `EditableSelector.tsx` | Fixed-position option menu and persistence for `select`, `status`, and `multiselect` fields. |
| `RenamableSelectorOption.tsx` | Shared click/double-click arbitration and inline option-name editor used by Table, Board, and Calendar. |
| `SelectorOptionCreateInput.tsx` | Shared creation input, keyboard behavior, busy state, and draft preservation for Table and card selector menus. |
| `EditableDate.tsx` | Compact French date display, native date-picker activation, and date persistence. |

`EditableSelector` receives the `ColumnSchema`, current value, target `TFile`, manager,
and optional inline-field metadata. It updates optimistically, rolls back on failure,
and persists through `DatabaseManager.updateNoteField`. Calendar monthly cards and Board
cards render the editor even for empty selector values so a value can be assigned
directly. The Board grouping property is intentionally absent from card properties;
moving a card between columns remains its editing mechanism.

Visual contract on Calendar monthly cards:

```text
value present  → left-aligned colored badge, width = badge content
empty value    → left-aligned gray dash placeholder, width ≈ 25% of card
```

The Calendar does not render the selector property's name or a surrounding
`nb-board-card-prop` wrapper. The technical button is visually transparent when a value
exists, uses `align-self: flex-start`/`width: fit-content`, and its clickable area must
not stretch across the card. The empty state is constrained to 48–88 px so it remains
compact while still being discoverable.

`EditableSelector` delegates every option row to `RenamableSelectorOption`. A delayed
single click selects/toggles without colliding with the double-click gesture; a double-click
replaces the badge with a focused inline input. Enter or blur commits, Escape cancels.
The same component is used by the Table `select`, `status`, and `multiselect` dropdowns.
`SelectorOptionCreateInput` is likewise shared by all three Table dropdown variants and
`EditableSelector`. Creation is routed by scope: local definitions update only the current
database schema, while shared definitions update the canonical registry. Card creation
also assigns the new value immediately. Recoloring and deletion retain their existing
Table/settings workflows.

`EditableDate` is integrated into Board cards and every Calendar card variant for
visible non-system date columns. It
renders no property label and formats valid `YYYY-MM-DD` values with deterministic
French abbreviations in title case (`Lun 12 Janv.`). The visible button is content-sized,
left-aligned, and uses dimensions and typography aligned with selector badges. Its empty
state uses the same quarter-width 48–88 px placeholder contract as
`EditableSelector`.

Board and Calendar fields rendered below their card title live inside
`nb-board-card-props--inline`, a left-aligned flex row with wrapping and a uniform 5 px
gap. Editors remain content-sized and share a line while they fit; normal flex wrapping
moves the next field to a new line when the card width is insufficient.

`EditableCardProperties` owns the shared type routing. Board and monthly Calendar cards
pass all visible property columns; weekly and no-date Calendar cards pass visible date
columns so their compact content model is preserved while dates become editable.

`EditableDate` exposes its visible button directly as the flex item; it must not add a
layout wrapper around that button. Its hidden native input remains in the same document
as the card but is forcibly fixed and constrained to one pixel, removing it completely
from the properties flex flow. Empty and populated dates therefore reserve only their visible width, making
the container's 5 px gap the sole spacing before the next editor. Selector
buttons use `flex: 0 0 auto` and left justification so their transparent button surface
cannot consume the remaining row width or center the visible badge away from that gap.

Picker activation is explicit: the visible button calls `HTMLInputElement.showPicker()`
during the user gesture. Immediately beforehand, the fixed one-pixel native input is
moved to the pointer coordinates, causing Chromium's picker to open beside the click;
keyboard activation uses the visible button's lower-left corner. The native input remains
non-interactive and outside the card layout. It must never overlay or stretch across the card. The component
updates optimistically, preserves an existing `T...` time suffix, rolls back on failure,
and writes through `DatabaseManager.updateNoteField`.

## 14. Property scope model

The effective schema of a database is composed from three sources:

```text
database-local definitions
          +
references to shared definitions
          +
virtual Obsidian/file definitions
          ↓
effective ColumnSchema[] consumed by views, filters, sorts, and editors
```

### Current virtual-property implementation audit

The codebase now has a complete first-version virtual-property foundation:

| Property | Current source and identity | Current capabilities | Missing pieces |
| --- | --- | --- | --- |
| Title | Canonical definition `_title` / `virtualSource: 'title'`; `DatabaseManager` hydrates it from `TFile.basename`. | Sole editable virtual property. Table edits through its cell renderer; Board, every Calendar card variant, List, Gallery, and Timeline share `EditableTitle`. Both paths route mutation through `updateVirtualProperty() → renameNote()`. | None for the agreed first version. |
| Parent folder | Canonical `_parentFolder` definition and row value from `TFile.parent.path`. | Read-only and selectable per view in Table, Board, Calendar, List, Gallery, and Timeline; available to filters, sorts, formulas, charts, and conditional formatting. | None; legacy `_folder` references migrate to this ID. |
| File path | Canonical `_path` definition and row value from `TFile.path`. | Read-only, selectable per view, filterable, sortable, usable in formulas/charts, and retained as the stable identity for file operations. | None for the agreed first version. |
| Creation time | Canonical `_ctime` / `virtualSource: 'ctime'` from `TFile.stat.ctime`. | Read-only, selectable per view, available to all effective-schema consumers, and excluded from Calendar/Timeline mutation selectors. | None; legacy local definitions migrate automatically. |
| Modification time | Canonical `_mtime` / `virtualSource: 'mtime'` from `TFile.stat.mtime`. | Same read-only cross-view exposure and mutation guard as creation time. | None; legacy local definitions migrate automatically. |

The title and system timestamp paths remain covered, and the new foundation adds dedicated
resolver tests:
`tests/system-columns.test.ts` verifies timestamp formatting, `TFile.stat` sourcing, and
frontmatter precedence; filter tests cover `_title` filtering and sorting;
`tests/virtual-properties.test.ts` verifies stable IDs, scope/capabilities, schema
composition, collision reporting, all five canonical row values, title-only mutation
routing, per-view selection, filter/sort/formula consumption, complete legacy-reference
remapping, hidden-column preservation, and migration idempotence.

Reserved virtual IDs always win in the effective read schema. If a legacy local column
uses `_title`, `_parentFolder`, `_path`, `_ctime`, or `_mtime`, the resolver reports the
collision and retains the untouched local schema for diagnostics, but excludes that local
definition from effective hydration so frontmatter can never shadow native metadata.

Calendar and Timeline layout selectors use capability metadata and accept only editable
local date properties. Read-only native timestamps therefore never enter drag, resize, or
date-picker mutation workflows.

### Minimal virtual-property target

The requested first complete version is intentionally small:

1. [x] define stable sources for `title`, `parentFolder`, `path`, `ctime`, and `mtime`;
2. [x] expose origin and capability metadata through the effective schema resolver;
3. [x] keep title as the only editable virtual source, routed to real file rename;
4. [x] expose parent folder, path, creation time, and modification time as read-only values;
5. [x] make visibility, filtering, sorting, formatting, and formula lookup consistent across
   views without writing virtual values to frontmatter;
6. [x] exclude all read-only virtual dates from Calendar/Timeline mutation selectors;
7. [x] migrate existing `systemField` timestamp columns without losing view configuration;
8. [x] add cross-view exposure and mutation-guard tests.

This places the project at the **agreed first version complete stage** for virtual
properties. `ViewConfig.virtualColumnIds` stores opt-in presentation independently for each
view, while definitions remain non-persisted and read-only values never enter frontmatter.
`NotionBasesSettings.virtualPropertyMenuVisibility` is a global presentation filter for
Fields menus only: it does not remove saved selections or canonical values. Parent folder
and path are enabled by default; creation and modification timestamps are hidden by default.
`DatabaseConfig.virtualPropertiesVersion` gates a one-time migration that removes legacy
local `systemField` definitions, maps them to `_ctime`/`_mtime`, maps `_folder` to
`_parentFolder`, and rewrites compatible schema/view references. Mutable Calendar/Timeline
date assignments pointing at those read-only timestamps are cleared. The migration is
idempotent and never writes derived values to note frontmatter.

### Database properties

Database properties are owned by one `_database.md`. Their definition and options are
isolated from every other database, matching the current `DatabaseConfig.schema`
behavior. Their values continue to be stored in note frontmatter or supported inline
fields.

### Virtual properties

Virtual properties are adapters over native Obsidian `TFile` data and must not create
duplicate frontmatter values. Planned sources include:

| Stable source | Value | Intended capability |
| --- | --- | --- |
| `title` | File basename | Editable through file rename. |
| `parentFolder` | Immediate parent folder | Read-only; moving the note is a separate file operation. |
| `path` | Vault-relative file path | Read-only. |
| `ctime` | File creation timestamp | Read-only. |
| `mtime` | File modification timestamp | Read-only. |

Each virtual definition carries a stable source identity and explicit capabilities so
generic editors never write derived values into frontmatter. Title is the sole editable
virtual property; editing it renames the actual file. All other virtual sources remain
read-only. `ColumnSchema.systemField` remains only as an input compatibility marker for
pre-migration databases and is removed from their persisted local schema on first load.

### Shared properties

A shared property separates its canonical definition from database-local presentation:

```text
SharedPropertyDefinition
├── stable shared ID
├── stable note storage key
├── name and property type
└── canonical options/configuration
             ↑ referenced by
     parent DB   child DB   unrelated DB
```

The canonical use case is a shared `type` selector (`Todo`, `Post`, `Event`, …). Values
remain stored per note under the shared property's stable key. Databases store a
reference to the shared ID, while widths, ordering, visibility, filters, and other view
preferences remain local. Renaming the property or adding, recoloring, and reordering
options updates the canonical definition and therefore every database reference without
copying schema fragments. Removing or renaming an existing option uses the impact-aware
workflows below; direct removal or rename in the generic definition editor remains blocked
so migrations cannot be bypassed. Attached databases cannot override the
canonical name, type, or options; only presentation and view configuration are local.

This identity is especially important for nested folder databases: a parent database and
databases rooted in child folders must resolve `type` to the same definition and note
value when both reference it. Shared means globally available and centrally defined, but
attachment is always explicit per database. Parent/child folder relationships never
inherit shared properties automatically. How each view displays an attached property
remains database-local.

The canonical shared-property registry is stored in
`register_shared_propertiers.md` at the vault root. The file is plugin-owned configuration
that can travel with and synchronize with the vault. It is created lazily, carries the
`notion-bases-shared-properties` marker and registry version, and is excluded from database
rows. Existing unrelated files at that path are never overwritten.

Each `SharedPropertyDefinition` owns a stable UUID and immutable `storageKey`. A database
persists only `DatabaseConfig.sharedPropertyIds`; resolution creates effective
`ColumnSchema` entries with `propertyScope: 'shared'` and `sharedPropertyId`. Detaching a
reference does not remove or rewrite note values.

The registry model currently accepts `text`, `number`, `select`, `multiselect`, `status`,
`date`, `checkbox`, `url`, `email`, and `phone`. Computed/structural properties (`formula`,
`relation`, `lookup`, `rollup`, and title) and media fields are not yet shared-definition
types. The direct Table creation path is intentionally optimized for the dominant use
case: it creates a shared `select`, while the same `+` menu can attach an existing shared
`select`, `status`, or `multiselect`.

Selector option editing uses the existing Table cell dropdown. Its schema-update callback
dispatches option additions and color changes to `SharedPropertyRegistryStore` whenever
`propertyScope === 'shared'`; local selector changes continue writing only local schema.
Shared headers provide rename, per-view hide, and detach actions without exposing local
type/schema mutation controls. They also expose a separate, confirmed global-delete action;
detach always remains the non-destructive current-database operation.

### Shared-property destructive operations and collisions

Removing one option from a shared select/status/multiselect definition is impact-aware. Before the
registry is changed, the manager scans notes using that shared storage key and value. If
affected notes exist, the operation requires an explicit choice:

1. replace the removed option with another canonical option;
2. clear the value on affected notes; or
3. preserve it as a historical value that remains readable but is no longer selectable.

The impact scan is intentionally bounded to the union of note folders owned by databases
that explicitly reference the shared property. A local property with the same storage key
in an unrelated database is never migrated. Scalar and multiselect values use the same
workflow; multiselect replacement deduplicates the result and clearing removes only the
target option. Before mutation, original note contents are snapshotted for best-effort
rollback if any write or registry update fails.

Renaming follows the same bounded scan and snapshot contract. It replaces scalar values,
maps multiselect arrays with deduplication, preserves the option's position and color, then
updates the owning local schema or canonical shared definition. Empty names and collisions
with an existing option are rejected before mutation. `useSelectorOptionRename` centralizes
this routing and the user-facing errors for Table, Board, and Calendar.

Deleting an entire shared property must not discard note data. For every database that
references it, the shared reference is transactionally replaced by a database-local definition
cloned from the final shared name, type, storage key, options, and compatible schema
configuration. Existing note frontmatter/inline values are not rewritten. Each resulting
local property becomes independent, while local view references should retain their
column identity wherever possible. Only after all references are converted successfully
may the canonical shared definition be removed from the registry.

The conversion is exposed from both the shared Table column header and Database settings.
All referencing configurations are discovered vault-wide. They are written first, their
previous configurations are retained for best-effort rollback, and the registry entry is
deleted only after every conversion succeeds.

Attaching a shared property is forbidden when the target database already contains a
local property with the same storage key. This is a blocking collision: the plugin shows
an explanatory error, performs no schema mutation, does not merge option catalogs, and
does not offer automatic or assisted conversion. The user must manually rename or remove
the conflicting local property before retrying.

### Resolution layer

Views consume one effective `ColumnSchema[]`; they do not need separate value paths for
local and shared frontmatter. The resolver now:

1. reads local database definitions and shared-property references;
2. resolves shared references from the canonical registry;
3. injects supported virtual definitions;
4. detects missing references and ID/storage-key conflicts;
5. returns the effective schema plus origin/capability metadata for settings and editors.

Missing references are reported to Database settings. Local/shared storage-key conflicts
and reserved virtual IDs are excluded from the effective shared schema, while normal
attachment blocks conflicts before persistence. Board grouping, Calendar/Timeline date
selection, Fields menus, Quick Add, charts, filters, sorts, formatting, formula evaluation,
lookups, and rollups receive effective shared definitions where their types apply.

The agreed usable scope is complete, including deletion and rename migrations. Optional
follow-up work is limited to a standalone vault-wide registry-management screen for
unattached definitions.

## 15. Verification

TypeScript and the production bundle pass through `npm run build`. The full lint command
has 0 errors (5 unrelated pre-existing warnings). All 10 test files and 218 tests pass,
including dedicated Shared Properties registry, collision, attachment, composition,
propagation, destructive value migration, and local-conversion coverage.

## 16. Changelog

### 2026-08-28

- Implemented the versioned vault-root Shared Properties registry and guarded file creation.
- Added stable shared definitions, immutable storage keys, and explicit per-database UUID
  references without hierarchy inheritance.
- Extended effective-schema resolution to compose local, shared, and virtual columns while
  reporting collisions and missing references.
- Added Database settings UI for creating, editing, attaching, and detaching shared fields.
- Routed supported shared fields through all view, editor, Quick Add, filter/sort/chart,
  formula, lookup, rollup, and conditional-format consumers.
- Prevented the registry file from becoming a database row and blocked destructive option
  changes until the impact-aware migration workflow exists.
- Added seven tests and validated 211 passing tests, lint with 0 errors, and production build.
- Added direct shared-selector creation/attachment from the Table `+` menu, shared-column
  header actions, and canonical option/color updates from the normal selector cell editor.
- Removed shared option delete controls from cells until the impact-aware migration path
  is available, preventing accidental orphaned values.
- Added impact-aware shared-option deletion with replace, clear, or preserved historical
  values, bounded to notes owned by databases that reference the definition.
- Added confirmed vault-wide shared-property deletion with lossless per-database local
  clones and best-effort rollback for note and configuration mutations.
- Exposed the destructive workflows from selector cells, shared Table headers, and
  Database settings, and expanded the suite to 215 passing tests.
- Added a shared double-click inline option editor across Table cells and all Board/Calendar
  `EditableSelector` card variants.
- Added rollback-safe local/shared option renaming with scalar and multiselect value
  migration, color/order preservation, validation, and 217 passing tests.
- Extracted one shared option-creation input for Table and card menus, then enabled
  immediate local/shared option creation and selection from every Board/Calendar selector;
  the suite now has 218 passing tests.

### 2026-08-27

- Replaced local Calendar render functions with focused modules in
  `src/components/Calendar/`.
- Extracted date helpers and shared handler types.
- Kept persistence and Obsidian mutations in `DatabaseCalendar`.
- Preserved the public import used by `DatabaseRoot`.
- Corrected the documented week-start behavior from Sunday-first to the actual
  Monday-first implementation.
- Established desktop Obsidian as the only maintained platform.
- Removed Calendar mobile detection, mobile toolbar, BottomSheets, long-press actions,
  touch handlers, and mobile card-overflow behavior.
- Replaced the monolithic Board implementation with focused modules under
  `src/components/Board/`.
- Kept Board data derivation, persistence, and vault mutations in `DatabaseBoard`.
- Removed Board mobile detection, touch drag/ghost logic, long-press behavior,
  responsive toolbar branches, and BottomSheets.
- Preserved desktop card actions through Obsidian's native context menu.
- Corrected `EditableTitle` imports and event wrappers, restoring a fully passing test
  suite.
- Extracted native note actions into `ContextMenu/showNoteContextMenu`.
- Reused the shared context menu across Board and every Calendar card variant.
- Moved `EditableTitle` into `components/EditableFields/`.
- Added `EditableSelector` and integrated it into Calendar monthly-card properties.
- Documented and stabilized the compact selector states: badge-only for populated values
  and a quarter-width gray dash placeholder for empty values.
- Reused `EditableSelector` on Board card properties while keeping the grouping field
  controlled by column drag/drop.
- Added `EditableDate` to Board card properties with compact French formatting and the
  native date picker.
- Matched `EditableDate` typography and empty-state dimensions to selectors, changed
  labels to title case, and replaced the overflowing input overlay with explicit picker
  activation.
- Slightly enlarged the visible date control to align it with selector badges and made
  Board card fields flow inline with a uniform 5 px gap and automatic wrapping.
- Removed the date layout wrapper that could reserve invisible width and produce a
  state-dependent visual gap.
- Prevented selector buttons from stretching inside Board property rows, making the
  configured horizontal spacing match the visible badge spacing.
- Constrained the native date input outside the properties flow and populated selector
  buttons to `max-content`, eliminating invisible spacing from both controls.
- Positioned the native date input at the click coordinates immediately before
  `showPicker()`, anchoring the calendar beside the pointer without affecting gaps.
- Kept the native input in the card's owner document so Obsidian multi-window setups do
  not redirect the picker to a window on another monitor.
- Extracted `EditableCardProperties` and reused it in Board and Calendar card renderers.
- Integrated visible editable dates into monthly, weekly all-day, weekly timed, and
  no-date Calendar cards with the same wrapping 5 px gap contract as Board cards.
- Documented the planned database, virtual, and shared property scopes, including schema
  composition, stable shared identity, nested-folder consistency, and initial questions.
- Confirmed the root-level Markdown registry, explicit per-database attachment without
  inheritance, and title-only editing for otherwise read-only virtual properties.
- Named the canonical vault-root registry `register_shared_propertiers.md`.
- Defined impact-aware shared-option deletion with replace, clear, or historical-value
  preservation choices.
- Defined shared-property deletion as an atomic conversion of references to independent
  local properties without rewriting note values.
- Defined duplicate local/shared storage keys as blocking errors with no conversion.
- Audited the current virtual-property implementation and recorded the coverage matrix,
  mutation hazards, test gaps, and minimal unification milestone.
- Implemented `virtual-properties.ts` with five canonical sources, effective-schema
  resolution, collision reporting, centralized capabilities, and title-only mutation.
- Hydrated canonical virtual values on every row and added thirteen tests covering the new
  foundation, per-view selection, mutation guards, filters, sorts, and formulas while
  preserving legacy `systemField` columns.
- Exposed read-only virtual properties through `virtualColumnIds` in every view and routed
  menus, charts, conditional formatting, saved filters, and sorts through the effective schema.
- Excluded native and legacy read-only timestamps from Calendar and Timeline layout fields.
- Removed creation/modification system timestamps from the local Table column-type menu;
  canonical timestamps are now exposed only through the per-view virtual Fields catalog.
- Added global plugin settings for Fields-menu exposure and dedicated `📁`/`🧭` icons for
  parent folder and file path, with native timestamps hidden from those menus by default.
- Completed title editing across Table, Board, every Calendar card variant, List, Gallery,
  and Timeline through the shared `EditableTitle` component.
- Removed view-specific folder rendering and the synthetic `_folder` column in favor of
  the selectable canonical `_parentFolder` property.
- Added the versioned, idempotent legacy migration for `systemField` timestamps and
  `_folder`, preserving compatible formulas, references, filters, sorts, view layout,
  formatting, aggregations, and charts while clearing invalid mutable date assignments.
- Expanded the virtual-property suite to 204 passing project tests.
