/**
 * Replace the live site header with a server-rendered navigation fragment.
 *
 * @param headerHtml - Trusted fragment returned by Jant's navigation API
 * @returns Nothing
 * @example
 * applySiteHeaderHtml(response.headerHtml);
 */

import { destroySiteHeaderNav, initSiteHeaderNav } from "./site-header-nav.js";

export function applySiteHeaderHtml(headerHtml: string | undefined): void {
  if (!headerHtml) return;

  const template = document.createElement("template");
  template.innerHTML = headerHtml.trim();

  const selectors = [
    '[data-site-header-fragment="header"]',
    '[data-site-header-fragment="drawer-backdrop"]',
    '[data-site-header-fragment="drawer"]',
  ];
  let replaced = false;

  destroySiteHeaderNav(document);
  for (const selector of selectors) {
    const current = document.querySelector<HTMLElement>(selector);
    const next = template.content.querySelector<HTMLElement>(selector);
    if (!current || !next) continue;

    current.replaceWith(next);
    replaced = true;
  }

  if (replaced) {
    initSiteHeaderNav(document);
  }
}
