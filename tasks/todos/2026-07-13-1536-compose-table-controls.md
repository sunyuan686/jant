# Compose table controls

## Goal

Make tables created in the compose editor discoverably editable after insertion,
including the ability to add more than the default three columns, while keeping
the interaction compact and consistent with Jant's Organic Minimalism aesthetic.

## Product decisions

- Keep `/ Table` inserting a 3×3 table with a header row as the fast default.
- When the selection is inside a table, show a compact contextual table toolbar.
- Keep the two most common growth actions directly visible:
  - Add row below the current row.
  - Add column after the current column.
- Put the complete structural actions in a `Table options` menu:
  - Add row above / below.
  - Add column before / after.
  - Delete current row / column.
  - Toggle the first row as a header row.
  - Delete the table, separated visually as the destructive action.
- Do not add column resizing, cell colors/alignment, merge/split, sorting, or
  row/column reordering in this first version. Those features add spreadsheet
  complexity without helping the core writing use case.
- Do not adopt TipTap's React Table Node UI. Implement the small interaction as
  a local TipTap/ProseMirror extension using the existing vanilla-DOM floating
  UI patterns.
- Follow up within this task with an insertion-size grid (up to 8×8) only after
  the contextual editing controls are complete and verified. The grid keeps a
  3×3 initial hover/default and is opened from the slash `Table` command rather
  than adding another permanent compose toolbar.

## Interaction and accessibility

- Anchor the toolbar to the active table and reposition it on selection,
  transaction, resize, and scroll changes without changing document content.
- Preserve the editor selection when pointer users invoke an action.
- Disable or hide actions according to TipTap's `editor.can()` result.
- Close the options menu on outside click/tap, `Escape`, selection leaving the
  table, editor blur to an unrelated control, or another table menu opening.
- Support keyboard access with `Alt+F10` while the caret is in a table; focus the
  first table action, use `Tab`/`Shift+Tab` for toolbar navigation, `Enter` or
  `Space` to invoke, and `Escape` to close/return focus to the editor.
- Use semantic buttons, concise `aria-label`/tooltip text, visible focus states,
  and at least 44px touch targets for the mobile layout.
- On narrow screens, keep the table horizontally scrollable and place the
  toolbar within the compose viewport so additional columns never widen or clip
  the dialog itself.
- All visible labels must use Lingui descriptors with translator context.

## Implementation plan

- [x] Add a cohesive `table-controls.ts` TipTap extension responsible for active
      table detection, positioning, toolbar/menu DOM, command dispatch, keyboard
      behavior, and cleanup.
- [x] Add localized table-control labels to the compose labels contract and pass
      them into the editor extension configuration from SSR/Lit compose surfaces.
- [x] Register the extension in the standard compose editor extension set only;
      settings editors should continue to omit compose table controls.
- [x] Add token-based styles for the floating toolbar, menu, destructive state,
      focus/hover/disabled states, narrow viewports, and horizontal table overflow.
- [x] Add focused tests for visibility, command availability, add/delete behavior,
      menu dismissal, selection preservation, keyboard access, and teardown.
- [x] Replace the slash command's immediate insert action with an accessible 8×8
      dimension picker while preserving keyboard selection and the 3×3 default.
- [x] Add tests for grid pointer/keyboard selection, cancellation, and insertion
      dimensions.
- [x] Run `mise run check-tests` and `mise run check-lint`.
- [ ] Use `mise run dev-debug` for manual compose verification on desktop and a
      narrow mobile viewport; verify 4+ columns, horizontal overflow, all delete
      paths, outside-click/Escape dismissal, and `Alt+F10` keyboard operation.

## Review / results

Implemented a compose-only table UI layer without changing the persisted TipTap
table model:

- `/ Table` now opens an accessible 8×8 dimension picker with a 3×3 default.
- A contextual toolbar appears for focused table selections with direct add-row
  and add-column actions plus a complete structural options menu.
- The options menu supports insertion before/after, guarded row/column deletion,
  first-row header toggling, and whole-table deletion.
- `Alt+F10` focuses the toolbar; Escape, outside pointer/focus, and peer-menu
  behavior are covered. Fullscreen compose treats table overlays as Escape-owned
  UI so it does not close the compose surface accidentally.
- Table cells retain a usable minimum width and the compose editor scrolls wide
  tables horizontally.

Verification:

- `mise run test`: 224 test files and 2664 tests passed; includes typecheck,
  ESLint, the core library build, focused table tests, and compose Escape
  integration coverage.
- `mise run build`: client assets, site assets, and the core library built.
- `mise run i18n-build`: extraction, compilation, and coverage generation passed.
- `mise run check-format`: passed.
- `git diff --check`: passed.
- `mise run dev-debug`: the local site started at `http://localhost:19020`, but
  no browser backend was available in this session. Desktop/mobile visual QA is
  therefore still unchecked and should be completed before committing.
