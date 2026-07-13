/**
 * Timeline Data Assembly
 *
 * Shared helper for assembling timeline items with media and thread previews.
 * Used by page rendering with page-based pagination.
 */

import type { Context } from "hono";
import type {
  Bindings,
  CollectionSortOrder,
  Post,
  TimelineItemView,
} from "../types.js";
import type { AppVariables } from "../types/app-context.js";
import { buildMediaMap } from "./media-helpers.js";
import { createMediaContext, toPostView } from "./view.js";

type Env = { Bindings: Bindings; Variables: AppVariables };

/**
 * Result from assembling a timeline page.
 */
export interface TimelineResult {
  items: TimelineItemView[];
  currentPage: number;
  totalPages: number;
  totalCount: number;
}

type CuratedThreadSelectionMap = Map<string, Set<string>>;

async function buildTimelineItems(
  c: Context<Env>,
  posts: Post[],
): Promise<TimelineItemView[]> {
  if (posts.length === 0) {
    return [];
  }

  // Batch load media, collections, and latest-reply contexts in parallel
  const postIds = posts.map((p) => p.id);
  const mediaCtx = createMediaContext(c.var.appConfig);
  const [rawMediaMap, collectionsMap, threadContexts, aliasesMap] =
    await Promise.all([
      c.var.services.media.getByPostIds(postIds),
      c.var.services.collections.getCollectionsByPostIds(postIds),
      c.var.services.posts.getThreadTimelineContext(postIds),
      c.var.services.paths.getPostAliases(postIds),
    ]);
  const mediaMap = buildMediaMap(
    rawMediaMap,
    mediaCtx.r2PublicUrl,
    mediaCtx.imageTransformUrl,
    mediaCtx.s3PublicUrl,
    mediaCtx.localPublicUrl,
    mediaCtx.sitePathPrefix,
  );

  // Batch load media for the bounded leading/trailing thread context.
  const contextPostIds = new Set<string>();
  for (const ctx of threadContexts.values()) {
    contextPostIds.add(ctx.latestReply.id);
    for (const reply of [...ctx.leadingReplies, ...ctx.trailingReplies]) {
      contextPostIds.add(reply.id);
    }
  }
  const [contextMediaMap, contextCollectionsMap, contextAliasesMap] =
    contextPostIds.size > 0
      ? await Promise.all([
          c.var.services.media
            .getByPostIds([...contextPostIds])
            .then((raw) =>
              buildMediaMap(
                raw,
                mediaCtx.r2PublicUrl,
                mediaCtx.imageTransformUrl,
                mediaCtx.s3PublicUrl,
                mediaCtx.localPublicUrl,
                mediaCtx.sitePathPrefix,
              ),
            ),
          c.var.services.collections.getCollectionsByPostIds([
            ...contextPostIds,
          ]),
          c.var.services.paths.getPostAliases([...contextPostIds]),
        ])
      : [new Map(), new Map(), new Map<string, string[]>()];

  const firstAlias = (id: string) => aliasesMap.get(id)?.[0];
  const firstContextAlias = (id: string) => contextAliasesMap.get(id)?.[0];

  // Assemble timeline items with View Models
  return posts.map((post) => {
    const postView = toPostView(
      {
        ...post,
        mediaAttachments: mediaMap.get(post.id) ?? [],
      },
      mediaCtx,
      collectionsMap.get(post.id),
      undefined,
      firstAlias(post.id),
    );

    const threadCtx = threadContexts.get(post.id);

    if (threadCtx) {
      // Thread root is not the last post — hide reply button on it
      postView.isLastInThread = false;

      const toContextPostView = (reply: Post) =>
        toPostView(
          {
            ...reply,
            mediaAttachments: contextMediaMap.get(reply.id) ?? [],
          },
          mediaCtx,
          contextCollectionsMap.get(reply.id),
          false,
          firstContextAlias(reply.id),
        );

      const leadingReplyViews = threadCtx.leadingReplies.map(toContextPostView);
      const trailingReplyViews =
        threadCtx.trailingReplies.map(toContextPostView);

      const latestReplyView = toPostView(
        {
          ...threadCtx.latestReply,
          mediaAttachments: contextMediaMap.get(threadCtx.latestReply.id) ?? [],
        },
        mediaCtx,
        contextCollectionsMap.get(threadCtx.latestReply.id),
        true, // latestReply is the last post in the thread
        firstContextAlias(threadCtx.latestReply.id),
      );

      return {
        post: postView,
        threadPreview: {
          leadingReplies: leadingReplyViews,
          trailingReplies: trailingReplyViews,
          latestReply: latestReplyView,
          totalReplyCount: threadCtx.totalReplyCount,
        },
      };
    }

    return { post: postView };
  });
}

