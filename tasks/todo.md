# Remove Broken Inline Image Summary

## Problem

The compose editor's top-level "images couldn't load" warning is visually
heavier than the problem warrants. Broken inline images already render their own
localized placeholder with delete, replace, and open actions at the image
position.

## Plan

- [x] Remove the compose/fullscreen top summary and jump-to-image behavior.
- [x] Remove now-unused summary copy, CSS, and tests while keeping the local
      broken-image placeholder.
- [x] Run focused verification and document the result.

## Review

- Removed the top-level broken inline image summary from compose and fullscreen
  editors, including the jump-to-image state, refresh timers, CSS, and tests.
- Kept the image-node-local missing-image UI and labels, so each broken image
  still shows its own "Image unavailable" block with delete, replace, and open
  actions.
- Removed unused summary/jump label fields and Lingui message descriptors.
- Verification:
  - `mise run test -- src/client/components/__tests__/jant-compose-editor.test.ts src/client/components/__tests__/jant-compose-fullscreen.test.ts src/client/tiptap/__tests__/block-insertion.test.ts`
    passed: 3 files / 51 tests.
  - `mise run check-tests` passed: 220 files / 2601 tests.
  - `mise run check-lint` passed.
  - `mise x -- npx prettier --check ...` passed for the touched files.
  - `git diff --check` passed.

# Compose Markdown Image Input Rule

## Problem

Compose supports Markdown image parsing through `bodyMarkdown` and plain-text
paste, but typing `![alt](url)` in the rich editor does not convert it to an
inline image. The existing Markdown link input rule can also consume the inner
`[alt](url)` before an image-specific rule exists.

## Plan

- [x] Add a TipTap image input rule that runs before Markdown link input rules.
- [x] Wire the rule into the standard compose editor extension set.
- [x] Add focused regression tests for typed Markdown image conversion and link
      rule precedence.
- [x] Run proportional verification and document the result.

## Review

- Added `ImageInputRules` for compose TipTap editors. Typing
  `![alt](url)` now inserts the existing block image node and moves the cursor
  into the following paragraph, matching the existing upload/slash image flow.
- The image rule runs before Markdown link input rules so the inner
  `[alt](url)` does not get converted to a link first. It supports empty alt
  text and optional quoted titles.
- Added focused regression coverage for empty-alt images, alt/title parsing,
  link-rule precedence, and unsafe URL fallback.
- Verification:
  - `mise run test -- src/client/tiptap/__tests__/image-input-rules.test.ts`
    passed after a regex correction: 1 file / 4 tests.
  - `mise run check-tests` passed: 220 files / 2603 tests.
  - `mise run check-lint` passed.
  - `mise x -- npx prettier --check ...` passed for the touched files.
  - Full `mise run check-format` remains blocked by existing repository
    formatting/parser issues, primarily Hugo template files under
    `packages/core/src/services/export-theme/layouts/` and
    `sites/demo-source/canonical/site-export/themes/jant/layouts/`, plus a few
    pre-existing formatting warnings outside this change.

# Larger Missing Attachment Preview

## Problem

Saved image attachments whose preview URL no longer loads can collapse into a
small broken-looking thumbnail with a tiny remove control. The fallback state
should be large enough to recognize and remove confidently.

## Plan

- [x] Inspect current attachment fallback and remove-button sizing.
- [x] Increase only the failed-preview attachment card sizing, preserving compact
      reply attachments.
- [x] Run focused formatting/verification and document the result.

## Review

- Failed image attachment previews now get a stable medium card: about 112x84
  in multi-attachment strips and up to 160x120 when it is the only attachment.
- The fallback now includes an explicit "Image unavailable" label instead of
  relying on a neutral picture icon.
- The remove button grows from 22px to 24px only on failed-preview attachment
  cards, making the delete affordance a little easier to hit without dominating
  the thumbnail.
- Reply composer attachments keep their compact 96x72 preview size and 20px
  remove button.
- Verification:
  - `mise run test -- src/client/components/__tests__/jant-compose-editor.test.ts -t "keeps a removable fallback card when a single saved image preview fails"` passed.
  - `mise x -- npx prettier --write packages/core/src/styles/ui.css tasks/todo.md` completed with no changes needed.

# Broken Inline Image Editing

## Problem

Editing an article with missing inline images makes it hard to locate the
broken image node and remove or replace it. The editor should surface broken
images as first-class, keyboard-accessible blocks instead of leaving authors to
hunt for browser broken-image icons.

## Plan

- [x] Trace the existing TipTap image node view and compose editor wiring.
- [x] Add a missing-image state with in-place actions for locating and deleting
      the broken image node.
- [x] Add an editor-level broken-image summary with "jump to next" behavior.
- [x] Add focused regression coverage for broken-image detection and deletion.
- [x] Run proportional verification and document the result.

## Review

- Added a missing-image state to the TipTap image NodeView. Failed inline
  images now render as an in-place block with the original source hint and
  actions to delete, replace, or open the original URL. The focused block also
  handles Delete/Backspace.
- Added compose and fullscreen editor summaries for broken inline images, with a
  jump action that scrolls to and selects the next broken image node.
- Routed new image-node labels through compose labels and Lingui catalogs,
  including Simplified and Traditional Chinese translations.
- Added focused regression coverage for the image NodeView placeholder/delete
  behavior, compose broken-image summary/jump, and fullscreen summary.
- Verification:
  - `mise run check-tests` passed: 219 files / 2599 tests.
  - `mise run test -- src/client/tiptap/__tests__/block-insertion.test.ts src/client/components/__tests__/jant-compose-editor.test.ts src/client/components/__tests__/jant-compose-fullscreen.test.ts` passed.
  - `mise run i18n-build` passed and updated the catalogs.
  - `mise x -- npx prettier --check ...` passed for the touched source files.
  - Full `mise run check-format` is blocked by existing Hugo template parse
    errors under `packages/core/src/services/export-theme/layouts/` and
    `sites/demo-source/canonical/site-export/themes/jant/layouts/`.
  - Local `mise run i18n-check` reports the expected uncommitted catalog diff
    after adding new messages; the generated locale output contains the new
    labels.
- Local preview:
  - `dev-debug` started after retrying with proxy environment variables unset.
  - App URL: `http://localhost:19020/`
  - Auto-login URL:
    `http://localhost:19020/__dev/login?token=jnt_dev&redirect=/settings`

# Hide Same-Site Absolute About Navigation Suggestions

## Problem

Settings → Navigation still suggests `/about` when an existing custom nav link
points to the same page with the site's absolute URL, such as
`https://preview-test.owenyoung.com/about`.

## Plan

- [x] Trace how suggested navigation links detect existing items.
- [x] Normalize same-site absolute nav URLs before comparing suggestion paths.
- [x] Add regression coverage for an absolute `/about` link.
- [x] Run repository verification.

## Review

- Updated navigation suggestion detection so same-site absolute URLs are
  normalized to internal paths before comparing against `/about` and `/now`.
- Passed the current site origin/path prefix from the settings navigation route
  into the service.
- Added regression coverage for `https://preview-test.owenyoung.com/about` and
  for same-site absolute URLs under a public path prefix.
- Verification: `mise run check-tests` passed.

# Recover Deleted Inline Media

## Problem

The finalized-media cleanup bug deleted media rows/objects that were still
referenced from post body JSON. We need to quantify which affected inline media
can still be recovered from trash/storage and define a safe restoration path
without mutating production data during the investigation.

## Plan

- [x] Re-read the storage trash implementation and deletion timeline.
- [x] Query production read-only for missing first-party inline media refs.
- [x] Cross-check missing refs against `storage_purge` trash records and any
      recoverable storage objects.
