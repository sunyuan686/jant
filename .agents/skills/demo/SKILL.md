---
name: demo
description: Generate a visual proof/demo document for completed Jant work using Showboat and Rodney screenshots. Use when the user invokes $demo by itself, asks for a demo, visual proof, proof document, screenshots showing the current work, or to prove a feature/fix works.
---

# Generate a Visual Demo

Create a Showboat demo document with real Rodney screenshots that demonstrate
the current feature or fix works. The document streams to the remote
datasette-showboat instance configured by `SHOWBOAT_REMOTE_URL`.

## Default Invocation

When invoked with no additional user instructions, treat the invocation as a
request to generate a visual demo for the current work. Start by checking the
Showboat and Rodney command usage and verifying `SHOWBOAT_REMOTE_URL`.

## Workflow

1. Run `uvx showboat --help` and `uvx rodney --help` to confirm current usage.
2. Verify `SHOWBOAT_REMOTE_URL` is set. If it is missing, stop and ask the user
   to configure it.
3. Derive the demo filename from the current branch name, for example
   `feat-login` becomes `/tmp/demos/feat-login.md`.
4. Create `/tmp/demos/` if it does not exist.
5. Use `showboat init` to create or overwrite the demo file. This assigns the
   Showboat UUID and streams the title to the remote instance.
6. Start the app if screenshots need a running local site. Use
   `mise run dev-debug` and the printed local login URL when authentication is
   required.
7. Start Rodney, navigate to the relevant pages, interact with the feature, and
   save screenshots under `/tmp/`.
8. Use Showboat commands such as `note`, `exec`, and `image` to assemble the
   demo. Do not edit the generated Markdown file directly.
9. Stop Rodney and any dev server started for the demo.
10. Report the remote viewer URL. Build it as
    `{SHOWBOAT_REMOTE_URL_origin}/-/showboat/{showboat-id}`, where
    `{showboat-id}` comes from the `<!-- showboat-id: ... -->` line in the demo
    file.

## Rules

- Keep all demo output in `/tmp/`; do not write demo files or screenshots into
  the repository.
- Always overwrite the demo document so it reflects the final state, not debug
  history.
- Use only real evidence from actual execution: screenshots, command output, and
  observed behavior. Do not fabricate demo content.
- Stop background processes started for the demo before finishing.
