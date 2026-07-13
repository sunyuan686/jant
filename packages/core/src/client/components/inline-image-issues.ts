import type { ImageNodeLabels } from "../tiptap/image-node.js";
import type { ComposeLabels } from "./compose-types.js";

export function getInlineImageNodeLabels(
  labels: ComposeLabels,
): Partial<ImageNodeLabels> {
  const imageLabels: Partial<ImageNodeLabels> = {};
  if (labels.brokenImageUnavailable) {
    imageLabels.unavailable = labels.brokenImageUnavailable;
  }
  if (labels.brokenImageDelete) imageLabels.delete = labels.brokenImageDelete;
  if (labels.brokenImageReplace) {
    imageLabels.replace = labels.brokenImageReplace;
  }
  if (labels.brokenImageOpen) imageLabels.open = labels.brokenImageOpen;
  return imageLabels;
}
