#!/usr/bin/env bash

TARGET_BRANCHES=("1" "2" "3" "multi" "worker")

find_worktree_for_branch() {
  local target_branch="$1"

  git worktree list --porcelain | awk -v target_ref="refs/heads/$target_branch" '
    /^worktree / {
      worktree_path = substr($0, 10)
      next
    }
    $1 == "branch" && $2 == target_ref {
      print worktree_path
      exit
    }
  '
}
