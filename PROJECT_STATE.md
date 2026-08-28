# Project State — Obsidian Notion Bases Plugin

> Living document. Update this file whenever a feature is completed, a decision changes,
> or a bug is confirmed fixed.

## Current focus

The agreed first version of virtual properties is complete. Shared properties now cover
the complete agreed usable scope: vault registry, manual attachment, effective-schema
integration, synchronized definition/option editing, safe destructive migrations, and a
vault-wide registry manager available from the plugin settings.

## Supported platform

The plugin is maintained as a **desktop-only** project. Mobile-specific behavior,
responsive interaction variants, touch gestures, mobile toolbars, and BottomSheets are
out of scope and must not be reintroduced. New features target desktop Obsidian only.

## Confirmed working

### Calendar

- [x] Calendar view with monthly and weekly modes.
- [x] Calendar entries displayed as cards, including multiple cards per day.
- [x] Automatic month-cell height and seven-column grid.
- [x] Drag-and-drop cards between dates.
- [x] Date-field selection, navigation, and Today action.
- [x] All-day and timed cards in week view.
- [x] Current-time indicator and automatic week-view scrolling.
- [x] Separate section for rows without a date.
- [x] Conditional formatting on monthly cards.
- [x] Subfolder paths on Calendar cards.
- [x] Inline title editing through the shared `EditableTitle` component.
- [x] Inline editing of `select`, `status`, and `multiselect` properties on monthly cards.
- [x] Inline date editing on monthly, weekly all-day, weekly timed, and no-date cards.
- [x] Shared native Obsidian context menu on month, week, and no-date cards.
- [x] Calendar implementation split into focused files under `src/components/Calendar/`.

Stable invariants that must be preserved:

- automatic Calendar cell height;
- multiple cards in one day;
- drag/drop date changes;
- desktop click-to-create and drag/drop interactions;
- week timed-event positioning and current-time indicator.

### Board / Kanban

- [x] Board/Kanban view exists.
- [x] `EditableTitle` is shared by Board and Calendar cards.
- [x] Board implementation split into focused files under `src/components/Board/`.
- [x] Desktop HTML drag/drop for cards and columns.
- [x] Desktop-native Obsidian context menu for card actions.
- [x] Board and Calendar reuse the same note context-menu implementation.
- [x] Column limits, show more/less, filtering, conditional formatting, and virtualization.
- [x] All Board mobile/touch interaction paths removed.
- [x] `EditableSelector` — implemented for Calendar monthly cards and Board cards.
- [x] `EditableDate` — implemented for Board and Calendar card properties.

### Editable fields

Editable field components live in `src/components/EditableFields/`:

```text
EditableFields/
├── EditableCardProperties.tsx
├── EditableTitle.tsx
├── EditableSelector.tsx
├── RenamableSelectorOption.tsx
├── SelectorOptionCreateInput.tsx
├── SelectorOptionColorPicker.tsx
└── EditableDate.tsx
```

`EditableCardProperties` is the shared card-property renderer used by Board and Calendar.
It routes editable date and selector columns to their dedicated components and preserves
the existing read-only rendering for other populated property types.

`EditableSelector` displays configured options, supports clearing values, uses
single-choice behavior for `select`/`status`, and toggle behavior for `multiselect`.
It persists through `DatabaseManager.updateNoteField`, including inline-field metadata.
Calendar monthly, weekly, no-date, and Board cards share this implementation. A normal
click selects an option; a double-click opens the shared inline rename editor. Renaming
migrates scalar and multiselect note values and updates either the current database-local
schema or the canonical shared-property registry. The same creation input as the Table is
shown at the top of every card menu. A newly created select/status option is selected
immediately; a multiselect option is appended to the current value. Card menus also expose
the shared color picker and option deletion. Shared deletion opens the impact-aware modal;
local deletion clears that option from every affected note in the current database with
rollback protection. On Board cards, the grouping property remains excluded because it is
edited by moving the card between columns.