- [x] Summarize affected sites/posts/media by recovery status.
- [x] Propose a safe restore/backfill procedure and operational safeguards.

## Review

Read-only production findings:

- Current post bodies contain 151 distinct first-party `media/<site>/files/<id>`
  refs across 65 posts and 10 sites.
- 24 refs still have live `media` rows.
- 127 refs are broken because their `media` row is missing and the original
  object key is absent from storage.
- 41 of those 127 broken refs have unexpired `storage_purge` trash records, and
  all 41 corresponding trash objects exist in storage.
- The 41 recoverable refs cover 41 media IDs and 26 posts across 4 sites. None
  of the recoverable media IDs is referenced by multiple posts.
- The earliest trash purge deadline among recoverable objects is
  `2026-07-18 21:12:15 UTC`; the latest is `2026-07-28 08:55:34 UTC`.

Recovery status by site:

- `luxi.blog`: 30 broken refs / 17 posts / 30 media. 27 refs / 14 posts / 27
  media are recoverable from trash; 3 refs / 3 posts / 3 media are not
  recoverable from current storage/trash.
- `michaelwang.nz`: 7 broken refs / 7 posts / 7 media, all recoverable.
- `aydengen.com`: 5 broken refs / 4 posts / 5 media, all recoverable.
- `mlyz.me`: 2 broken refs / 1 post / 2 media, all recoverable.
- `www.owenyoung.com`: 83 broken refs / 29 posts / 82 media, none recoverable
  from current storage/trash. 10 of these have `upload_session` rows, but the
  original objects are gone and there are no `storage_purge` rows.

Backup check:

- Production has hourly database backups (`postgres`, `sqlite`, `redis`) and a
  backup service that uploads those backups to S3 with 30-day retention.
- No local media/object backup directory was found under `/data/backups`.
- Database backups can help reconstruct deleted `media` row metadata, but they
  cannot recover missing image bytes unless the object itself still exists in
  trash/storage or another external cache/source.

Recommended restore procedure:

- Deploy the cleanup hotfix before restoring rows; otherwise restored
  `post_id IS NULL` inline-media rows could be deleted again.
- Build a one-off idempotent restore job from a generated manifest of the 41
  recoverable rows:
  - Verify the `media` row is still missing and the original key is still
    missing.
  - Verify the trash key still exists.
  - Copy `storage_purge.storage_key` back to `storage_purge.original_key`,
    preserving object metadata.
  - Recreate a `media` row with the original media ID, site ID, provider,
    original storage key, `media_kind = 'image'`, and `post_id = NULL`.
  - Prefer exact row metadata from a pre-delete DB backup; fall back to
    `upload_session` and object `head-object` metadata when exact rows are not
    needed.
  - Leave the `storage_purge` row in place or delete it only after verification;
    leaving it only purges the trash copy later, not the restored original key.
  - Verify restored public URLs return 200.
- For unrecoverable refs, generate per-site/post reports and either notify
  users to re-upload the missing images or add a later product repair flow for
  replacing/removing broken image nodes.

## Follow-up: Restore Script

Problem:

The cleanup hotfix has been prepared, and the remaining recoverable production
data should be restored via an audited, repeatable operation rather than manual
SQL edits.

Plan:

- [x] Add a production-host restore script with dry-run and apply modes.
- [x] Make the script idempotent: skip existing media rows, verify trash
      objects, copy only missing original keys, and insert rows with conflict
      protection.
- [x] Run dry-run against production.
- [x] Document the exact apply procedure and remaining risks.

Result:

- Added `scripts/ops/restore-inline-media-from-trash.sh`.
- The script defaults to `--dry-run`; `--apply` is required for writes.
- It reads production `/srv/jant/.env`, queries Postgres for missing inline refs
  with unexpired `storage_purge` rows, validates trash objects with
  `aws s3api head-object`, and checks whether the original object key already
  exists.
- In `--apply`, it copies each trash object back to its original key, then
  inserts missing `media` rows inside a DB transaction using conflict
  protection.
- It does not delete `storage_purge` rows; the later purge only removes trash
  copies, not restored original keys.

Production dry-run:

- Command:
  `ssh prod-deploy 'bash -s -- --dry-run' < scripts/ops/restore-inline-media-from-trash.sh`
- Recoverable DB candidates: 41.
- Ready: 41.
- Original already existed: 0.
- Missing trash: 0.
- Copy failed: 0.
- Skipped: 0.
- Ready by site: `aydengen.com` 5, `luxi.blog` 27, `michaelwang.nz` 7,
  `mlyz.me` 2.

Apply command:

```sh
ssh prod-deploy 'bash -s -- --apply' < scripts/ops/restore-inline-media-from-trash.sh
```

Remaining risks:

- Run only after the cleanup hotfix is deployed; otherwise restored unattached
  inline media could be deleted again by the old cleanup job.
- The script restores object bytes and minimal `media` rows. Exact historical
  fields such as dimensions/blurhash/alt are not reconstructed unless they are
  added from DB backups later. Public URLs should recover because post bodies
  already point at the original storage keys.
- The 86 unrecoverable refs remain broken because neither original objects nor
  trash objects exist in current storage.

# Investigate Production Media Cleanup

## Problem

线上文章 `https://www.owenyoung.com/blog/links/2024-12-09-4` 里的图片
`med_01kn1418sefzt8gyvxjk40x5zg.webp` 已经 404。需要确认这是早期删除行为的
历史 bug，还是当前自动清理仍会误删正文内图片，并明确有标题文章正文图片是否会被
自动删除。

## Plan

- [x] Trace current upload/media cleanup implementation and its scheduled entry
      points.
- [x] Verify how the cleaner distinguishes attached media, orphan media, site
      assets, and trash purge records.
- [x] Query production read-only data for the affected media key, post, upload
      session, and purge history.
- [x] Check whether titled posts with inline body images carry a durable media
      attachment marker.
- [x] Document findings, risk, and any recommended follow-up.

## Review

Read-only production findings:

- Target media `med_01kn1418sefzt8gyvxjk40x5zg` no longer has a `media` row and
  the public media URL returns 404.
- Its `upload_session` row still exists and shows a completed upload at
  `2026-03-31 04:57:09 UTC`, with final key
  `media/sit_01kmyfab3cfztrzn5qs9b80083/files/med_01kn1418sefzt8gyvxjk40x5zg.webp`.
- The target post `pst_01kmygfh61esj9nxdc64y9xzm9` still contains that URL in
  TipTap body JSON, but there are no `media` rows attached to the post.
- There is no matching `storage_purge` row for the target key. Since orphan
  media cleanup was introduced on 2026-06-16 and the 30-day trash queue was
  introduced on 2026-06-19, this specific deletion most likely happened during
  the first orphan cleanup window before trash recovery existed.

Current strategy:

- Hosted cron currently runs media cleanup roughly once per minute across 79
  managed sites.
- Core cleanup deletes finalized media rows with `post_id IS NULL` and
  `created_at < now() - 7 days`, excluding site assets by storage-key pattern.
- Current deletion goes through `media.deleteByIds`, which removes the DB row,
  frees the original public object key immediately, and records a 30-day
  `storage_purge` trash entry when the active storage driver supports copy.
- Completed `upload_session` rows are not enough to protect media from orphan
  cleanup.

Current risk:

- Titled compose posts can paste/upload images inline into the body. That path
  stores the image URL in the TipTap document but does not include the media ID
  in post attachments, so the `media.post_id` marker remains null.
- A production scan of `owenyoung.com` found 83 body media references with
  missing `media` rows and 2 live body media references whose `media.post_id`
  is still null.
