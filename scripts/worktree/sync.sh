#!/usr/bin/env bash
#
# Merge the primary worktree's current branch into the fixed worker worktrees.
#
# Usage: scripts/worktree/sync.sh

set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
source "$SCRIPT_DIR/common.sh"

find_primary_worktree() {
  git worktree list --porcelain | awk '
    /^worktree / {
      print substr($0, 10)
      exit
    }
  '
}

print_worktree_changes() {
  local worktree_path="$1"

  git -C "$worktree_path" status --short
}

SOURCE_PATH=$(find_primary_worktree)
if [ -z "$SOURCE_PATH" ]; then
  echo "Cannot find the primary Git worktree."
  exit 1
fi

SOURCE_BRANCH=$(git -C "$SOURCE_PATH" symbolic-ref --quiet --short HEAD || true)
if [ -z "$SOURCE_BRANCH" ]; then
  echo "Cannot sync from '$SOURCE_PATH' because it has a detached HEAD."
  exit 1
fi

if ! git -C "$SOURCE_PATH" rev-parse --verify --quiet HEAD >/dev/null; then
  echo "Cannot sync '$SOURCE_BRANCH' because it has no commits."
  exit 1
fi

echo "Source: $SOURCE_BRANCH ($SOURCE_PATH)"
echo "Targets: ${TARGET_BRANCHES[*]}"
echo ""

if [ -n "$(git -C "$SOURCE_PATH" status --porcelain --untracked-files=normal)" ]; then
  echo ""
  echo "Source worktree is not clean: $SOURCE_PATH"
  print_worktree_changes "$SOURCE_PATH"
  echo "Commit or stash these changes before syncing."
  echo "Nothing was merged."
  exit 1
fi

merged_count=0
skipped_count=0
failed_branches=()
failed_paths=()
failed_reasons=()

record_failure() {
  local target_branch="$1"
  local target_path="$2"
  local reason="$3"

  failed_branches+=("$target_branch")
  failed_paths+=("$target_path")
  failed_reasons+=("$reason")
}

for target_branch in "${TARGET_BRANCHES[@]}"; do
  target_path=$(find_worktree_for_branch "$target_branch")

  if [ -z "$target_path" ]; then
    echo "Skipping $target_branch: it is not checked out in a worktree."
    record_failure "$target_branch" "" "branch is not checked out in a worktree"
    continue
  fi

  if git merge-base --is-ancestor "$SOURCE_BRANCH" "$target_branch"; then
    echo "Skipping $target_branch: already contains $SOURCE_BRANCH."
    skipped_count=$((skipped_count + 1))
    continue
  fi

  if ! target_status=$(git -C "$target_path" status --porcelain --untracked-files=normal 2>&1); then
    echo "Skipping $target_branch: could not inspect $target_path."
    printf '%s\n' "$target_status"
    record_failure "$target_branch" "$target_path" "could not inspect worktree"
    continue
  fi

  if [ -n "$target_status" ]; then
    echo "Skipping $target_branch: worktree is not clean ($target_path)."
    print_worktree_changes "$target_path"
    record_failure "$target_branch" "$target_path" "worktree has uncommitted changes"
    continue
  fi

  if ! merge_check=$(git merge-tree --write-tree --name-only "$target_branch" "$SOURCE_BRANCH" 2>&1); then
    echo "Skipping $target_branch: $SOURCE_BRANCH cannot be merged cleanly into it."
    printf '%s\n' "$merge_check"
    record_failure "$target_branch" "$target_path" "merge cannot be applied cleanly"
    continue
  fi

  if ! git merge-base --is-ancestor "$target_branch" "$SOURCE_BRANCH" &&
    ! git -C "$target_path" var GIT_COMMITTER_IDENT >/dev/null 2>&1; then
    echo "Skipping $target_branch: a merge commit is required, but Git has no committer identity."
    record_failure "$target_branch" "$target_path" "merge commit requires user.name and user.email"
    continue
  fi

  echo "Merging $SOURCE_BRANCH into $target_branch ($target_path)..."
  if ! git -C "$target_path" merge --no-edit "$SOURCE_BRANCH"; then
    failure_reason="merge command failed"
    if git -C "$target_path" rev-parse --verify --quiet MERGE_HEAD >/dev/null; then
      if ! git -C "$target_path" merge --abort; then
        failure_reason="merge failed and could not be aborted"
      fi
    fi
    echo "Skipping $target_branch after the merge failed."
    record_failure "$target_branch" "$target_path" "$failure_reason"
    continue
  fi
  merged_count=$((merged_count + 1))
done

echo ""
failed_count=${#failed_branches[@]}
echo "Sync complete: $merged_count merged, $skipped_count already up to date, $failed_count failed."

if [ "$failed_count" -ne 0 ]; then
  echo ""
  echo "Failed worktrees:"
  for ((index = 0; index < failed_count; index++)); do
    if [ -n "${failed_paths[$index]}" ]; then
      echo "  - ${failed_paths[$index]} (${failed_branches[$index]}): ${failed_reasons[$index]}"
    else
      echo "  - [no worktree] (${failed_branches[$index]}): ${failed_reasons[$index]}"
    fi
  done
  exit 1
fi