`EditableDate` is used on Board cards and every Calendar card variant. It hides the property name, displays a
compact French label such as `Lun 12 Janv.`, and opens the native date picker from a
small content-sized control. Its dimensions and typography match selector badges; the
empty state matches the compact selector placeholder. Card properties below the title
share a wrapping inline row with a uniform 5 px gap: date and selector stay side by side when
space permits and move naturally onto the next line otherwise. The editor preserves an
existing time suffix, supports clearing the date, persists through
`DatabaseManager.updateNoteField`, and leaves system dates read-only.
Before opening, the hidden native input is positioned at the pointer coordinates so the
picker appears beside the click; keyboard activation anchors it below the visible date.

Confirmed visual behavior on Calendar monthly cards:

- the property name is not displayed before the selector;
- a selector with a value shows only its colored badge, aligned left and sized to its text;
- the clickable area matches the visible badge rather than the full card width;
- an empty selector shows a small gray placeholder with a centered dash;
- the empty placeholder is aligned left and uses approximately one quarter of the card width,
  constrained between 48 px and 88 px.

### Property scopes

The target property model has three distinct scopes:

1. **Database properties** belong to one specific database. Their schema, type, options,
   and presentation are configured locally in that database's `_database.md`. Adding or
   removing a select option affects only that database.
2. **Virtual properties** project native Obsidian/file information without duplicating it
   into note frontmatter. The catalog includes title, parent folder, path,
   creation date, and last-modified date. Each virtual source defines its own capability:
   only title is editable and maps to a real file rename. Parent folder, path, creation
   date, and last-modified date are read-only. Moving a note remains a separate Obsidian
   file operation rather than an inline virtual-property edit.
3. **Shared properties** have one stable definition that is available to every database.
   A database references the shared definition instead of copying it. The property value
   still belongs to each note, but its name, type, and select/status options come from the
   shared definition. Updating those options must immediately affect every database that
   references the property.

The canonical example is a shared `type` selector with options such as `Todo`, `Post`,
and `Event`. Parent and child-folder databases reference the same shared-property ID and
frontmatter key, so the same note value and option catalog are understood consistently
throughout the hierarchy. Availability across databases does not necessarily mean that
the property must be displayed in every database: inclusion and view presentation remain
database-local.

The shared-property catalog is persisted in `register_shared_propertiers.md` at the vault
root. Shared properties are attached explicitly and manually to each database. There is
no parent-to-child inheritance: a parent database and a child-folder database share a
property only when both independently reference the same shared-property ID.

Current implementation status:

- [x] Local per-database schemas already exist.
- [x] Title is sourced from `TFile.basename` as `_title`; Table uses the shared virtual
  mutation path, while Board, Calendar, List, Gallery, and Timeline use `EditableTitle`.
  It participates in filters, sorts, formulas, relations, and lookups.
- [x] Creation and modification timestamps come only from canonical read-only `_ctime`
  and `_mtime` properties backed by `TFile.stat`; legacy local `systemField` definitions
  are migrated automatically and are no longer offered for creation.
- [x] Parent-folder information comes from canonical `_parentFolder` backed by
  `TFile.parent.path`; all view-specific `_folder` and relative-label paths were removed.
- [x] Vault-relative file path is already available internally through `row._file.path`
  for identity, drag/drop, ordering, selection, and file operations.
- [x] `ColumnSchema` now declares `propertyScope` and `virtualSource`, with stable sources
  for title, parent folder, path, creation time, and modification time.
- [x] `resolveEffectiveSchema()` composes local definitions, attached shared definitions,
  and canonical virtual definitions without copying shared/virtual schemas into a base.
- [x] Every row now carries `_title`, `_parentFolder`, `_path`, `_ctime`, and `_mtime`
  directly from `TFile` metadata.
- [x] Capability metadata marks title as the sole editable virtual source; both Table and
  `EditableTitle` route edits through `updateVirtualProperty() → renameNote()`.
- [x] Every view uses the shared title-editing path wherever it renders an interactive
  note title.
- [x] Canonical `_parentFolder`, `_path`, `_ctime`, and `_mtime` can be enabled independently
  in each view through `virtualColumnIds`; they are read-only and hidden by default.