/**
 * Assembles timeline items for a known ordered list of thread-root posts.
 *
 * Reuses the same media and thread-preview path as the main latest timeline so
 * alternate grouped views can stay visually and behaviorally in sync.
 *
 * @param c - Hono context (provides services + appConfig)
 * @param posts - Ordered published thread-root posts to render
 * @returns Timeline items matching the latest-feed presentation
 */
export async function assembleTimelineItems(
  c: Context<Env>,
  posts: Post[],
): Promise<TimelineItemView[]> {
  return buildTimelineItems(c, posts);
}

async function buildCuratedThreadItems(
  c: Context<Env>,
  rootIds: string[],
  threadsByRootId: Map<string, Post[]>,
  selectedPostIdsByThread: CuratedThreadSelectionMap,
  collectionPinnedPostIds?: Set<string>,
): Promise<TimelineItemView[]> {
  const orderedThreads = rootIds
    .map((rootId) => threadsByRootId.get(rootId) ?? [])
    .filter((thread) => thread.length > 0);

  if (orderedThreads.length === 0) {
    return [];
  }

  const mediaCtx = createMediaContext(c.var.appConfig);
  const postIds = orderedThreads.flatMap((thread) =>
    thread.map((post) => post.id),
  );
  const [rawMediaMap, collectionsMap, curatedAliasesMap] = await Promise.all([
    c.var.services.media.getByPostIds(postIds),
    c.var.services.collections.getCollectionsByPostIds(postIds),
    c.var.services.paths.getPostAliases(postIds),
  ]);
  const mediaMap = buildMediaMap(
    rawMediaMap,
    mediaCtx.r2PublicUrl,
    mediaCtx.imageTransformUrl,
    mediaCtx.s3PublicUrl,
    mediaCtx.localPublicUrl,
    mediaCtx.sitePathPrefix,
  );

  return orderedThreads.reduce<TimelineItemView[]>((items, thread) => {
    const root = thread[0];
    if (!root) {
      return items;
    }

    const lastPostId = thread[thread.length - 1]?.id;
    const postViews = thread.map((post) =>
      toPostView(
        {
          ...post,
          mediaAttachments: mediaMap.get(post.id) ?? [],
        },
        mediaCtx,
        collectionsMap.get(post.id),
        post.id === lastPostId,
        curatedAliasesMap.get(post.id)?.[0],
        collectionPinnedPostIds?.has(post.id),
      ),
    );
    const rootView = postViews[0];
    const selectedIds = selectedPostIdsByThread.get(root.id);

    if (!rootView || !selectedIds || selectedIds.size === 0) {
      return items;
    }

    const selectedIndices = postViews.reduce<number[]>(
      (indices, post, index) => {
        if (selectedIds.has(post.id)) {
          indices.push(index);
        }
        return indices;
      },
      [],
    );

    if (selectedIndices.length === 0) {
      return items;
    }

    const selectedIndexSet = new Set(selectedIndices);
    const visibleIndices = [
      ...new Set([0, postViews.length - 1, ...selectedIndices]),
    ].sort((left, right) => left - right);
    const segments = visibleIndices.reduce<
      NonNullable<TimelineItemView["curatedThread"]>["segments"]
    >((items, index, segmentIndex) => {
      const postView = postViews[index];
      if (!postView) {
        return items;
      }

      const previousIndex =
        segmentIndex === 0 ? undefined : visibleIndices[segmentIndex - 1];

      items.push({
        post: postView,
        hiddenBeforeCount:
          previousIndex === undefined
            ? index === 0
              ? 0
              : index - 1
            : index - previousIndex - 1,
        highlighted: selectedIndexSet.has(index),
      });

      return items;
    }, []);

    if (segments.length === 0) {
      return items;
    }

    const isRootOnlySelection =
      segments.length === 1 && segments[0]?.post.id === rootView.id;

    if (isRootOnlySelection) {
      items.push({ post: rootView });
      return items;
    }

    items.push({
      post: rootView,
      curatedThread: {
        rootPost: rootView,
        segments,
      },
    });

    return items;
  }, []);
}

