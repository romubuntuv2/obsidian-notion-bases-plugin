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
| `DatabaseWeekView.tsx` | All-day cards, headers, time slots, timed cards, and current-time line. |
| `DatabaseMonthView.tsx` | Weekday headings and division of the month grid into seven-day rows. |
| `DatabaseMonthWeek.tsx` | One seven-cell month row. |
| `DatabaseMonthCell.tsx` | Day state, desktop note creation, card rendering, and drop target. |
| `DatabaseMonthlyCard.tsx` | Monthly card title, time, folder path, properties, and conditional style. |
| `DatabaseNoDateRows.tsx` | Draggable cards whose selected date field is empty. |
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
| `BoardCard.tsx` | Editable title, visible properties, folder path, card drag, and right-click forwarding. |
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
| `EditableTitle.tsx` | Single-click open, double-click rename, and rename persistence through `DatabaseManager`. |
| `EditableSelector.tsx` | Fixed-position option menu and persistence for `select`, `status`, and `multiselect` fields. |

`EditableSelector` receives the `ColumnSchema`, current value, target `TFile`, manager,
and optional inline-field metadata. It updates optimistically, rolls back on failure,
and persists through `DatabaseManager.updateNoteField`. Calendar monthly cards render
the editor even for empty selector values so a value can be assigned directly.

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

Schema-option management is not part of this component's first iteration: it consumes
the existing options but does not create, rename, recolor, or delete them.

## 14. Verification

The structural refactors are verified with TypeScript and the production bundle through
`npm run build`. Calendar-, Board-, and `EditableFields`-specific lint passes. All 8 test
files and 189 tests pass. `EditableTitle` uses relative imports so it resolves in both
the production bundle and Vitest.

## 15. Changelog

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
