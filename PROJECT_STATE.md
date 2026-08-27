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
└── EditableDate.tsx
```

`EditableCardProperties` is the shared card-property renderer used by Board and Calendar.
It routes editable date and selector columns to their dedicated components and preserves
the existing read-only rendering for other populated property types.

`EditableSelector` displays configured options, supports clearing values, uses
single-choice behavior for `select`/`status`, and toggle behavior for `multiselect`.
It persists through `DatabaseManager.updateNoteField`, including inline-field metadata.
Calendar monthly cards and Board cards share this implementation. On Board cards, the
grouping property remains excluded because it is edited by moving the card between
columns.
Creating, renaming, recoloring, or deleting schema options is intentionally outside this
first Calendar implementation.

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

On 2026-08-27 after the Calendar and Board splits:

- `npm run build`: passes.
- `npm test`: all 8 test files and 189 tests pass.
- targeted ESLint for Calendar, Board, and `EditableFields`: passes.
- `EditableTitle` now uses relative imports, a popout-safe `window.requestAnimationFrame`,
  and a void-returning blur handler.

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
