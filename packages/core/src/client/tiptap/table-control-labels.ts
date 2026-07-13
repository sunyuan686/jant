/** Localized labels shared by compose SSR and client-side table UI. */
export interface TableControlLabels {
  toolbarLabel: string;
  addRowAbove: string;
  addRowBelow: string;
  addColumnBefore: string;
  addColumnAfter: string;
  options: string;
  deleteRow: string;
  deleteColumn: string;
  toggleHeaderRow: string;
  deleteTable: string;
  sizePickerLabel: string;
  insertTableSize: string;
}

export const DEFAULT_TABLE_CONTROL_LABELS: TableControlLabels = {
  toolbarLabel: "Table controls",
  addRowAbove: "Add row above",
  addRowBelow: "Add row below",
  addColumnBefore: "Add column before",
  addColumnAfter: "Add column after",
  options: "Table options",
  deleteRow: "Delete row",
  deleteColumn: "Delete column",
  toggleHeaderRow: "Toggle header row",
  deleteTable: "Delete table",
  sizePickerLabel: "Choose table size",
  insertTableSize: "Insert %rows% by %cols% table",
};
