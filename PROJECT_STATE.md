# Project State — Obsidian Notion Bases Plugin

> Living document. Update this file whenever a feature is completed, a decision changes,
> or a bug is confirmed fixed.

## Current focus

The Calendar component split is complete. The next planned Calendar feature remains a
per-view setting for choosing Sunday or Monday as the first day of the week.

The current implementation is Monday-first in both month and week views. Any future
week-start setting must preserve that behavior as the compatibility fallback unless a
migration decision explicitly changes it.

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
- [ ] `EditableSelector` — not implemented.
- [ ] `EditableDate` — not implemented.

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

On 2026-08-27 after the Calendar split:

- `npm run build`: passes.
- `npm test`: 177 tests pass, but the suite exits with one failed import suite because
  `EditableTitle.tsx` uses unresolved absolute imports (`database-manager` and
  `hooks/useClickOrDoubleClick`) in the Vitest environment.
- `npm run lint`: still reports a pre-existing error in `EditableTitle.tsx` where an
  async handler is passed directly to `onBlur`; the Calendar extraction adds no lint
  warnings.

## Engineering preference

This fork is for personal use. Prefer simple, localized changes, explicit component
contracts, and preservation of known-working behavior over generalized abstraction.

## Changelog

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