- Those 2 live references currently return 200 but will cross the 7-day orphan
  threshold on 2026-07-07 UTC if the cleanup/binding logic is not changed first:
  `med_01kwbng6yge489h3emx40j77v9` and
  `med_01kwbpb15we489h3fn1t9myhdr`.

Recommended follow-up:

- Fix submit/save to extract first-party inline media IDs from body JSON and
  attach them to the post, or teach cleanup to treat first-party media IDs
  referenced by post bodies as live.
- Run a one-off repair after the code fix to bind existing live inline-body
  media rows to their referencing posts.
- Consider pausing hosted orphan-media cleanup or narrowing it to rows not
  referenced by any post body until the fix and repair are deployed.

## Follow-up: Cross-Site Impact

### Plan

- [x] Scan all hosted sites for post bodies that reference first-party media
      URLs.
- [x] Classify referenced media as missing, live-but-unattached, attached to the
      same post, attached to another post, or cross-site.
- [x] Summarize affected sites/posts and sample the most relevant records.
- [x] Recommend a healthier cleanup model based on the observed blast radius.

### Review

Read-only production scan across all sites:

- Body inline-media refs with missing `media` rows: 127 refs, 58 posts, 5 sites.
- Body inline-media refs with live `media` rows but `post_id IS NULL`: 24 refs,
  8 posts, 7 sites. These are still accessible today but will be deleted by the
  current orphan cleaner after each row crosses the 7-day threshold.
- Affected site summary:
  - `owen.jant.blog`, `www.owenyoung.com`: 85 refs / 30 posts
    (83 missing, 2 live-unattached).
  - `luxiblog.jant.blog`, `luxi.blog`: 30 refs / 17 posts
    (all missing).
  - `michaelwang.jant.blog`, `mikelab.jant.blog`, `michaelwang.nz`: 7 refs /
    7 posts (all missing).
  - `ayden.jant.blog`, `aydengen.com`: 6 refs / 5 posts
    (5 missing, 1 live-unattached).
  - `bern3rsh.jant.blog`: 11 refs / 1 post (all live-unattached).
  - `afan.jant.blog`, `www.afan.wiki`: 4 refs / 1 post (all live-unattached).
  - `fieldcraft.jant.blog`: 4 refs / 1 post (all live-unattached).
  - `mlyz.jant.blog`, `mlyz.me`: 2 refs / 1 post (all missing).
  - `createmyself.jant.blog`: 1 ref / 1 post (live-unattached).
  - `cyberhz.jant.blog`, `haozhe.wang`: 1 ref / 1 post
    (live-unattached).
- Earliest upcoming live-unattached cleanup deadlines are:
  - `createmyself.jant.blog`: `2026-07-06 22:56:20 UTC`.
  - `owenyoung.com`: `2026-07-07 07:04:40 UTC` and
    `2026-07-07 07:19:19 UTC`.
  - `bern3rsh.jant.blog`: `2026-07-07 10:08:23-24 UTC`.

Recommended cleanup model:

- Keep cleanup for expired temporary upload sessions, aborted multipart uploads,
  and 30-day trash purging. Those are operational garbage and do not represent
  published content.
- Pause or disable finalized orphan-media deletion until it is reference-aware.
  A `post_id IS NULL` check is not a safe liveness test because inline body
  images are persisted as URLs, not as post attachments.
- Proper fix: introduce an explicit media reference model, or at minimum extract
  first-party media IDs from TipTap body JSON on save and protect them in the
  cleanup query. A single `media.post_id` is too weak long-term because the same
  media URL can appear in more than one post.
- Safer policy after the fix: delete only finalized media that has zero live
  references across posts/settings/site assets, is older than a conservative
  grace window, and first enters recoverable trash with a durable audit trail.

# Hotfix: Stop Finalized Orphan Media Cleanup

## Problem

The hosted upload cleanup job currently deletes finalized media rows when
`post_id IS NULL` and the row is older than seven days. This misclassifies
first-party inline body images as orphaned because inline images are persisted
in TipTap body JSON as URLs, not as post attachments.

## Plan

- [x] Remove finalized orphan-media deletion from upload cleanup.
- [x] Keep expired upload session cleanup and due trash purging intact.
- [x] Update regression coverage so finalized unattached media is retained.
- [x] Run focused verification and document the result.

## Review

Done. `uploads.cleanupExpired` no longer calls
`media.listOrphanedMediaIds` / `media.deleteByIds` for finalized media rows with
`post_id IS NULL`. It still cleans expired upload sessions and purges due
`storage_purge` trash entries. The response keeps `deletedOrphanMedia: 0` for
API/CLI compatibility.

Updated internal uploads cleanup coverage so an old finalized unattached media
row remains in both DB and storage and does not create a trash entry.

Verification:

- `mise run test -- src/routes/api/internal/__tests__/uploads.test.ts src/__tests__/bin/uploads-cleanup.test.ts`
- `mise run test -- src/services/__tests__/media.test.ts src/routes/api/internal/__tests__/uploads.test.ts`
- `mise exec -- npx prettier --check src/services/upload-session.ts src/routes/api/internal/__tests__/uploads.test.ts src/routes/api/internal/sites.ts ../../tasks/todo.md`
- `git diff --check`

# Merge Preview Into Branch 2

## Problem

The current `2` branch needs `preview` merged before deployment. The working
tree contains the finalized-media cleanup hotfix, and `preview` also touches
`tasks/todo.md`, so the merge may need conflict resolution.

## Plan

- [x] Stash current uncommitted hotfix changes.
- [x] Fetch latest `origin/preview` and merge it into `2`.
- [x] Reapply the hotfix changes and resolve conflicts.
- [x] Fix the post-merge snapshot test environment isolation failure.
- [x] Run focused verification for the merge and hotfix.
- [x] Document the result.

## Review

Done. Branch `2` fast-forwarded to `origin/preview` at
`c787f63b Keep homepage fixed to latest`. The finalized-media cleanup hotfix was
stashed before the merge and reapplied cleanly afterward.

No merge conflict markers remain. `git status` shows only the intended
uncommitted files from the hotfix, the post-merge snapshot test isolation fix,
and this task note.

Post-merge verification initially exposed a snapshot test failure: the CLI test
fixture used local storage paths, but the CLI auto-loaded local `.env.node` S3
settings. The test now forces `STORAGE_DRIVER=local` for snapshot runtime
switches and restores Node/S3 CLI env keys after each test.

Verification:

- `mise run test -- src/node/__tests__/cli-site-snapshot.test.ts` passed from
  `packages/core`.
- `mise run check-tests` passed: 219 files, 2594 tests.
- `mise run check-lint` passed.
- `mise run test -- src/node/__tests__/cli-site-snapshot.test.ts src/routes/api/internal/__tests__/uploads.test.ts src/__tests__/bin/uploads-cleanup.test.ts`
  passed from `packages/core`.
- `mise exec -- npx prettier --check packages/core/src/services/upload-session.ts packages/core/src/routes/api/internal/__tests__/uploads.test.ts packages/core/src/routes/api/internal/sites.ts packages/core/src/node/__tests__/cli-site-snapshot.test.ts tasks/todo.md`
  passed.
- `git diff --check` passed.
- `rg -n "^(<<<<<<<|=======|>>>>>>>)" .` found no conflict markers.

# Decouple Home Feed from Navigation Order

## Problem

The home page currently decides whether `/` shows Latest or Featured from the
first built-in navigation item among Latest and Featured. That makes removing or
reordering navigation links change the home feed, so a site cannot hide the
Latest header link while still keeping Latest on the home page.

## Plan

- [x] Trace every caller that derives `homeDefaultView` from nav item order.
- [x] Check production data read-only to see whether any current site relies on
      Featured being first in navigation as the homepage.
- [x] Remove the proposed `HOME_DEFAULT_VIEW` setting and compatibility
      backfill.
