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
visible-column subset for property display. It reuses the shared `EditableTitle`.

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
EditableTitle                     inline card-title editing
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

## 11. Verification

The structural refactor is verified with TypeScript and the production bundle through
`npm run build`. Calendar-specific lint passes. The test run reports 177 passing tests,
but one suite cannot import `EditableTitle.tsx` because its existing absolute imports
(`database-manager` and `hooks/useClickOrDoubleClick`) are unresolved by Vitest.
Repository-wide lint also has a pre-existing `@typescript-eslint/no-misused-promises`
error in `EditableTitle.tsx`; both issues are outside the Calendar split.

## 12. Changelog

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
