import { describe, expect, it, beforeEach } from "vitest";
import type { Context } from "hono";
import {
  createTestDatabase,
  DEFAULT_TEST_SITE_ID,
} from "../../__tests__/helpers/db.js";
import { createCollectionService } from "../../services/collection.js";
import { createMediaService } from "../../services/media.js";
import { createPathService } from "../../services/path.js";
import { createPostService } from "../../services/post.js";
import {
  assemblePostCardView,
  assemblePostPageDisplay,
} from "../post-display.js";
import type { Database } from "../../db/index.js";
import type { AppConfig, Bindings } from "../../types.js";
import type { AppVariables } from "../../types/app-context.js";

type Env = { Bindings: Bindings; Variables: AppVariables };

describe("post display assembly", () => {
  let db: Database;
  let postService: ReturnType<typeof createPostService>;
  let mediaService: ReturnType<typeof createMediaService>;
  let collectionService: ReturnType<typeof createCollectionService>;
  let pathService: ReturnType<typeof createPathService>;

  beforeEach(() => {
    const testDb = createTestDatabase();
    db = testDb.db as unknown as Database;
    pathService = createPathService(db, DEFAULT_TEST_SITE_ID);
    postService = createPostService(
      db,
      { slugIdLength: 5 },
      DEFAULT_TEST_SITE_ID,
      pathService,
    );
    mediaService = createMediaService(db, DEFAULT_TEST_SITE_ID);
    collectionService = createCollectionService(
      db,
      DEFAULT_TEST_SITE_ID,
      pathService,
    );
  });

  function createContext(): Context<Env> {
    return {
      var: {
        services: {
          posts: postService,
          media: mediaService,
          collections: collectionService,
          paths: pathService,
        },
        appConfig: {
          pageSize: 20,
        } as unknown as AppConfig,
      },
    } as unknown as Context<Env>;
  }

  it("assembles a single feed card with up-to-date last-in-thread state", async () => {
    const root = await postService.create({
      format: "note",
      bodyMarkdown: "Root",
    });
    await postService.create({
      format: "note",
      bodyMarkdown: "Reply",
      replyToId: root.id,
    });

    const view = await assemblePostCardView(createContext(), root.id, {
      isAuthenticated: true,
    });

    expect(view?.id).toBe(root.id);
    expect(view?.isLastInThread).toBe(false);
  });

  it("assembles permalink thread data for partial post view refreshes", async () => {
    const root = await postService.create({
      format: "note",
      bodyMarkdown: "Root",
    });
    const reply = await postService.create({
      format: "note",
      bodyMarkdown: "Reply",
      replyToId: root.id,
    });

    const display = await assemblePostPageDisplay(createContext(), root.id, {
      isAuthenticated: true,
    });

    expect(display?.postView.id).toBe(root.id);
    expect(display?.threadPostViews).toHaveLength(2);
    expect(display?.threadPostViews?.[1]?.id).toBe(reply.id);
  });

  it("includes draft thread members only for an authenticated preview", async () => {
    const root = await postService.create({
      format: "note",
      bodyMarkdown: "Draft root",
      status: "draft",
    });
    const reply = await postService.create({
      format: "note",
      bodyMarkdown: "Draft reply",
      status: "draft",
      replyToId: root.id,
    });

    const preview = await assemblePostPageDisplay(createContext(), root.id, {
      isAuthenticated: true,
      allowDraft: true,
      includeDraftThread: true,
    });
    const normal = await assemblePostPageDisplay(createContext(), root.id, {
      isAuthenticated: true,
    });

    expect(preview?.threadPostViews?.map((post) => post.id)).toEqual([
      root.id,
      reply.id,
    ]);
    expect(normal).toBeNull();
  });

  it("keeps draft replies out of a published permalink outside preview", async () => {
    const root = await postService.create({
      format: "note",
      bodyMarkdown: "Published root",
      status: "published",
    });
    const draftReply = await postService.create({
      format: "note",
      bodyMarkdown: "Draft reply",
      status: "draft",
      replyToId: root.id,
    });

    const publicDisplay = await assemblePostPageDisplay(
      createContext(),
      root.id,
      { isAuthenticated: true },
    );
    const previewDisplay = await assemblePostPageDisplay(
      createContext(),
      draftReply.id,
      {
        isAuthenticated: true,
        allowDraft: true,
        includeDraftThread: true,
      },
    );

    expect(publicDisplay?.threadPostViews).toBeUndefined();
    expect(previewDisplay?.threadPostViews?.map((post) => post.id)).toEqual([
      root.id,
      draftReply.id,
    ]);
  });
});