/**
 * Assembles a page of timeline items with media attachments and thread previews.
 *
 * Fetches posts using offset-based pagination, batch-loads media, identifies
 * threads, and returns render-ready `TimelineItemView[]` with page info.
 *
 * @param c - Hono context (provides services + appConfig)
 * @param options - Optional page number (1-indexed, defaults to 1)
 * @returns Assembled timeline items with pagination info
 *
 * @example
 * ```ts
 * const { items, currentPage, totalPages, totalCount } = await assembleTimeline(c);
 * const { items, currentPage, totalPages, totalCount } = await assembleTimeline(c, { page: 2 });
 * ```
 */
export async function assembleTimeline(
  c: Context<Env>,
  options?: { page?: number; isAuthenticated?: boolean },
): Promise<TimelineResult> {
  const pageSize = c.var.appConfig.pageSize;

  const page = Math.max(1, options?.page ?? 1);
  const offset = (page - 1) * pageSize;

  const excludePrivate = !(options?.isAuthenticated ?? false);

  // Count + list are independent — run in parallel
  const [totalCount, posts] = await Promise.all([
    c.var.services.posts.count({
      status: "published",
      excludeReplies: true,
      excludeLatestHidden: true,
      excludePrivate,
    }),
    c.var.services.posts.list({
      status: "published",
      excludeReplies: true,
      excludeLatestHidden: true,
      excludePrivate,
      limit: pageSize,
      offset,
    }),
  ]);
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  if (posts.length === 0) {
    return { items: [], currentPage: page, totalPages, totalCount };
  }

  const items = await buildTimelineItems(c, posts);

  return { items, currentPage: page, totalPages, totalCount };
}

/**
 * Assembles a single timeline item for in-place timeline refreshes.
 *
 * Reuses the same thread-preview assembly path as `assembleTimeline()` so
 * page renders and partial updates stay in sync.
 *
 * @param c - Hono context (provides services + appConfig)
 * @param threadRootId - TypeID of the thread root displayed in the timeline
 * @param options - Auth state used to apply timeline visibility rules
 * @returns A render-ready timeline item, or null when it should not be shown
 */
export async function assembleTimelineItem(
  c: Context<Env>,
  threadRootId: string,
  options?: { isAuthenticated?: boolean },
): Promise<TimelineItemView | null> {
  const excludePrivate = !(options?.isAuthenticated ?? false);
  const post = await c.var.services.posts.getById(threadRootId);

  if (
    !post ||
    post.replyToId !== null ||
    post.status !== "published" ||
    post.visibility === "latest_hidden" ||
    (excludePrivate && post.visibility === "private")
  ) {
    return null;
  }

  const items = await buildTimelineItems(c, [post]);
  return items[0] ?? null;
}

/**
 * Assembles a paginated featured timeline grouped by thread root.
 *
 * @param c - Hono context (provides services + appConfig)
 * @param options - Optional page number and auth state
 * @returns Featured timeline items with pagination info
 */
