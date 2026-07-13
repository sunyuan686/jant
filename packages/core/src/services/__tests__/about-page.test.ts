import { describe, expect, it, beforeEach } from "vitest";
import {
  createTestDatabase,
  DEFAULT_TEST_SITE_ID,
} from "../../__tests__/helpers/db.js";
import type { Database } from "../../db/index.js";
import { createAboutPageService } from "../about-page.js";
import { createCollectionService } from "../collection.js";
import { createPathService } from "../path.js";
import { createPostService } from "../post.js";

const ABOUT_BODY = JSON.stringify({
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [{ type: "text", text: "About this site." }],
    },
  ],
});

describe("AboutPageService", () => {
  let aboutPage: ReturnType<typeof createAboutPageService>;
  let posts: ReturnType<typeof createPostService>;
  let collections: ReturnType<typeof createCollectionService>;

  beforeEach(() => {
    const testDb = createTestDatabase();
    const db = testDb.db as unknown as Database;
    const paths = createPathService(db, DEFAULT_TEST_SITE_ID);
    posts = createPostService(
      db,
      { slugIdLength: 5 },
      DEFAULT_TEST_SITE_ID,
      paths,
    );
    collections = createCollectionService(db, DEFAULT_TEST_SITE_ID, paths);
    aboutPage = createAboutPageService({
      paths,
      posts,
      collections,
    });
  });

  it("reports a missing About page when /about is unused", async () => {
    await expect(aboutPage.getStatus()).resolves.toMatchObject({
      state: "missing",
      path: "/about",
    });
  });

  it("recognizes a post at /about as the About page", async () => {
    const post = await posts.create({
      format: "note",
      title: "About",
      slug: "about",
      visibility: "latest_hidden",
      body: ABOUT_BODY,
    });

    await expect(aboutPage.getStatus()).resolves.toMatchObject({
      state: "ready",
      post: {
        id: post.id,
        title: "About",
        visibility: "latest_hidden",
      },
    });
  });

  it("creates a hidden About page when /about is unused", async () => {
    const post = await aboutPage.ensurePage();
    expect(post).toMatchObject({
      title: "About",
      status: "published",
      visibility: "latest_hidden",
    });

    await expect(aboutPage.getStatus()).resolves.toMatchObject({
      state: "ready",
      post: {
        id: post.id,
        title: "About",
        status: "published",
        visibility: "latest_hidden",
      },
    });
  });

  it("reports a conflict when a collection owns /about", async () => {
    const collection = await collections.create({
      title: "About",
      slug: "about",
    });

    await expect(aboutPage.getStatus()).resolves.toMatchObject({
      state: "conflict",
      conflict: {
        targetType: "collection",
        id: collection.id,
        title: "About",
      },
    });
  });

  it("rejects About creation when another item owns /about", async () => {
    await collections.create({
      title: "About",
      slug: "about",
    });

    await expect(aboutPage.ensurePage()).rejects.toThrow(
      "/about is already used.",
    );
  });
});