- [x] Make `/` fixed to Latest, `/featured` fixed to Featured, and `/latest`
      redirect to `/`.
- [x] Restore General settings order to Site, Language & Time, Feeds, Home,
      Search, with Home containing only the Jant credit toggle.
- [x] Update export/import, docs, tests, and generated strings to match the
      fixed Latest homepage.
- [x] Run focused verification plus the normal checks and document the result.

## Review

Done. A read-only production check found 79 sites, 0 explicit
`HOME_DEFAULT_VIEW` rows, and 0 sites whose first enabled Latest/Featured nav
item would make Featured the legacy homepage. Based on that, the final design
keeps the homepage fixed to Latest instead of adding a new user-facing setting.

Changes:

- Removed the proposed `HOME_DEFAULT_VIEW` config path, Settings UI, service
  methods, docs, export fields, and compatibility backfill.
- `/` now always renders Latest, `/featured` always renders Featured, and
  `/latest` redirects to `/`.
- Built-in nav URL resolution is fixed again: Latest -> `/`, Featured ->
  `/featured`; navigation order no longer changes homepage behavior.
- `Settings > General` is ordered as Site, Language & Time, Feeds, Home,
  Search. Home contains only the existing "Build with Jant" toggle.
- Hugo export/import, GitHub Sync, hosted export, canonical fixtures, sitemap,
  and API docs were updated to match the fixed Latest homepage.

Verification:

- `mise run i18n-build`
- `mise run test -- src/lib/__tests__/navigation.test.ts src/lib/__tests__/view.test.ts src/lib/__tests__/resolve-config.test.ts src/services/__tests__/settings.test.ts src/services/__tests__/site-profile.test.ts src/db/__tests__/migrations.test.ts src/client/components/__tests__/jant-settings-general.test.ts src/client/components/__tests__/jant-settings-avatar.test.ts src/ui/dash/settings/__tests__/GeneralContent.test.tsx src/routes/feed/__tests__/sitemap.test.ts src/__tests__/export-service.test.ts src/__tests__/import-site-command.test.ts`
- `mise run check-tests`
- `mise run check-lint`
- `mise exec -- npx prettier --check ...`
- `git diff --check`

# Investigate Quiet Reply Export Import

## Problem

`site export` / `site import` may not preserve the "Reply quietly" behavior.
A recent import appears to have turned quiet replies into normal replies that
bump the thread in Latest.

## Plan

- [x] Trace how `quietReply` affects post creation and timeline bump state.
- [x] Inspect `site export` output for any quiet-reply marker or equivalent
      metadata.
- [x] Inspect `site import` parsing and `createPost` calls for matching
      metadata handling.
- [x] Add or run focused verification that proves whether quiet replies
      round-trip correctly.
- [x] Document findings and, if needed, the fix in this task.

## Review

Done. `Reply quietly` is not stored as a per-reply export field. The persistent
state is the root post's `last_activity_at`, which records whether the thread
was bumped in Latest.

The bug was in `site import`: it ignored exported root `last_activity_at` and
created every imported reply as a normal reply. That made replies originally
published quietly bump the imported thread.

Fix:

- Added importer logic that compares each reply's `date` against the exported
  root `last_activity_at` (falling back to the root `date` when absent).
- Replies newer than that activity timestamp are imported with
  `quietReply: true`, so the API preserves the original thread activity state.
- Documented that quiet reply round-tripping is root-activity based, not a
  per-reply marker.

Verification:

- `mise run test -- src/__tests__/import-site-command.test.ts` passed from
  `packages/core` (typecheck, ESLint, core build, and 17 Vitest tests).

# Try Plain Markdown Headings

## Problem

Markdown `h2`/`h3` headings currently use italic styling, which feels awkward
in Chinese and too literary in mixed-language posts.

## Plan

- [x] Remove italic styling from public `h2`/`h3` prose headings.
- [x] Keep compose-editor and Hugo export headings consistent.
- [x] Run focused CSS verification and provide a local preview URL.

## Review

Done. Markdown `h2`/`h3` headings are now upright in:

- public `.prose` rendering,
- the compose TipTap editor,
- the Hugo export theme.

Blockquote and empty-state italics were left unchanged because they carry
different UI/content semantics.

Verification:

- `mise exec -- npx prettier --check packages/core/src/preset.css packages/core/src/services/export-theme/styles/main.css packages/core/src/styles/ui.css packages/core/src/ui/feed/__tests__/timeline-cards.test.ts tasks/todo.md`
  passed.
- `mise run test -- src/ui/feed/__tests__/timeline-cards.test.ts` passed from
  `packages/core` (including typecheck, ESLint, core build, and 25 tests).
- `mise run build` passed.
- `git diff --check` passed.
- Generated client CSS confirms public and compose `h2`/`h3` no longer include
  `font-style: italic`.

Preview:

- Existing local Jant dev server is available at `http://localhost:3000/`.

# Stop Repeated Remote Image Rehost Warnings

## Problem

Editing a saved post that still contains external images from an earlier paste
can repeatedly show the toast that those images could not be saved to the media
library. The old external image links should stay in the article without being
retried on every edit/save cycle.

## Plan

- [x] Trace the compose editor and TipTap rehost trigger path.
- [x] Restrict rehosting to actual paste transactions instead of every document
      change containing a remote image.
- [x] Add focused regression coverage for loading/editing a document that
      already has remote images.
- [x] Run proportionate verification and document the result.

## Review

Done. Rehost is now a paste-only side effect:

- `RehostImages` only scans for remote image candidates when a document-changing
  transaction is marked as a paste.
- Loading saved content with remote image URLs no longer attempts to sideload
  those URLs.
- A failed paste rehost can settle and clear its in-flight marker without later
  typing/editing retrying the same external URL.
- The toast regression test now dispatches a real paste event instead of
  simulating one with `setImage()`.

Verification:

- `mise run test -- src/client/tiptap/__tests__/rehost-images.test.ts src/client/tiptap/__tests__/paste-rehost-e2e.test.ts src/client/components/__tests__/jant-compose-editor-rehost-notice.test.ts`
  passed from `packages/core` (including typecheck, ESLint, core build, and 3
  Vitest files / 9 tests).
- `git diff --check -- packages/core/src/client/tiptap/rehost-images.ts packages/core/src/client/tiptap/__tests__/rehost-images.test.ts packages/core/src/client/components/__tests__/jant-compose-editor-rehost-notice.test.ts tasks/todo.md`
  passed.

# Normalize Markdown Code Styling

## Problem

Inline markdown `<code>` currently reads too heavy and boxy against normal prose.
Code blocks also share feed-card surface tokens, which makes technical snippets
feel more like cards than quiet reading content.

## Plan

- [x] Inspect current prose/code rules in the live app and export theme.
- [x] Replace inline and block code styling with quieter token-driven surfaces.
- [x] Verify the CSS and document the result.

## Review

Done. Markdown inline code and code blocks now use dedicated reading-surface
tokens instead of feed-card styling:

- Added `--site-code-*` tokens for text, inline background, block background,
  and block border.
- Updated live `.prose` styles so inline code is lighter, borderless, wraps
  cleanly, and resets typography plugin pseudo-content.
- Updated the Hugo export theme with matching inline and block code styling.
- Added a focused CSS regression check covering live and exported prose.

Verification:

- `mise exec -- npx prettier --check packages/core/src/styles/tokens.css packages/core/src/preset.css packages/core/src/services/export-theme/styles/main.css packages/core/src/ui/feed/__tests__/timeline-cards.test.ts tasks/todo.md`
  passed.
- `mise run test -- src/ui/feed/__tests__/timeline-cards.test.ts` passed from
  `packages/core`.
