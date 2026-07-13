/**
 * Shared type definitions for the nav manager Lit component.
 */

import type { SystemNavKey } from "../../types/constants.js";

export interface NavManagerItem {
  id: string;
  type: "link" | "system" | "collection";
  systemKey?: SystemNavKey;
  collectionId?: string;
  label: string;
  displayLabel?: string;
  url: string;
  placement?: "header" | "more";
}

export interface SystemNavConfig {
  key: SystemNavKey;
  label: string;
  description: string;
}

/** A collection entry in the picker, with optional group context */
export interface NavManagerCollection {
  id: string;
  title: string;
  slug: string;
  /** Group label from directory divider, if this collection belongs to one */
  group?: string | null;
}

export interface NavManagerSuggestedLink {
  key: string;
  label: string;
  url: string;
  targetType: "page" | "collection" | "archive";
  targetLabel: string;
  navItemType: "link" | "collection";
  collectionId?: string;
}

export interface NavManagerLabels {
  preview: string;
  navigationItems: string;
  emptyState: string;
  link: string;
  system: string;
  toggleEdit: string;
  label: string;
  url: string;
  save: string;
  delete: string;
  remove: string;
  confirmDeleteLink: string;
  orderSaved: string;
  labelRequired: string;
  saveFailed: string;
  deleteFailed: string;
  systemLinks: string;
  systemLinksDescription: string;
  addCustomLinkToNavigation: string;
  addLink: string;
  addLinkDescription: string;
  urlPlaceholder: string;
  labelAndUrlRequired: string;
  suggestedLinks: string;
  suggestedLinksDescription: string;
  addSuggestedLink: string;
  suggestedLinkAdded: string;
  collection: string;
  addCollection: string;
  addCollectionToNavigation: string;
  addCollectionDescription: string;
  allCollectionsAdded: string;
  noCollections: string;
  confirmDeleteCollection: string;
  headerSection: string;
  moreSection: string;
  moreEmptyHint: string;
  placementSaved: string;
  cancel: string;
}