- [x] Global plugin settings control which virtual properties are offered in Fields menus;
  parent folder/path default to visible, while creation/modification timestamps default to
  hidden and can be re-enabled without removing saved view selections.
- [x] Fields menus use dedicated virtual icons: folder (`📁`), file path (`🧭`), creation
  time (`🕓`), and modification time (`🖊`).
- [x] The effective schema now feeds view field menus, restored filters, sorts, formulas,
  charts, conditional formatting, and read-only card/list/table rendering.
- [x] Calendar and Timeline accept editable database/shared date properties as mutable
  layout fields; canonical and legacy system timestamps remain excluded from writes.
- [x] Legacy `_folder` view references and local `systemField` timestamp definitions are
  migrated once to canonical virtual IDs. Filters, sorts, pills, order, widths,
  aggregations, conditional formatting, pinned columns, formulas, references, and chart
  axes are remapped; read-only dates are removed from mutable Calendar/Timeline layouts.
- [x] A unified virtual-property resolver and centralized read/edit/frontmatter
  capabilities now exist in `src/virtual-properties.ts`.
- [x] Dedicated tests cover the catalog, effective schema composition, reserved-ID
  collisions, canonical row hydration, title-only mutation, per-view selection,
  filter/sort/formula consumption, complete legacy migration, and migration idempotence.
- [x] `register_shared_propertiers.md` is created lazily at the vault root and stores
  versioned canonical definitions with stable UUIDs and immutable note storage keys.
- [x] Databases persist only `sharedPropertyIds`; attachment is explicit and never inherited.
- [x] Shared definitions are editable from Database settings and option additions,
  recolors, reorderings, and name changes propagate to every attached database.
- [x] The Table `+` menu can create a new shared `select` or attach an existing shared
  `select`/`status`/`multiselect` without opening Database settings.
- [x] Shared selector options can be added and recolored directly from normal Table cells;
  those edits update the canonical registry instead of copying the field locally.
- [x] Shared column headers expose direct rename, hide, and non-destructive detach actions.
- [x] Table, Board, Calendar, List, Gallery, Timeline, Charts, Quick Add, filters, sorts,
  formulas, lookups, rollups, conditional formatting, and editable fields consume the
  effective shared schema where applicable.
- [x] Detaching a property removes only the database reference and leaves note values intact.
- [x] Collision behavior is defined: attaching or creating a shared property is blocked
  when the database already has a local property with the same storage key.
- [x] Removing a shared option from a Table cell first scans the notes belonging to every
  referencing database, then requires an explicit replace, clear, or historical-value choice.
- [x] Shared-property deletion is available from its Table header and Database settings.
  It clones the final definition locally into every referencing database before removing
  the canonical registry entry, while leaving note values and view column IDs intact.
- [x] Both destructive workflows use best-effort rollback: note contents are restored if
  an option migration fails, and previously written database configs are restored if the
  global property conversion fails.
- [x] Existing `select`, `status`, and `multiselect` options can be renamed by double-click
  from Table cells and Board/Calendar `EditableSelector` menus. Local renames migrate the
  current database’s notes; shared renames migrate every referencing database and update
  the canonical registry. Colors/order are preserved and duplicate or empty names are blocked.
- [x] New options can be created from the same input in Table, Board, and every Calendar
  card selector. Creation updates the local schema or shared registry according to scope,
  then immediately selects the value on the originating card.
- [x] Board and Calendar selector menus expose the same color palette and delete control
  as Table. Shared deletion reuses the replace/clear/historical migration modal; local
  deletion clears affected scalar/multiselect values throughout the current database.
- [x] The plugin settings expose a standalone vault-wide registry manager. It can create
  and edit unattached definitions, audit usage, open referencing databases, invoke the
  safe global-delete workflow, and detect or clean stale database references.

Confirmed design decisions:

- the registry is `register_shared_propertiers.md` at the vault root;
- databases attach shared properties manually, with no hierarchy inheritance;
- attached databases cannot override a shared property's canonical name, type, or
  options; only view presentation remains local;
