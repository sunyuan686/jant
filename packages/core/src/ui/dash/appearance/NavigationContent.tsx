/**
 * Navigation management: Lit-powered reorderable nav items, add area, system toggles
 */

import { msg } from "@lingui/core/macro";
import { useLingui } from "../../../i18n/context.js";
import type {
  CollectionsDirectoryData,
  NavItem,
  SuggestedNavLink,
  SystemNavKey,
} from "../../../types.js";
import { SYSTEM_NAV_KEYS } from "../../../types.js";
import type {
  NavManagerCollection,
  NavManagerLabels,
  NavManagerSuggestedLink,
  SystemNavConfig,
} from "../../../client/components/nav-manager-types.js";
import { toPublicHref, toPublicPath } from "../../../lib/url.js";
import {
  getNavItemDisplayLabel,
  getSystemNavDescription,
  getSystemNavDisplayLabel,
  NAV_MORE_LABEL,
} from "../../shared/navigation-labels.js";

// =============================================================================
// Main component
// =============================================================================

export function NavigationContent({
  navItems,
  directoryData,
  suggestedLinks,
  mainRssFeed,
  siteName,
  sitePathPrefix = "",
}: {
  navItems: NavItem[];
  directoryData: CollectionsDirectoryData;
  suggestedLinks: SuggestedNavLink[];
  mainRssFeed: string;
  siteName: string;
  sitePathPrefix?: string;
}) {
  const { i18n } = useLingui();
  const latestLabel = i18n._(
    msg({
      message: "Latest",
      comment: "@context: Browse filter label for latest posts",
    }),
  );
  const featuredLabel = i18n._(
    msg({
      message: "Featured",
      comment: "@context: Browse filter label for featured posts",
    }),
  );
  const previewLabel = i18n._(
    msg({
      message: "Navigation Preview",
      comment: "@context: Label for nav preview section",
    }),
  );
  const moreLabel = i18n._(NAV_MORE_LABEL);

  const suggestedTargetLabels = {
    page: i18n._(
      msg({
        message: "Page",
        comment: "@context: Suggested navigation link target type",
      }),
    ),
    collection: i18n._(
      msg({
        message: "Collection",
        comment: "@context: Suggested navigation link target type",
      }),
    ),
    archive: i18n._(
      msg({
        message: "Archive",
        comment: "@context: Suggested navigation link target type",
      }),
    ),
  } satisfies Record<SuggestedNavLink["targetType"], string>;

  // Serialize nav items for the Lit component
  const itemsData = navItems.map((item) => {
    // System link URLs are always computed from constants, never from DB
    const url =
      item.type === "system" && item.systemKey
        ? (SYSTEM_NAV_KEYS[item.systemKey]?.url ?? item.url)
        : item.url;
    return {
      id: item.id,
      type: item.type,
      systemKey: item.systemKey,
      collectionId: item.collectionId,
      label: item.label,
      displayLabel: getNavItemDisplayLabel(item, i18n, sitePathPrefix),
      url,
      placement: item.placement ?? "header",
    };
  });

  // Serialize collections in directory order with group labels from dividers
  const collectionsData: NavManagerCollection[] = (() => {
    const { items } = directoryData;
    const result: NavManagerCollection[] = [];
    let currentGroup: string | null = null;

    for (const item of items) {
      if (item.type === "divider") {
        currentGroup = item.label ?? null;
      } else if (item.type === "collection" && item.collection) {
        result.push({
          id: item.collection.id,
          title: item.collection.title,
          slug: item.collection.slug,
          group: currentGroup,
        });
      }
    }

    // Append collections not in directory items
    const includedIds = new Set(result.map((c) => c.id));
    for (const c of directoryData.collections) {
      if (!includedIds.has(c.id)) {
        result.push({ id: c.id, title: c.title, slug: c.slug, group: null });
      }
    }

    return result;
  })();

  const suggestedLinksData: NavManagerSuggestedLink[] = suggestedLinks.map(
    (link) => ({
      ...link,
      targetLabel: suggestedTargetLabels[link.targetType],
    }),
  );

  // Build system nav config array for the Lit component
  const systemNavData: SystemNavConfig[] = (
    Object.keys(SYSTEM_NAV_KEYS) as SystemNavKey[]
  ).map((key) => ({
    key,
    label: getSystemNavDisplayLabel(key, i18n),
    description:
      key === "rss"
        ? i18n._(
            msg({
              message:
                "Header RSS points to your {feed} feed (/feed). Change what /feed returns in General.",
              comment:
                "@context: Description for the RSS system navigation toggle. {feed} is either Latest or Featured.",
            }),
            {
              feed: mainRssFeed === "latest" ? latestLabel : featuredLabel,
            },
          )
        : getSystemNavDescription(key, i18n),
  }));

  const labels: NavManagerLabels = {
    preview: previewLabel,
    navigationItems: i18n._(
      msg({
        message: "Navigation items",
        comment: "@context: Section heading for nav items",
      }),
    ),
    emptyState: i18n._(
      msg({
        message:
          "No navigation items yet. Add links or enable system items below.",
        comment: "@context: Empty state for navigation items",
      }),
    ),
    link: i18n._(
      msg({
        message: "link",
        comment: "@context: Nav item type badge",
      }),
    ),
    system: i18n._(
      msg({
        message: "system",
        comment: "@context: Nav item type badge",
      }),
    ),
    toggleEdit: i18n._(
      msg({
        message: "Toggle edit panel",
        comment: "@context: Button to expand/collapse nav item edit",
      }),
    ),
    label: i18n._(
      msg({
        message: "Label",
        comment: "@context: Nav item label field",
      }),
    ),
    url: i18n._(
      msg({
        message: "URL",
        comment: "@context: Nav item URL field",
      }),
    ),
    save: i18n._(
      msg({
        message: "Save",
        comment: "@context: Save nav item changes",
      }),
    ),
    delete: i18n._(
      msg({
        message: "Delete",
        comment: "@context: Delete nav item",
      }),
    ),
    remove: i18n._(
      msg({
        message: "Remove",
        comment: "@context: Remove system item from navigation",
      }),
    ),
    confirmDeleteLink: i18n._(
      msg({
        message:
          "Delete this navigation link? Visitors won't see it in your site header anymore.",
        comment:
          "@context: Confirm dialog for deleting a custom navigation link",
      }),
    ),
    orderSaved: i18n._(
      msg({
        message: "Navigation order updated.",
        comment: "@context: Toast after saving navigation item order",
      }),
    ),
    labelRequired: i18n._(
      msg({
        message: "Label is required",
        comment: "@context: Error toast when nav label is empty",
      }),
    ),
    saveFailed: i18n._(
      msg({
        message: "Couldn't save. Try again in a moment.",
        comment: "@context: Error toast when nav save fails",
      }),
    ),
    deleteFailed: i18n._(
      msg({
        message: "Couldn't delete. Try again in a moment.",
        comment: "@context: Error toast when nav delete fails",
      }),
    ),
    systemLinks: i18n._(
      msg({
        message: "Built-in links",
        comment: "@context: Section heading for built-in nav items",
      }),
    ),
    systemLinksDescription: i18n._(
      msg({
        message:
          "Show or hide built-in destinations in the header and More menu.",
        comment: "@context: Description for built-in nav toggles",
      }),
    ),
    addCustomLinkToNavigation: i18n._(
      msg({
        message: "Add custom link to navigation",
        comment: "@context: Section heading for adding custom link to nav",
      }),
    ),
    addLink: i18n._(
      msg({
        message: "Add Link",
        comment: "@context: Button and heading for adding custom link",
      }),
    ),
    addLinkDescription: i18n._(
      msg({
        message: "Add a custom link to any URL",
        comment: "@context: Description in link popover form",
      }),
    ),
    urlPlaceholder: "/archive or https://...",
    headerSection: i18n._(
      msg({
        message: "Header",
        comment: "@context: Section label for nav items shown in header",
      }),
    ),
    moreSection: i18n._(
      msg({
        message: "More",
        comment:
          "@context: Section label for nav items hidden under More dropdown",
      }),
    ),
    moreEmptyHint: i18n._(
      msg({
        message: "Drag links here to show them under the More menu",
        comment:
          "@context: Hint text shown in empty More section of nav settings",
      }),
    ),
    placementSaved: i18n._(
      msg({
        message: "Navigation placement updated.",
        comment: "@context: Toast after moving nav item between header/more",
      }),
    ),
    cancel: i18n._(
      msg({
        message: "Cancel",
        comment: "@context: Button label to dismiss a dialog or action",
      }),
    ),
    labelAndUrlRequired: i18n._(
      msg({
        message: "Label and URL are required",
        comment: "@context: Error toast when nav link fields are empty",
      }),
    ),
    suggestedLinks: i18n._(
      msg({
        message: "Suggested links",
        comment: "@context: Section heading for suggested nav links",
      }),
    ),
    suggestedLinksDescription: i18n._(
      msg({
        message: "Add common destinations that already exist on your site.",
        comment: "@context: Description for suggested nav links",
      }),
    ),
    addSuggestedLink: i18n._(
      msg({
        message: "Add",
        comment: "@context: Button to add a suggested nav link",
      }),
    ),
    suggestedLinkAdded: i18n._(
      msg({
        message: "Link added to navigation.",
        comment: "@context: Toast after adding a suggested nav link",
      }),
    ),
    collection: i18n._(
      msg({
        message: "collection",
        comment: "@context: Nav item type badge for collection items",
      }),
    ),
    addCollection: i18n._(
      msg({
        message: "Add Collection",
        comment: "@context: Button for adding a collection to nav",
      }),
    ),
    addCollectionToNavigation: i18n._(
      msg({
        message: "Add collection to navigation",
        comment: "@context: Section heading for adding a collection to nav",
      }),
    ),
    addCollectionDescription: i18n._(
      msg({
        message:
          "Pin a collection to your navigation bar. An asterisk (*) appears next to collections updated in the last 48 hours.",
        comment: "@context: Description in collection picker section",
      }),
    ),
    allCollectionsAdded: i18n._(
      msg({
        message: "All collections are already in your navigation.",
        comment:
          "@context: Message when every collection is already added to nav",
      }),
    ),
    noCollections: i18n._(
      msg({
        message:
          "No collections yet. Create one first, then add it to your navigation.",
        comment:
          "@context: Empty state when no collections exist for nav picker",
      }),
    ),
    confirmDeleteCollection: i18n._(
      msg({
        message:
          "Remove this collection from navigation? The collection itself won't be deleted.",
        comment: "@context: Confirm dialog for removing a collection nav item",
      }),
    ),
  };

  const escapeJson = (data: unknown) =>
    JSON.stringify(data).replace(/</g, "\\u003c");

  return (
    <div class="max-w-3xl flex flex-col gap-8">
      <jant-nav-manager
        items={escapeJson(itemsData)}
        labels={escapeJson(labels)}
        system-nav-items={escapeJson(systemNavData)}
        collections={escapeJson(collectionsData)}
        suggested-links={escapeJson(suggestedLinksData)}
        site-name={siteName}
      >
        {/* SSR fallback: static preview until JS hydrates */}
        {(() => {
          const headerNavItems = navItems.filter(
            (item) => item.placement !== "more",
          );
          const moreNavItems = navItems.filter(
            (item) => item.placement === "more",
          );
          return (
            <div class="nav-preview">
              <div class="nav-preview-chrome">
                <div class="nav-preview-dots">
                  <span />
                  <span />
                  <span />
                </div>
                <span class="nav-preview-label">{previewLabel}</span>
              </div>
              <div class="nav-preview-content">
                <div class="site-header-top">
                  <a href={toPublicPath("/", sitePathPrefix)} class="site-logo">
                    {siteName}
                  </a>
                  <nav class="site-header-nav">
                    {headerNavItems.map((item, index) => (
                      <a
                        key={item.id}
                        href={toPublicHref(item.url, sitePathPrefix)}
                        class={`site-header-link${index === 0 ? " site-header-link-active" : ""}`}
                      >
                        {getNavItemDisplayLabel(item, i18n, sitePathPrefix)}
                      </a>
                    ))}
                    {moreNavItems.length > 0 && (
                      <div class="site-header-more">
                        <button
                          type="button"
                          class="site-header-more-btn"
                          aria-haspopup="menu"
                          aria-expanded="false"
                        >
                          {moreLabel}{" "}
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2.5"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            aria-hidden="true"
                          >
                            <path d="m6 9 6 6 6-6" />
                          </svg>
                        </button>
                        <div
                          class="site-header-more-popover"
                          aria-hidden="true"
                        >
                          {moreNavItems.map((item) => (
                            <span key={item.id} class="site-header-more-link">
                              {getNavItemDisplayLabel(
                                item,
                                i18n,
                                sitePathPrefix,
                              )}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </nav>
                </div>
              </div>
            </div>
          );
        })()}
      </jant-nav-manager>
    </div>
  );
}