- `mise run build` passed.
- `git diff --check` passed.
- Generated client CSS contains the new inline code, code block, and pseudo
  reset rules. Browser screenshot verification was skipped because the in-app
  browser was unavailable and local Playwright is not installed.

# Integrate About Page in General Settings

## Problem

Jant already supports an About page as a normal post at `/about`, but users have
to know to create that hidden post themselves. Settings should make this standard
blog practice discoverable without adding a separate internal binding model.

## Plan

- [x] Inspect settings, compose, path, and navigation flows.
- [x] Resolve `/about` through services and expose its status to
      `Settings > General`.
- [x] Add an About page section with create/edit/view actions and clear conflict
      copy when `/about` is owned by something other than a post.
- [x] Reuse the compose dialog for About creation, prefilled as title `About`,
      slug `about`, and hidden-from-Latest visibility.
- [x] Add a navigation checkbox that appends or removes a normal `/about` link,
      while linking to full navigation settings for ordering.
- [x] Add focused coverage and run proportionate verification.

## Review

Done. Settings > General now treats `/about` as the standard About page:

- `AboutPageService` resolves `/about` through `path_registry`, reports missing,
  ready, or conflict states, and owns the normal `/about` navigation shortcut.
- The General settings page shows an About section with create/edit/view actions,
  conflict copy for collection/redirect/archive ownership, and a navigation
  checkbox with a link to full navigation settings for ordering.
- Compose `openNew()` now accepts initial title, slug, and visibility defaults,
  letting the About flow reuse the existing compose dialog with title `About`,
  slug `about`, and `latest_hidden` visibility.
- Lingui catalogs were extracted/compiled; new settings messages are translated
  in English, Simplified Chinese, and Traditional Chinese.
- Follow-up correction: fixed Chinese settings catalog format labels where
  translator guidance leaked into compact Link/Quote UI labels, and added
  regression coverage for those labels.

Verification:

- `mise run test -- src/services/__tests__/about-page.test.ts src/client/components/__tests__/jant-settings-general.test.ts src/ui/dash/settings/__tests__/GeneralContent.test.tsx`
  passed from `packages/core`.
- `mise run i18n-build` passed; settings catalog missing count is 0 for en,
  zh-Hans, and zh-Hant.
- `mise run test -- src/i18n/__tests__/fallback.test.ts src/client/components/__tests__/jant-settings-general.test.ts`
  passed after the Chinese label correction.
- `mise exec -- npx prettier --check ...` passed for all changed TS/TSX files.
- `mise run test` passed: typecheck, ESLint, core build, and 218 Vitest files /
  2575 tests.

Note: full `mise run check-format` is still blocked by existing Hugo template
syntax that Prettier parses as HTML, unrelated to this change.

## Follow-up: Compact About UI

The About controls should read as a compact companion to "About this blog",
not as a separate full settings section.

Plan:

- [x] Move About page controls into the Site section beneath the blog
      description field.
- [x] Render About as a compact status row with short actions.
- [x] Keep navigation toggle visible only when the About page exists.
- [x] Update focused tests and i18n catalogs.
- [x] Run proportionate verification.

Result:

- About now renders as a compact row directly under the "About this blog"
  editor instead of a standalone section.
- Missing state shows a short "Not created" status, compact hint, and a short
  Create button with the full "Create About page" accessible label.
- Ready state keeps Edit/View and the navigation toggle visible without an
  extra card or section heading.
- Desktop and mobile browser checks verified the row stays inside the Site
  section and does not create horizontal overflow.

Follow-up verification:

- `mise run i18n-build` passed; settings catalog missing count is 0 for en,
  zh-Hans, and zh-Hant.
- `mise run test -- src/client/components/__tests__/jant-settings-general.test.ts src/client/components/__tests__/jant-settings-avatar.test.ts src/ui/dash/settings/__tests__/GeneralContent.test.tsx src/i18n/__tests__/fallback.test.ts`
  passed.
- `mise exec -- npx prettier --check ...` passed for the changed UI/test/docs
  files.
- `git diff --check` passed.

## Follow-up: About Grouping Clarity

The compact About row was too visually detached from "About this blog".

Plan:

- [x] Replace the full-width separator with an inset child setting treatment.
- [x] Keep the row compact on mobile and desktop.
- [x] Re-check in browser and run focused verification.

Result:

- About page now uses an inset child setting treatment under "About this blog":
  a subtle left rail, slight background, and no full-width divider.
- Browser checks on desktop and mobile verified the row remains in the About
  field group and has no horizontal overflow.

Verification:

- `mise run test -- src/client/components/__tests__/jant-settings-general.test.ts src/ui/dash/settings/__tests__/GeneralContent.test.tsx`
  passed.
- `mise exec -- npx prettier --check packages/core/src/client/components/jant-settings-general.ts tasks/todo.md`
  passed.
- `git diff --check` passed.

## Follow-up: Simplify About Prompt

The About control should be an inline contextual prompt below the short blog
description, not a child setting block.

Plan:

- [x] Replace the compact About setting block with one inline prompt under
      "About this blog".
- [x] Make existing About pages link to `/about?edit=1`.
- [x] Add a create endpoint that creates the hidden `/about` post and redirects
      to `/about?edit=1`.
- [x] Add client logic that opens the current post editor when an authenticated
      post page loads with `?edit=1`.
- [x] Remove the no-longer-needed navigation toggle and compose prefill plumbing.
- [x] Verify with focused tests and browser checks.

Result:

- Settings now shows a single line:
  `Want to write a fuller introduction? Create About page` or
  `Want to write a fuller introduction? Edit About page`.
- Creating About from settings creates a published `latest_hidden` note at
  `/about`, redirects there, and opens the edit compose dialog.
- Existing About pages link straight to `/about?edit=1`, which opens the edit
  dialog and cleans the URL back to `/about`.

Verification:

- `mise run i18n-build` passed; settings catalog missing count is 0 for en,
  zh-Hans, and zh-Hant.
- `mise run test -- src/services/__tests__/about-page.test.ts src/client/components/__tests__/jant-settings-general.test.ts src/client/components/__tests__/jant-settings-avatar.test.ts src/ui/dash/settings/__tests__/GeneralContent.test.tsx src/client/__tests__/compose-shortcuts.test.ts src/i18n/__tests__/fallback.test.ts`
  passed.
- `mise run test` passed: typecheck, ESLint, core build, and 218 Vitest files /
  2576 tests.
- Browser check on `http://localhost:19020/settings/general` verified both the
  create flow and the ready-state edit link. Creating About redirected to
  `/about` and opened the edit dialog automatically.
- Mobile browser check verified the inline prompt has no horizontal overflow.
- `mise exec -- npx prettier --check ...` passed for changed code/test/task
  files.
- `git diff --check` passed.

## Follow-up: Draft About Edit Link

If a user manually creates `/about` as a draft, settings currently detects it as
an About page but `/about?edit=1` cannot render because draft post pages 404
before client-side edit auto-open runs.

Plan:

- [x] Allow only authenticated `/about?edit=1` requests to render a draft About
      post for editing.
- [x] Keep normal draft URLs and unauthenticated draft edit URLs as 404.
- [x] Add focused route coverage and run proportionate verification.

Result:

- Draft `/about` posts now remain hidden by default.
- Authenticated `/about?edit=1` can render the draft About page so the existing
  client-side edit auto-open can run.
- Draft edit pages skip article canonical/JSON-LD metadata because they are
  authoring surfaces, not public article pages.

Verification:

- `mise run test -- src/routes/pages/__tests__/draft-about-edit.test.ts src/services/__tests__/about-page.test.ts src/client/__tests__/compose-shortcuts.test.ts`
  passed from `packages/core`.