- title is the only editable virtual property and renames the actual file;
- parent folder, path, creation date, and modification date are read-only;
- deleting a shared option requires an impact scan and an explicit decision to replace,
  clear, or preserve affected note values as historical values;
- deleting a shared property converts every database reference into an independent local
  property cloned from the last shared definition, while leaving note values untouched;
- no automatic or assisted local-to-shared conversion exists; a duplicate storage key is
  a blocking collision and produces no mutation.

The registry's frontmatter marker and the exact wording/presentation of destructive-action
dialogs remain internal implementation details.

Virtual-properties stage: **complete for the agreed first version**. Stable sources,
canonical row values, shared title editing, per-view opt-in visibility, effective-schema
consumers, read-only mutation guards, global Fields-menu preferences, and the versioned
legacy migration are implemented without frontmatter duplication.

Shared-properties stage: **complete for the agreed usable scope**. Registry persistence,
stable identity, manual per-database references, propagation, cross-view editing, safe
detach, blocking collisions, impact-aware option deletion, lossless global-property
deletion, and standalone vault-wide registry administration are implemented. Inline
option creation, recoloring, renaming, and deletion are consistent across Table, Board,
and Calendar for local and shared selectors.

### Database navigation

- [x] `DatabasePickerModal` is available through a shortcut.
- [x] It lists databases in the vault and opens the selected database.
- [x] It is a navigation tool, not a Calendar data-source selector.

## Calendar component architecture

`src/components/DatabaseCalendar.tsx` is the stable public entry point and orchestration
layer. It owns data loading, filter state, view persistence, navigation state, drag/drop
mutations, and desktop toolbar/dropdown state.

Rendering and date logic are extracted under `src/components/Calendar/`:

```text
Calendar/
├── DatabaseWeekView.tsx
├── DatabaseMonthView.tsx
├── DatabaseMonthWeek.tsx
├── DatabaseMonthCell.tsx
├── DatabaseMonthlyCard.tsx
├── DatabaseNoDateRows.tsx
├── calendar-types.ts
└── calendar-utils.ts
```

The extracted components receive explicit props. They do not close over
`DatabaseCalendar` state, which makes their dependencies visible and keeps the entry
component focused on orchestration.

## Board component architecture

`src/components/DatabaseBoard.tsx` is the stable public entry point and owns data
loading, filtering/sorting, column derivation, view persistence, and vault mutations.

```text
Board/
├── BoardToolbar.tsx
├── BoardColumn.tsx
├── BoardCard.tsx
├── LazyBoardCard.tsx
└── board-types.ts
```

The Board is desktop-only. Cards and columns use native HTML drag/drop; card actions use
Obsidian's desktop context menu. No touch-drag, long-press, mobile toolbar, or BottomSheet
code remains in the Board implementation.

## Shared note context menu

`src/components/ContextMenu/showNoteContextMenu.ts` owns the reusable native Obsidian
menu for a note. It provides open, duplicate, and delete actions and is currently used
by Board cards and every Calendar card variant (monthly, weekly all-day, weekly timed,
and rows without a date).

## Calendar date behavior

The Calendar uses the native JavaScript `Date` API. Pure date helpers now live in
`Calendar/calendar-utils.ts`:

- `buildCalendarGrid(year, month)`
- `buildWeekGrid(year, month, day)`
- `formatWeekRange(days)`
- `dateKey(year, month, day)`
- `formatTime(hour, minute)`
- `getRowTime(row, fieldId)`
- `parseDateValue(value)`
- translated weekday/month label helpers

Current code is Monday-first:

- weekday labels are Monday through Sunday;
- the month offset normalizes `Date#getDay()` with `(day + 6) % 7`;
- the week builder finds the Monday containing the anchor date.

Date strings supported by the parser include `YYYY-MM-DD` and
`YYYY-MM-DDTHH:mm...`. Rows are grouped in a `Map<string, NoteRow[]>` and sorted by
time, with untimed entries first.

## View configuration flow

