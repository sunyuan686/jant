#!/usr/bin/env bash
#
# Check whether fixed worker worktrees contain commits missing from preview.
#
# Usage: scripts/worktree/sync-check.sh

set -euo pipefail

BASE_BRANCH="preview"
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
source "$SCRIPT_DIR/common.sh"

if ! git rev-parse --git-dir >/dev/null 2>&1; then
  echo "Cannot check worktrees outside a Git repository."
  exit 1
fi

if ! base_commit=$(git rev-parse --verify "refs/heads/$BASE_BRANCH^{commit}" 2>/dev/null); then
  echo "Cannot check worktrees because local branch '$BASE_BRANCH' does not exist."
  exit 1
fi

echo "Base: $BASE_BRANCH (${base_commit:0:8})"
echo "Targets: ${TARGET_BRANCHES[*]}"
echo ""

contained_count=0
missing_branches=()
missing_paths=()
missing_counts=()
unavailable_branches=()
unavailable_reasons=()

for target_branch in "${TARGET_BRANCHES[@]}"; do
  if ! git rev-parse --verify --quiet "refs/heads/$target_branch^{commit}" >/dev/null; then
    echo "Unavailable $target_branch: local branch does not exist."
    unavailable_branches+=("$target_branch")
    unavailable_reasons+=("local branch does not exist")
    continue
  fi

  target_path=$(find_worktree_for_branch "$target_branch")
  if [ -z "$target_path" ]; then
    echo "Unavailable $target_branch: branch is not checked out in a worktree."
    unavailable_branches+=("$target_branch")
    unavailable_reasons+=("branch is not checked out in a worktree")
    continue
  fi

  missing_count=$(git rev-list --count "$BASE_BRANCH..$target_branch")
  if [ "$missing_count" -eq 0 ]; then
    echo "Contained $target_branch: $target_path"
    contained_count=$((contained_count + 1))
    continue
  fi

  echo "Missing from $BASE_BRANCH: $target_branch ($target_path) has $missing_count commit(s)."
  missing_branches+=("$target_branch")
  missing_paths+=("$target_path")
  missing_counts+=("$missing_count")
done

missing_worktree_count=${#missing_branches[@]}
unavailable_count=${#unavailable_branches[@]}

echo ""
echo "Check complete: $contained_count contained, $missing_worktree_count with commits missing, $unavailable_count unavailable."

if [ "$missing_worktree_count" -ne 0 ]; then
  echo ""
  echo "Worktrees with commits missing from $BASE_BRANCH:"
  for ((index = 0; index < missing_worktree_count; index++)); do
    echo "  - ${missing_paths[$index]} (${missing_branches[$index]}): ${missing_counts[$index]} commit(s)"
    git log --oneline --no-decorate "$BASE_BRANCH..${missing_branches[$index]}" | sed 's/^/      /'
  done
fi

if [ "$unavailable_count" -ne 0 ]; then
  echo ""
  echo "Unavailable worktrees:"
  for ((index = 0; index < unavailable_count; index++)); do
    echo "  - [no worktree] (${unavailable_branches[$index]}): ${unavailable_reasons[$index]}"
  done
fi

if [ "$missing_worktree_count" -ne 0 ] || [ "$unavailable_count" -ne 0 ]; then
  exit 1
fi

echo "All worker commits are contained in $BASE_BRANCH."