- `mise run test` passed: typecheck, ESLint, core build, and 219 Vitest files /
  2579 tests.

## Suggested Navigation Links

Navigation settings should suggest common destinations that already exist on the
site, such as `/about` and `/now`, without turning them into built-in system
links. Suggestions should use an Add action and create normal navigation items
that users can edit, reorder, move to More, or delete.

Plan:

- [x] Add a service-level suggested navigation links projection for known paths.
- [x] Detect `/about` and `/now` by resolved path target, not by title.
- [x] Hide suggestions that are already represented by URL or collection id.
- [x] Pass suggestions into `Settings > Navigation`.
- [x] Render suggestions with one-shot Add buttons in the nav manager.
- [x] Add focused service/component coverage and run proportionate verification.

Review:

- `NavItemService.listSuggestedLinks()` now detects `/about` and `/now` via
  `path_registry`, returns only existing navigable targets, skips draft/private
  posts, and hides suggestions already covered by path or collection id.
- `Settings > Navigation` passes suggested links into the nav manager with
  translated target labels.
- The nav manager renders a compact “Suggested links” section with Add buttons.
  Adding a canonical collection creates a collection nav item; page/custom/alias
  targets create normal link nav items.
- The suggestion disappears immediately after Add because the client also
  de-duplicates against current nav state.

Verification:

- `mise run test -- src/services/__tests__/navigation.test.ts src/client/components/__tests__/jant-nav-manager.test.ts src/ui/dash/appearance/__tests__/NavigationContent.test.tsx`
  passed from `packages/core` after typecheck, lint, and build.
- `mise run test` passed: typecheck, ESLint, core build, and 219 Vitest files /
  2586 tests.
- `mise run i18n-build` passed; settings catalog missing count is 0 for en,
  zh-Hans, and zh-Hant.
- `mise exec -- npx prettier --check ...` passed for the changed code/style/task
  files.
- `git diff --check` passed.

## Settings Navigation Copy

The Simplified Chinese settings catalog currently translates some navigation
surface labels as “页眉”, which reads like a document page header rather than the
site navigation area.

Plan:

- [x] Translate the settings navigation entry as “站点导航”.
- [x] Replace navigation-page “页眉” wording with “导航栏” where it refers to nav
      items.
- [x] Use “站点顶部” for non-navigation header identity/avatar copy.
- [x] Run a focused i18n verification.

Review:

- Simplified Chinese now translates the settings navigation entry as “站点导航”.
- Navigation placement copy uses “导航栏” instead of “页眉”.
- Avatar/header identity copy uses “站点顶部” where it is not specifically about
  navigation.

Verification:

- `mise run i18n-build` passed; settings catalog missing count is 0 for en,
  zh-Hans, and zh-Hant.

# Compact Feed Body Headings

## Problem

Post titles in list/feed contexts are `h2`, while headings authored inside the
post body can also render as `h2`. Visually, body headings should not compete
with the post title when the post is shown in a list.

## Plan

- [x] Add feed-scoped CSS that compacts authored body headings from `h1` through
      `h6` without changing detail-page prose.
- [x] Mirror the treatment in the static export theme.
- [x] Add focused regression coverage for the CSS rules.
- [x] Run proportionate verification and document the result.

## Review

Done. Feed/list body headings now use a compact visual ladder. Follow-up
corrections: the first pass only moved `h1`/`h2` to subtitle scale, which the
browser showed as 21.6px and still too close to post-title scale; the next pass
moved them all the way to body scale, which made them read too small.

- `h1`/`h2` render at a token-derived midpoint just above body scale.
- `h3`/`h4` render at body scale.
- `h5`/`h6` render at secondary scale and muted color.

The rules are scoped to live feed/list post bodies and exported Hugo post cards,
so single-post detail prose keeps its normal reading hierarchy.

Verification:

- `mise exec -- npx prettier --check packages/core/src/preset.css packages/core/src/services/export-theme/styles/main.css packages/core/src/ui/feed/__tests__/timeline-cards.test.ts tasks/todo.md tasks/lessons.md`
  passed.
- `mise run test -- src/ui/feed/__tests__/timeline-cards.test.ts` passed from
  `packages/core` (typecheck, ESLint, core build, and 26 Vitest tests).
- `git diff --check` passed.

# Compact Reply Quote Composer

## Problem

When replying and switching the composer to Quote, the quote textarea uses the
large normal quote container but the reply-specific quote font is much smaller.
That makes the field feel oversized and visually weak in the reply composer.

## Plan

- [x] Increase reply quote text slightly above normal reply body size.
- [x] Tighten the reply quote container padding and minimum textarea height.
- [x] Add focused CSS regression coverage.
- [x] Run proportionate verification and document the result.

## Review

Done. Reply quote compose now uses a compact quote treatment:

- Reply quote text uses `calc(var(--type-content-body) * 1.06)` instead of
  `--type-secondary`.
- Reply quote wrap padding is reduced to `24px 18px 18px` on narrow screens and
  `25px 20px 18px` on wider screens.
- Reply quote textarea min-height is reduced from `9rem`/`9.5rem` to `6.5rem`.
- The decorative quote mark is scaled and positioned for the tighter container.

Verification:

- `mise exec -- npx prettier --check packages/core/src/styles/ui.css packages/core/src/client/components/__tests__/jant-compose-dialog.test.ts tasks/todo.md`
  passed.
- `mise run test -- src/client/components/__tests__/jant-compose-dialog.test.ts`
  passed from `packages/core` (typecheck, ESLint, core build, and 123 Vitest
  tests).
- `git diff --check` passed.

## Follow-up: Reply Format Field Rhythm

The reply format switcher now exposes another rhythm mismatch: Note starts with
a text editor and feels more open, while Link and Quote start with bordered
controls that sit too close to the `note/link/quote` selector.

Plan:

- [x] Add reply-scoped top rhythm to Link and Quote first fields.
- [x] Keep normal compose and Note reply spacing unchanged.
- [x] Update focused CSS regression coverage.
- [x] Run proportionate verification and document the result.

Result:

- Reply Link's URL box now gets `margin-top: 0.4rem`.
- Reply Quote's quote card now gets `margin-top: 0.4rem`.
- Note reply spacing remains unchanged.

This keeps the format selector-to-field rhythm closer across Note, Link, and
Quote without changing normal non-reply compose.

Verification:

- `mise exec -- npx prettier --check packages/core/src/styles/ui.css packages/core/src/client/components/__tests__/jant-compose-dialog.test.ts tasks/todo.md tasks/lessons.md`
  passed.
- `mise run test -- src/client/components/__tests__/jant-compose-dialog.test.ts`
  passed from `packages/core` (typecheck, ESLint, core build, and 123 Vitest
  tests). The run printed happy-dom fetch abort logs during teardown, but exited
  successfully.
- `git diff --check` passed.

## Follow-up: Reply Quote Line Height

The reply quote textarea now uses a smaller, reply-specific size, but it still
inherited the default quote line-height. That made the serif quote text feel
tighter than the reply body editor.

Plan:

- [x] Add a semantic quote input line-height variable.
- [x] Keep the normal compose quote line-height at `1.32`.
- [x] Give reply quote input a looser `1.42` line-height.
- [x] Update focused CSS regression coverage.
- [x] Run proportionate verification and document the result.

Result:

- `--compose-quote-input-leading` now controls quote textarea line-height.
- Normal quote compose keeps `--compose-quote-input-leading: 1.32`.
- Reply quote compose overrides it to `1.42`, matching the smaller reply quote
  type without making the field as loose as the main body editor.

Verification:

- `mise exec -- npx prettier --check packages/core/src/styles/ui.css packages/core/src/client/components/__tests__/jant-compose-dialog.test.ts tasks/todo.md tasks/lessons.md`
  passed.