`DatabaseCalendar` receives an `externalView: ViewConfig` and persists changes through
`onViewChange(updatedView)`. Its local `activeView` provides immediate UI updates.

Calendar-related view fields currently include:

- `calendarDateField`
- `calendarViewMode`
- `hiddenColumns`
- `includeSubfolders`
- `activePills`
- `filtersCollapsed`
- `conditionalFormats`

The planned configurable week start should be stored on `ViewConfig`, for example as
`calendarWeekStart?: 'sunday' | 'monday'`, and consumed by both month and week helpers.

## Verification status

On 2026-08-28 after the vault-wide Shared Properties manager:

- `npm run build`: passes.
- `npm test`: all 10 test files and 220 tests pass.
- `npm run lint`: 0 errors; 5 unrelated pre-existing warnings remain.
- Shared-property tests cover registry persistence/sanitization, reference resolution,
  collisions, attach/detach, effective-schema composition, cross-database propagation,
  scalar/multiselect option migrations, historical values, local-definition cloning, and
  vault-wide missing-reference audits.

## Engineering preference

This fork is for personal use. Prefer simple, localized changes, explicit component
contracts, and preservation of known-working behavior over generalized abstraction.

## Changelog

### 2026-08-28

- Added the vault-root `register_shared_propertiers.md` registry with a dedicated marker,
  schema version, sanitized canonical definitions, and guarded persistence.
- Added stable shared UUIDs, immutable note storage keys, `sharedPropertyIds` database
  references, and `propertyScope: 'shared'` effective columns.
- Added creation, editing, manual attachment, and non-destructive detachment in Database
  settings, with no parent/child inheritance.
- Composed database-local, attached shared, and virtual properties in the effective schema.
- Integrated shared selectors/dates and other supported fields across Table, Board,
  Calendar, List, Gallery, Timeline, Charts, Quick Add, filters, sorts, formulas, lookups,
  rollups, and conditional formatting where compatible.
- Blocked local/shared key collisions before mutation and excluded the registry Markdown
  file from database rows.
- Locked shared storage keys/types after creation and blocked option removal/rename until
  the impact-aware migration workflow is implemented.
- Added seven Shared Properties tests, bringing the suite to 211 passing tests.
- Added a direct Table workflow for creating/attaching shared selectors from the `+`
  button and managing their name, visibility, and attachment from the column header.
- Routed selector option creation and color changes from Table cells to the canonical
  registry, fixing the remaining attempt to persist effective shared columns locally.
- Kept delete buttons hidden for shared options until the impact-aware deletion workflow
  can preserve or explicitly migrate every affected note value.
- Added the impact-aware shared-option deletion modal with replace, clear, and preserve-as-
  historical choices; the scan is restricted to notes of databases that reference the field.
- Added full shared-property deletion from Table headers and Database settings. Every
  reference is converted to an independent local definition before the registry entry is
  removed, preserving stored values and existing view references.
- Added rollback guards for both destructive workflows and four migration test cases,
  bringing the suite to 215 passing tests.
- Added one reusable double-click option editor to Table and every Board/Calendar card
  selector for local and shared `select`, `status`, and `multiselect` properties.
- Added lossless option-rename migrations with preserved color/order, multiselect
  deduplication, duplicate/empty-name guards, and rollback protection; the suite now has
  217 passing tests.
- Reused `SelectorOptionCreateInput` across Table, Board, and Calendar menus and added
  local/shared option creation directly from cards with immediate value selection. The
  suite now has 218 passing tests.
- Added `SelectorOptionColorPicker` and delete actions to every Board/Calendar selector.
  Colors persist locally or canonically by scope; shared deletion reuses the impact modal,
  while local deletion safely clears all affected note values. The suite now has 219 tests.
- Added a standalone Shared Properties registry manager to plugin settings. It lists every
  definition with its options, referencing databases, and populated-note count; supports
  create/edit/delete and database navigation; and audits/removes stale references. Added
  a focused missing-reference audit test, bringing the suite to 220 passing tests.

### 2026-08-27

