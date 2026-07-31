import { describe, expect, it } from "vitest";
import {
  getFeedEntryUpdatedAt,
  getRssPublishedBefore,
} from "../feed-policy.js";

describe("feed policy", () => {
  it("makes the exact delay boundary eligible", () => {
    expect(getRssPublishedBefore(300, 1_000)).toBe(701);
    expect(getRssPublishedBefore(0, 1_000)).toBe(1_001);
  });

  it("uses the latest eligible content or membership update", () => {
    expect(
      getFeedEntryUpdatedAt(
        { publishedAt: 100, updatedAt: 100 },
        [
          { publishedAt: 100, updatedAt: 100 },
          { publishedAt: 300, updatedAt: 250 },
        ],
        [200, 400],
      ),
    ).toBe("1970-01-01T00:06:40.000Z");
  });
});