- `mise run test -- src/client/components/__tests__/jant-compose-dialog.test.ts`
  passed from `packages/core` (typecheck, ESLint, core build, and 123 Vitest
  tests). The run printed local 401 logs from discovery slash-command requests,
  but exited successfully.
- `git diff --check` passed.

## Follow-up: Reading Quote Type Size

The previous quote-size discussion was about the reading surface, not the
compose textarea. Reading quote posts used `--type-content-subtitle`, which
computes to about 21.6px at the current scale while body text is about 16.8px.
That made quote text read closer to a heading than a highlighted quotation.

Plan:

- [x] Restore reply compose quote size to its previous `1.06` multiplier.
- [x] Add a semantic reading quote size token.
- [x] Apply it to live quote posts and exported quote posts.
- [x] Update focused CSS regression coverage.
- [x] Run proportionate verification and document the result.

Result:

- Added `--type-content-quote: calc(var(--type-content-body) * 1.16)`.
- Live `.feed-quote-content` now uses `--type-content-quote`.
- Exported `.post-card-quote-content` now uses the same token.
- At the current scale, reading quote text moves from about 21.6px to 19.5px.

Verification:

- `mise exec -- npx prettier --check packages/core/src/styles/tokens.css packages/core/src/styles/ui.css packages/core/src/services/export-theme/styles/main.css packages/core/src/ui/feed/__tests__/timeline-cards.test.ts packages/core/src/client/components/__tests__/jant-compose-dialog.test.ts tasks/todo.md tasks/lessons.md`
  passed after formatting the focused feed test file with Prettier.
- `mise run test -- src/ui/feed/__tests__/timeline-cards.test.ts src/client/components/__tests__/jant-compose-dialog.test.ts`
  passed from `packages/core` (typecheck, ESLint, core build, and 151 Vitest
  tests). The run printed local 401 logs from discovery slash-command requests,
  but exited successfully.
- `git diff --check` passed.

## Follow-up: Reading Quote Line Height

After the reading quote text size was lowered, the text still inherited
`--type-heading-leading` (`1.15`). Multi-line quote posts felt cramped because
the quote is now reading text, not a heading.

Plan:

- [x] Add a semantic reading quote line-height token.
- [x] Apply it to live quote posts and exported quote posts.
- [x] Update focused CSS regression coverage.
- [x] Run proportionate verification and document the result.

Result:

- Added `--type-content-quote-leading: 1.4`.
- Live `.feed-quote-content` now uses `--type-content-quote-leading`.
- Exported `.post-card-quote-content` now uses the same token.

Verification:

- `mise exec -- npx prettier --check packages/core/src/styles/tokens.css packages/core/src/styles/ui.css packages/core/src/services/export-theme/styles/main.css packages/core/src/ui/feed/__tests__/timeline-cards.test.ts tasks/todo.md tasks/lessons.md`
  passed.
- `mise run test -- src/ui/feed/__tests__/timeline-cards.test.ts` passed from
  `packages/core` (typecheck, ESLint, core build, and 28 Vitest tests).
- `git diff --check` passed.

## Follow-up: Feed Title Type Size

Note and Link titles in list views used `--type-content-title`, which computes
to about 25.2px at the current scale. That keeps them below detail-page h1
titles, but still makes list entries feel closer to page titles than compact
post-entry headings.

Plan:

- [x] Lower the feed title token without changing detail-page h1.
- [x] Keep Note and Link list titles on the same token.
- [x] Preserve export theme title behavior through the shared token.
- [x] Update focused CSS regression coverage.
- [x] Run proportionate verification and document the result.

Result:

- `--feed-note-title-size` now uses
  `calc(var(--type-content-body) * 1.36)`.
- At the current scale, list Note/Link titles move from about 25.2px to 22.8px.
- Detail-page h1 remains on `--type-content-display`.
- Feed body headings remain smaller at `calc(var(--type-content-body) * 1.12)`.

Verification:

- `mise exec -- npx prettier --check packages/core/src/styles/tokens.css packages/core/src/styles/ui.css packages/core/src/services/export-theme/styles/main.css packages/core/src/ui/feed/__tests__/timeline-cards.test.ts packages/core/src/client/components/__tests__/jant-compose-dialog.test.ts tasks/todo.md tasks/lessons.md`
  passed.
- `mise run test -- src/ui/feed/__tests__/timeline-cards.test.ts` passed from
  `packages/core` (typecheck, ESLint, core build, and 28 Vitest tests).
- `git diff --check` passed.

# Detail Header Spacing

## Problem

On post detail pages, titled notes keep the publish time close to the `h1` title
and then move into the body. The title-to-time gap is a little tight, and the
time-to-body gap can use a touch more breathing room for reading.

## Plan

- [x] Increase the detail title-to-meta gap slightly.
- [x] Increase the meta-to-body gap slightly.
- [x] Add focused CSS regression coverage.
- [x] Run proportionate verification and document the result.

## Review

Done. Detail titled-note headers now have slightly more reading air:

- Title-to-time gap increased from `0.55rem` to `0.7rem`.
- Time-to-body gap increased from `1.5rem` to `1.7rem`.

This keeps the title and timestamp as one header group while separating the
metadata a bit more cleanly from the body.

Verification:

- `mise exec -- npx prettier --check packages/core/src/styles/ui.css packages/core/src/ui/feed/__tests__/timeline-cards.test.ts tasks/todo.md`
  passed.
- `mise run test -- src/ui/feed/__tests__/timeline-cards.test.ts` passed from
  `packages/core` (typecheck, ESLint, core build, and 27 Vitest tests).
- `git diff --check` passed.

# Prose List Indentation

## Problem

Public prose lists currently use `padding-left: 1.625em`, which gives list items
roughly 27px of indentation at the current body size. That reads a bit wide in
Jant's narrow reading column.

## Plan

- [x] Reduce public prose `ul`/`ol` indentation to `1.4em`.
- [x] Mirror the indentation in the Hugo export theme.
- [x] Add focused CSS regression coverage.
- [x] Run proportionate verification and document the result.

## Review

Done. Public prose list indentation is now tighter:

- Live prose `ul`/`ol` padding changed from `1.625em` to `1.4em`.
- Hugo export theme `ul`/`ol` padding changed from `1.625em` to `1.4em`.

This reduces the list text indent from roughly 27px to 23.5px at the current
body size while leaving browser-native marker spacing intact.

Verification:

- `mise exec -- npx prettier --check packages/core/src/preset.css packages/core/src/services/export-theme/styles/main.css packages/core/src/ui/feed/__tests__/timeline-cards.test.ts tasks/todo.md`
  passed.
- `mise run test -- src/ui/feed/__tests__/timeline-cards.test.ts` passed from
  `packages/core` (typecheck, ESLint, core build, and 28 Vitest tests).
- `git diff --check` passed.

## Follow-up: List Item Rhythm

The list indentation is now better, but individual list items still use
`margin-top`/`margin-bottom: 1.2em`, which makes short bullet lists feel too
loose.

Plan:

- [x] Reduce public prose `li` vertical margins to `0.65em`.
- [x] Mirror the rhythm in the Hugo export theme.
- [x] Update focused CSS regression coverage.
- [x] Run proportionate verification and document the result.

Result:

- Live prose `li`/`dt` vertical margins changed from `1.2em` to `0.65em`.
- Hugo export theme `li` margins changed from `1.2em` to `0.65em`.
- List block outer margin remains `1.25em 0`, so lists still separate cleanly
  from surrounding paragraphs while the items inside read as a tighter group.

Verification:

