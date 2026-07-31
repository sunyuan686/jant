# Lit Guide (Long-Term Conventions)

This document defines the ongoing Lit coding conventions for Jant.
It is separate from `docs/internal/lit-migration.md`, which tracked one-time migration work.

## When Lit Is Appropriate

- Use Datastar by default for server-driven state, simple toggles, and SSE flows.
- Use Lit for high-frequency client state, complex data staging, and third-party library wrappers.

## Required Patterns

### 1) Static Properties Pattern (No Decorators)

Use `static properties = { ... }` plus `declare` fields. Do not use decorators (`@property`, `@state`).

Why:

- SWC decorator support/config introduces avoidable friction and compatibility risks.
- Static properties are a first-class Lit pattern and keep build/runtime behavior predictable.

### 2) `classMap` Import Path

When using dynamic class composition, import exactly:

```ts
import { classMap } from "lit/directives/class-map.js";
```

### 3) Cleanup in `disconnectedCallback`

Every component that registers side resources must clean them up in `disconnectedCallback`, including:

- Event listeners
- Timers / intervals
- Observers
- Any external subscription handles

### 4) Naming and File Location

- Custom element tag names must use `jant-xxx` format.
- Custom events must use `jant:xxx` format.
- Client-side component files live in `src/client/components/`; server-rendered
  wrappers live with their owning feature under `src/ui/`.

### 5) Light DOM + SSR Fallback

- Use Light DOM only:
  - `createRenderRoot() { return this; }`
- No Shadow DOM styles in components (`static styles`).
- Server should render a useful skeleton/static fallback inside the custom element tag.
- Lit upgrades that fallback on hydration.

## Example Component

```ts
import { LitElement, html } from "lit";
import { classMap } from "lit/directives/class-map.js";

export class JantExample extends LitElement {
  static properties = {
    label: { type: String },
    _active: { state: true },
  };

  declare label: string;
  declare _active: boolean;

  createRenderRoot() {
    return this;
  }

  constructor() {
    super();
    this.label = "";
    this._active = false;
  }

  render() {
    return html`<div class=${classMap({ active: this._active })}>
      ${this.label}
    </div>`;
  }
}

customElements.define("jant-example", JantExample);
```
