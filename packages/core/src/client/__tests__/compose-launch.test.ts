// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from "vitest";
import {
  getReplyRefreshTarget,
  getReplyTargetArticle,
} from "../compose-launch.js";

function getArticle(): HTMLElement {
  const article = document.querySelector<HTMLElement>("article[data-post]");
  if (!article) throw new Error("expected article[data-post] in DOM");
  return article;
}

function getArticleByPostId(postId: string): HTMLElement {
  const article = document.querySelector<HTMLElement>(
    `article[data-post-id="${postId}"]`,
  );
  if (!article) throw new Error(`expected article for ${postId}`);
  return article;
}

describe("getReplyRefreshTarget", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("returns post-view when the article is inside a post detail view", () => {
    document.body.innerHTML = `
      <div data-page="post">
        <div data-post-view data-post-view-id="pst_root">
          <article data-post data-post-id="pst_reply" data-thread-root-id="pst_root">
          </article>
        </div>
      </div>
    `;

    expect(getReplyRefreshTarget(getArticle())).toEqual({
      kind: "post-view",
      id: "pst_root",
    });
  });

  it("returns timeline-item on the home feed, using the wrapper's thread root", () => {
    document.body.innerHTML = `
      <div data-page="home">
        <div data-timeline-item data-timeline-item-id="pst_root" data-thread-root-id="pst_root">
          <div data-timeline-item-content>
            <article data-post data-post-id="pst_root" data-thread-root-id="pst_root">
            </article>
          </div>
        </div>
      </div>
    `;

    expect(getReplyRefreshTarget(getArticle())).toEqual({
      kind: "timeline-item",
      id: "pst_root",
    });
  });

  it("returns timeline-item on the archive list view too", () => {
    // Archive list view reuses the TimelineFeedItem wrapper (see
    // ArchivePage.tsx list-view branch), so it should refresh like the
    // home feed rather than falling back to post-card.
    document.body.innerHTML = `
      <div data-page="archive">
        <div data-feed>
          <div class="archive-list-items">
            <div data-timeline-item data-timeline-item-id="pst_root" data-thread-root-id="pst_root">
              <div data-timeline-item-content>
                <article data-post data-post-id="pst_root" data-thread-root-id="pst_root">
                </article>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    expect(getReplyRefreshTarget(getArticle())).toEqual({
      kind: "timeline-item",
      id: "pst_root",
    });
  });

  it("prefers the wrapper's thread root id over the article's own", () => {
    // Inside a thread preview, a non-root article may sit under a wrapper
    // whose data-thread-root-id is the root of the whole thread — that's
    // the id the timeline-item partial needs.
    document.body.innerHTML = `
      <div data-page="home">
        <div data-timeline-item data-timeline-item-id="pst_root" data-thread-root-id="pst_root">
          <div data-timeline-item-content>
            <article data-post data-post-id="pst_reply" data-thread-root-id="pst_other">
            </article>
          </div>
        </div>
      </div>
    `;

    expect(getReplyRefreshTarget(getArticle())).toEqual({
      kind: "timeline-item",
      id: "pst_root",
    });
  });

  it("falls back to post-card when there's no timeline-item wrapper", () => {
    document.body.innerHTML = `
      <div data-page="collection">
        <article data-post data-post-id="pst_single">
        </article>
      </div>
    `;

    expect(getReplyRefreshTarget(getArticle())).toEqual({
      kind: "post-card",
      id: "pst_single",
    });
  });

  it("returns null when the article has no id at all", () => {
    document.body.innerHTML = `
      <div data-page="custom">
        <article data-post></article>
      </div>
    `;

    expect(getReplyRefreshTarget(getArticle())).toBeNull();
  });
});

describe("getReplyTargetArticle", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("targets the latest thread detail post when the current page is the root", () => {
    document.body.innerHTML = `
      <div data-post-view data-post-view-id="pst_root">
        <div class="thread-group thread-group-detail" data-page="post">
          <div class="thread-item thread-detail-item" data-post-current>
            <article data-post data-post-id="pst_root" data-thread-root-id="pst_root"></article>
          </div>
          <div class="thread-item thread-detail-item">
            <article data-post data-post-id="pst_reply_1" data-thread-root-id="pst_root"></article>
          </div>
          <div class="thread-item thread-detail-item">
            <article data-post data-post-id="pst_reply_2" data-thread-root-id="pst_root"></article>
          </div>
        </div>
      </div>
    `;

    expect(getReplyTargetArticle(document)?.dataset.postId).toBe("pst_reply_2");
  });

  it("keeps using the current article outside thread detail pages", () => {
    document.body.innerHTML = `
      <div data-post-view data-post-view-id="pst_single">
        <article data-post data-post-id="pst_single"></article>
      </div>
    `;

    expect(getReplyTargetArticle(document)).toBe(
      getArticleByPostId("pst_single"),
    );
  });
});
