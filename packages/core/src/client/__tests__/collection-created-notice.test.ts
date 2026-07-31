// @vitest-environment happy-dom

import { beforeEach, describe, expect, it } from "vitest";
import {
  consumeCollectionCreatedNotice,
  PENDING_COLLECTION_CREATED_STORAGE_KEY,
  queueCollectionCreatedNotice,
} from "../collection-created-notice.js";

describe("collection created notice", () => {
  beforeEach(() => {
    globalThis.sessionStorage.clear();
  });

  it("queues and consumes the newly created Collection ID once", () => {
    queueCollectionCreatedNotice("col_books");

    expect(
      globalThis.sessionStorage.getItem(PENDING_COLLECTION_CREATED_STORAGE_KEY),
    ).toBe('{"collectionId":"col_books"}');
    expect(consumeCollectionCreatedNotice()).toBe("col_books");
    expect(consumeCollectionCreatedNotice()).toBeNull();
  });

  it("clears malformed pending state", () => {
    globalThis.sessionStorage.setItem(
      PENDING_COLLECTION_CREATED_STORAGE_KEY,
      '{"collectionId":false}',
    );

    expect(consumeCollectionCreatedNotice()).toBeNull();
    expect(
      globalThis.sessionStorage.getItem(PENDING_COLLECTION_CREATED_STORAGE_KEY),
    ).toBeNull();
  });
});