- `mise exec -- npx prettier --check packages/core/src/preset.css packages/core/src/services/export-theme/styles/main.css packages/core/src/ui/feed/__tests__/timeline-cards.test.ts tasks/todo.md`
  passed.
- `mise run test -- src/ui/feed/__tests__/timeline-cards.test.ts` passed from
  `packages/core` (typecheck, ESLint, core build, and 28 Vitest tests).
- `git diff --check` passed.

# Proportional Code Typography

## Problem

Inline code currently uses the fixed `--type-base` token, which computes to
15px while prose body text is 16.8px. That makes inline code feel smaller than
the surrounding sentence instead of integrated with it.

## Plan

- [x] Make inline code size proportional to prose body size.
- [x] Keep code blocks slightly smaller than inline code for dense reading.
- [x] Add focused regression coverage for the token relationship.
- [x] Run proportionate verification and document the result.

## Review

Done. Code typography now tracks prose body size instead of fixed base tokens:

- Inline code uses `calc(var(--type-body-size) * 0.94)`.
- Code blocks use `calc(var(--type-body-size) * 0.9)`.

With the current 16.8px prose body size, inline code computes to about 15.8px
and code blocks to about 15.1px. Exported Hugo themes inherit the same tokens
because export writes the core `tokens.css` into `static/tokens.css`.

Verification:

- `mise exec -- npx prettier --check packages/core/src/styles/tokens.css packages/core/src/ui/feed/__tests__/timeline-cards.test.ts tasks/todo.md`
  passed.
- `mise run test -- src/ui/feed/__tests__/timeline-cards.test.ts` passed from
  `packages/core` (typecheck, ESLint, core build, and 26 Vitest tests).
- `git diff --check` passed.

# Migrate Claude Commands to Codex Skills

## Problem

The repository has reusable Claude Code commands in `.claude/commands/`, but
Codex does not load those files as slash commands. They should be available as
repo-scoped Codex skills instead.

## Plan

- [x] Create repo skills for the existing `demo` and `release` commands.
- [x] Preserve the command workflows while converting them to `SKILL.md`
      frontmatter and instructions.
- [x] Validate the generated skill folders.
- [x] Document the verification result.

## Review

Done. The old Claude command workflows are now repo-scoped Codex skills:

- `.agents/skills/demo/SKILL.md` migrates `.claude/commands/demo.md` into a
  `$demo` skill for creating Showboat/Rodney visual proof documents.
- `.agents/skills/release/SKILL.md` migrates `.claude/commands/release.md` into
  a `$release` skill for creating and committing fixed-version changesets.
- Each skill includes `agents/openai.yaml` UI metadata with a default prompt.

Verification:

- `uv run --with pyyaml python /Users/green/.codex/skills/.system/skill-creator/scripts/quick_validate.py .agents/skills/demo`
  passed.
- `uv run --with pyyaml python /Users/green/.codex/skills/.system/skill-creator/scripts/quick_validate.py .agents/skills/release`
  passed.
- `mise exec -- npx prettier --check .agents/skills/demo/SKILL.md .agents/skills/release/SKILL.md .agents/skills/demo/agents/openai.yaml .agents/skills/release/agents/openai.yaml tasks/todo.md`
  passed.
- `git diff --check` passed.

## Follow-up: Bare Skill Invocation

Problem:

After opening a new Codex session, invoking `$release` alone attached the skill
context but did not behave like the old Claude slash command.

Plan:

- [x] Confirm the pasted `<skill>` context means Codex discovered the skill.
- [x] Add explicit default-invocation behavior to `$release`.
- [x] Add the same default-invocation behavior to `$demo` for consistency.
- [x] Validate the skill files and document the result.

Result:

- `$release` now explicitly treats a bare invocation as a request to run the
  changeset workflow.
- `$demo` now explicitly treats a bare invocation as a request to generate a
  visual demo for the current work.
- `tasks/lessons.md` documents the migration rule: a skill mention attaches
  context, but the skill should define what to do when no other task text is
  provided.

Verification:

- `uv run --with pyyaml python /Users/green/.codex/skills/.system/skill-creator/scripts/quick_validate.py .agents/skills/demo`
  passed.
- `uv run --with pyyaml python /Users/green/.codex/skills/.system/skill-creator/scripts/quick_validate.py .agents/skills/release`
  passed.
- `mise exec -- npx prettier --check .agents/skills/demo/SKILL.md .agents/skills/release/SKILL.md .agents/skills/demo/agents/openai.yaml .agents/skills/release/agents/openai.yaml tasks/todo.md tasks/lessons.md`
  passed.
- `git diff --check` passed.

## Follow-up: Command Completion

Problem:

Codex discovered `$release`, but typing `$release` did not provide command-style
autocomplete. Repo skills are discoverable context, not Claude-style slash
commands.

Plan:

- [x] Keep `.agents/skills/*` as the shared source of truth.
- [x] Add local `~/.codex/prompts/release.md` and `~/.codex/prompts/demo.md`
      as slash-menu shortcuts.
- [x] Verify the prompt files and document the exact invocation.

Result:

- Use `/prompts:release` for slash-menu completion, optionally with
  `bump=patch`, `bump=minor`, or `bump=major`.
- Use `/prompts:demo` for slash-menu completion, optionally with a focus string.
- Restart Codex or open a new chat after adding or editing prompt files so Codex
  reloads them.

Verification:

- `mise exec -- npx prettier --check /Users/green/.codex/prompts/release.md /Users/green/.codex/prompts/demo.md tasks/todo.md tasks/lessons.md`
  passed.
- `git diff --check` passed.

# RSS Ignores Pinned Ordering

## Problem

Atom/RSS feeds currently reuse page timeline ordering, so pinned posts can stay
ahead of newer posts in subscription feeds. Feeds should remain chronological
subscription streams and ignore pinning as a display-only page concern.

## Plan

- [x] Add a feed-only list option that excludes global `pinnedAt` from post sort
      keys without changing normal page/archive/search ordering.
- [x] Use that option from main/latest/archive Atom feed builders.
- [x] Add the equivalent collection-feed option so collection RSS ignores
      per-collection pins.
- [x] Update the exported Hugo Atom template to match live RSS behavior.
- [x] Add focused regression tests and run proportionate verification.

## Review

Done. Atom/RSS feed builders now treat pinning as a page-display concern:

- Main/latest and archive feeds pass `ignorePinnedSort: true`, so pinned posts
  only appear in their natural chronological position.
- Collection feeds pass `ignoreCollectionPinnedSort: true`, so per-collection
  pins no longer push old entries ahead in subscription feeds.
- Normal page/list ordering still keeps pinned posts first.
- Exported Hugo Atom collection feeds now match the live behavior by sorting
  collection members without a pinned-first split.

Verification:

- `mise run test -- src/services/__tests__/post.test.ts src/services/__tests__/post-timeline.test.ts src/routes/feed/__tests__/feed.test.ts`
  passed from `packages/core` (typecheck, ESLint, core build, and 172 Vitest
  tests).
- `mise run test -- src/routes/pages/__tests__/collection-routing.test.ts src/__tests__/export-service.test.ts src/__tests__/export-hugo-build.test.ts`
  passed from `packages/core` (typecheck, ESLint, core build, and 32 Vitest
  tests).
- `mise exec -- npx prettier --check packages/core/src/services/post.ts packages/core/src/routes/feed/feed.ts packages/core/src/routes/pages/archive.tsx packages/core/src/routes/pages/collection.tsx packages/core/src/services/__tests__/post.test.ts packages/core/src/services/__tests__/post-timeline.test.ts packages/core/src/routes/feed/__tests__/feed.test.ts tasks/todo.md`
  passed. The Hugo `rss.xml` template was skipped because Prettier cannot infer
  a parser for Hugo XML templates.