- Split the 1,043-line `DatabaseCalendar.tsx` into an orchestration component and eight
  focused Calendar modules.
- Extracted week, month, week-row, month-cell, monthly-card, and no-date rendering.
- Extracted pure date helpers and shared Calendar handler types.
- Kept `DatabaseCalendar` as the import used by `DatabaseRoot`.
- Corrected documentation to reflect the actual Monday-first implementation.
- Confirmed Calendar already reuses `EditableTitle`.
- Established desktop Obsidian as the only maintained platform.
- Removed Calendar mobile detection, mobile toolbar, BottomSheets, touch gestures,
  long-press actions, and mobile card-overflow behavior.
- Split the 932-line `DatabaseBoard.tsx` into a 179-line orchestration component and
  focused toolbar, column, card, virtualization, and type modules.
- Removed Board mobile detection, touch drag/ghost handling, long-press logic, mobile
  toolbar, and BottomSheets.
- Replaced the shared card action sheet with Obsidian's native desktop context menu.
- Fixed `EditableTitle` imports and event wrappers so the full test suite passes.
- Extracted the Board card menu into the shared `ContextMenu/showNoteContextMenu` helper.
- Added the shared native context menu to all Calendar card variants.
- Moved `EditableTitle` into the new `components/EditableFields/` module.
- Added `EditableSelector` for Calendar monthly-card `select`, `status`, and
  `multiselect` properties, including empty fields.
- Finalized the selector presentation: no property label or outer full-width container,
  content-sized colored badges, and a compact left-aligned placeholder for empty values.
- Reused `EditableSelector` for visible selector properties on Board cards.
- Added `EditableDate` for editable Board date properties with compact French labels and
  the native date picker.
- Refined `EditableDate` sizing, typography, title-case labels, empty-state alignment,
  and picker activation so the control no longer overflows its card.
- Aligned the visible date control with selector badges and changed Board card
  properties to a compact wrapping inline row with a uniform 5 px gap.
- Removed the date-only layout wrapper so empty and populated dates reserve exactly
  their visible width and keep the same gap before the next field.
- Prevented selector buttons from growing inside the properties row, keeping the visual
  gap between the date and badge identical to the configured flex gap.
- Removed all invisible horizontal width between the visible controls by forcing
  populated selectors to `max-content` and the native date input out of the flex flow.
- Anchored the native date input to the click position before opening the picker.
- Kept the input in the card's own document so multi-window and multi-monitor Obsidian
  setups cannot open the picker from another window's document.
- Extracted `EditableCardProperties` as the shared Board/Calendar property renderer.
- Added `EditableDate` to monthly, weekly all-day, weekly timed, and no-date Calendar
  cards while preserving the uniform 5 px property gap.
- Formalized the planned database, virtual, and shared property scopes, including the
  shared `type` selector use case and its initial design questions.
- Confirmed a root-level Markdown registry, manual per-database shared-property
  attachment with no inheritance, and read-only virtual metadata except for title rename.
- Named the vault-root registry `register_shared_propertiers.md`.
- Defined shared-option deletion as an impact-aware replace/clear/preserve workflow.
- Defined shared-property deletion as conversion to per-database local clones with note
  values preserved.
- Made local/shared storage-key collisions blocking, with no automatic conversion.
- Audited the existing virtual-property foundations and documented the exact coverage of
  title, parent folder, path, creation time, and modification time across the codebase.
- Implemented the canonical virtual-property catalog, non-persisted effective-schema
  resolver, stable row hydration, centralized capabilities, and title-only mutation path.
- Added thirteen virtual-property tests, bringing the suite to 202 passing tests.
- Exposed read-only virtual properties per view and unified filters, sorts, formulas,
  charts, conditional formatting, and Calendar/Timeline mutation guards around the
  effective schema.
- Removed the obsolete Table column-type actions that created local creation/modification
  `systemField` columns; those values are now added only from the virtual Fields catalog.
- Added plugin-wide Fields-menu visibility toggles for each read-only virtual property,
  with creation/modification timestamps hidden by default, plus dedicated folder/path icons.