export async function assembleFeaturedTimeline(
  c: Context<Env>,
  options?: { page?: number; isAuthenticated?: boolean },
): Promise<TimelineResult> {
  const pageSize = c.var.appConfig.pageSize;
  const page = Math.max(1, options?.page ?? 1);
  const offset = (page - 1) * pageSize;
  const excludePrivate = !(options?.isAuthenticated ?? false);

  const [totalCount, rootIds] = await Promise.all([
    c.var.services.posts.countFeaturedThreadRoots({
      status: "published",
      excludePrivate,
    }),
    c.var.services.posts.listFeaturedThreadRootIds({
      status: "published",
      excludePrivate,
      limit: pageSize,
      offset,
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  if (rootIds.length === 0) {
    return { items: [], currentPage: page, totalPages, totalCount };
  }

  const threadsByRootId =
    await c.var.services.posts.getPublishedThreads(rootIds);
  const selectedPostIdsByThread: CuratedThreadSelectionMap = new Map();

  for (const [threadId, thread] of threadsByRootId) {
    const selectedIds = thread
      .filter((post) => post.featuredAt !== null)
      .map((post) => post.id);

    if (selectedIds.length > 0) {
      selectedPostIdsByThread.set(threadId, new Set(selectedIds));
    }
  }

  const items = await buildCuratedThreadItems(
    c,
    rootIds,
    threadsByRootId,
    selectedPostIdsByThread,
  );

  return { items, currentPage: page, totalPages, totalCount };
}

/**
 * Assembles a paginated collection timeline grouped by thread root.
 *
 * Threads are ordered by collection membership time (newest/oldest) or by the
 * rated posts collected into the thread. Within each thread, collected posts are
 * expanded and intervening non-collected posts collapse into hidden-count gaps.
 *
 * @param c - Hono context (provides services + appConfig)
 * @param options - Collection IDs, optional page number, auth state, and sort
 * @returns Collection timeline items with pagination info
 */
export async function assembleCollectionTimeline(
  c: Context<Env>,
  options: {
    collectionIds: string[];
    page?: number;
    isAuthenticated?: boolean;
    sortOrder?: CollectionSortOrder;
  },
): Promise<TimelineResult> {
  const pageSize = c.var.appConfig.pageSize;
  const page = Math.max(1, options.page ?? 1);
  const offset = (page - 1) * pageSize;
  const excludePrivate = !(options.isAuthenticated ?? false);

  const [totalCount, rootIds] = await Promise.all([
    c.var.services.posts.countCollectionThreadRootsForCollections(
      options.collectionIds,
      {
        status: "published",
        excludePrivate,
      },
    ),
    c.var.services.posts.listCollectionThreadRootIdsForCollections(
      options.collectionIds,
      {
        status: "published",
        excludePrivate,
        sortOrder: options.sortOrder,
        limit: pageSize,
        offset,
      },
    ),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  if (rootIds.length === 0) {
    return { items: [], currentPage: page, totalPages, totalCount };
  }

  const [threadsByRootId, collectedPostIdsByThread, pinnedPostIds] =
    await Promise.all([
      c.var.services.posts.getPublishedThreads(rootIds),
      c.var.services.posts.getCollectionPostIdsByThreadForCollections(
        options.collectionIds,
        rootIds,
      ),
      c.var.services.collections.getPinnedPostIds(options.collectionIds),
    ]);
  const selectedPostIdsByThread: CuratedThreadSelectionMap = new Map(
    [...collectedPostIdsByThread.entries()].map(([threadId, postIds]) => [
      threadId,
      new Set(postIds),
    ]),
  );
  const items = await buildCuratedThreadItems(
    c,
    rootIds,
    threadsByRootId,
    selectedPostIdsByThread,
    pinnedPostIds,
  );

  return { items, currentPage: page, totalPages, totalCount };
}
