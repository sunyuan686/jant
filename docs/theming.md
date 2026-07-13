# Theming

Jant offers three ways to customize the look, from coarse to fine:

1. Built-in color themes
2. Built-in font themes
3. Custom CSS

Start with **Settings > Color Theme** and **Settings > Font Theme**. When those aren't enough, write overrides in **Settings > Custom CSS**.

All built-in themes include both light and dark palettes. Custom CSS layers on top of the selected theme — so the best approach is usually to treat a built-in theme as your starting point rather than rewriting everything from scratch.

## Color variables

Color variables come in two layers:

- **Core palette** (`--primary`, `--background`, etc.) controls the overall feel; changing one affects the whole site.
- **Site-specific colors** (`--site-*`) derive from the core palette by default, letting you fine-tune local areas without disturbing the global palette — for example, recoloring links without touching button colors.

Most color variables come in pairs: a background color and its matching foreground (text) color.

### Core palette

| Variable                 | What it controls                               |
| ------------------------ | ---------------------------------------------- |
| `--background`           | Page background                                |
| `--foreground`           | Main text color                                |
| `--primary`              | Functional brand color (buttons, selected UI)  |
| `--primary-foreground`   | Text on primary-colored elements               |
| `--secondary`            | Secondary buttons, badges                      |
| `--secondary-foreground` | Text on secondary elements                     |
| `--muted`                | Subtle backgrounds (hover states, badges)      |
| `--muted-foreground`     | Secondary text (dates, captions, placeholders) |
| `--accent`               | Hover/focus backgrounds (menus, nav items)     |
| `--accent-foreground`    | Text on accent backgrounds                     |
| `--card`                 | Card background                                |
| `--card-foreground`      | Text on cards                                  |
| `--popover`              | Dropdown / popover background                  |
| `--popover-foreground`   | Text in popovers                               |
| `--destructive`          | Danger actions (delete buttons, error states)  |
| `--success`              | Success indicators                             |
| `--border`               | Borders and dividers                           |
| `--input`                | Input field borders                            |
| `--ring`                 | Focus ring color                               |

### Site-specific colors

These derive from the core palette by default. Built-in themes set `--site-accent` independently; if you only override the core palette by hand, `--site-accent` falls back to `--primary`.

| Variable                | Default                     | What it controls                                 |
| ----------------------- | --------------------------- | ------------------------------------------------ |
| `--site-accent`         | `var(--primary)`            | Editorial accent (links, thread connector dots)  |
| `--site-accent-text`    | `var(--primary-foreground)` | Text on the site accent color                    |
| `--site-page-bg`        | `var(--background)`         | Overall page background                          |
| `--site-elevated-bg`    | `var(--background)`         | Main content area and overlays (menus, popovers) |
| `--site-nav-hover-bg`   | `var(--accent)`             | Navigation hover background                      |
| `--site-text-primary`   | `var(--foreground)`         | Primary text                                     |
| `--site-text-secondary` | `var(--muted-foreground)`   | Secondary / caption text                         |
| `--site-divider`        | `var(--border)`             | Content dividers                                 |
| `--site-threadline`     | `var(--border)`             | Thread connection lines                          |
| `--site-column-outline` | `var(--border)`             | Base color used to derive content block outlines |
| `--site-media-outline`  | `var(--border)`             | Image / video border                             |
| `--search-mark-bg`      | Built-in yellow             | Search result highlight background               |
| `--search-mark-color`   | Built-in dark text          | Search result highlight text                     |

### Example: custom primary and site accent

```css
:root {
  --primary: oklch(0.48 0.08 255);
  --primary-foreground: oklch(0.98 0 0);
  --site-accent: oklch(0.56 0.06 240);
}

@media (prefers-color-scheme: dark) {
  :root {
    --primary: oklch(0.79 0.06 255);
    --primary-foreground: oklch(0.19 0.01 255);
    --site-accent: oklch(0.74 0.07 240);
  }
}
```

### Example: colored thread connectors

```css
:root {
  --site-threadline: oklch(0.8 0.05 250);
}
```

## Typography variables

| Variable            | Default                      | What it controls                                                  |
| ------------------- | ---------------------------- | ----------------------------------------------------------------- |
| `--font-body`       | System sans-serif            | Body text, inputs                                                 |
| `--font-heading`    | Editorial serif stack        | Post titles and h1–h3                                             |
| `--font-site-title` | Editorial serif stack        | Site logo (header)                                                |
| `--font-ui`         | System sans-serif            | Buttons, navigation, labels, badges (not affected by font themes) |
| `--font-serif`      | System serif + Noto fallback | Serif accent text                                                 |
| `--font-blockquote` | `inherit`                    | Blockquote font family; defaults to the body font                 |
| `--font-mono`       | System monospace             | Code blocks                                                       |
| `--fw-light`        | 300                          | Light accents                                                     |
| `--fw-regular`      | 400                          | Body text                                                         |
| `--fw-medium`       | 500                          | Labels, active nav                                                |
| `--fw-semibold`     | 600                          | Headings, buttons                                                 |
| `--fw-bold`         | 700                          | Strong emphasis                                                   |
| `--fw-extrabold`    | 800                          | Site logo                                                         |

When you pick a font theme in **Settings > Font Theme**, `--font-heading`, `--font-body`, and a few related font weights switch with it. `--font-ui` is intentionally left out — buttons, navigation, and other interface text always stay system sans-serif for legibility. You can still override any variable in Custom CSS for further tuning.

To use external font sources like Google Fonts, load the font files first via [code injection](code-injection.md#recipe-custom-fonts), then point the variables at the new fonts in Custom CSS.

### Example: lighter font weights

```css
:root {
  --fw-medium: 400;
  --fw-semibold: 500;
}
```

## Layout variables

| Variable              | Default  | What it controls           |
| --------------------- | -------- | -------------------------- |
| `--content-max-width` | `42rem`  | Maximum content width      |
| `--site-padding`      | `1.5rem` | Horizontal padding         |
| `--content-gap`       | `1rem`   | Spacing between feed items |

### Example: wider content area

```css
:root {
  --content-max-width: 55rem;
}
```

### Sidenotes and indented blocks

Footnotes render as Tufte-style margin notes that float into the right gutter. A floated note anchors to the right edge of whatever block contains its `[^n]` reference, so if you give a block **inline-end (right) padding** — most commonly a padded blockquote card — that note drifts left by the padding amount.

Tell the note how far the edge is inset with `--sidenote-anchor-inset` (default `0`). Derive it from the same value you use for the padding so the two never drift apart:

```css
[data-page="post"] .post-detail-body.prose blockquote {
  --blockquote-pad-x: 1rem;
  padding-inline: var(--blockquote-pad-x);
  /* keep notes aligned with the gutter regardless of the padding above */
  --sidenote-anchor-inset: var(--blockquote-pad-x);
}
```

## Cards and media

| Variable              | Default  | What it controls            |
| --------------------- | -------- | --------------------------- |
| `--card-radius`       | `0`      | Post card corner radius     |
| `--card-padding`      | `1rem`   | Post card inner padding     |
| `--card-border-width` | `0`      | Post card border width      |
| `--card-shadow`       | `none`   | Post card shadow            |
| `--media-radius`      | `0.5rem` | Image / video corner radius |
| `--avatar-size`       | `28px`   | Header avatar size          |
| `--avatar-radius`     | `50%`    | Avatar corner radius        |

### Example: turn posts into cards

```css
:root {
  --card-radius: 12px;
  --card-padding: 1.5rem;
  --card-border-width: 1px;
  --card-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
}
```

## Data attributes

You can target specific pages or elements with these data attributes when writing selectors:

| Attribute            | Where it appears | Values                                                                       |
| -------------------- | ---------------- | ---------------------------------------------------------------------------- |
| `data-theme`         | `<html>`         | Active color theme id (`tufte`, `linen`, `frost`, …)                         |
| `data-theme-mode`    | `<html>`         | `auto`, `light`, `dark`                                                      |
| `data-page`          | Page wrapper     | `home`, `post`, `search`, `archive`, `collection`, `collections`, `featured` |
| `data-post`          | `<article>`      | Present on every post                                                        |
| `data-format`        | `<article>`      | `note`, `link`, `quote`                                                      |
| `data-post-slug`     | `<article>`      | Post slug (handy for debugging and per-post styling)                         |
| `data-post-pinned`   | `<article>`      | Present on pinned posts                                                      |
| `data-post-featured` | `<article>`      | Present on Featured posts                                                    |
| `data-feed`          | Feed container   | Wraps the post list                                                          |
| `data-authenticated` | `<body>`         | Present when logged in                                                       |

Inside each post there are three more markers: `data-post-body` (body container), `data-post-meta` (date, tags, and other metadata), and `data-post-media` (image / video area). Together they let you style any one section of a post on its own.

### Example: dividers only on the home page

```css
[data-page="home"] [data-post] {
  border-bottom: 1px solid var(--border);
  padding-bottom: 1.5rem;
}
```

### Example: style by format

```css
[data-format="quote"] [data-post-body] {
  font-family: var(--font-serif);
  font-style: italic;
}

[data-format="link"] {
  border-left: 3px solid var(--site-accent);
  padding-left: 1rem;
}
```

### Example: highlight pinned posts

```css
[data-post-pinned] {
  background: var(--muted);
  border-radius: 8px;
  padding: 1rem;
}
```

## Dark mode

Jant follows the visitor's system preference (light / dark) automatically. To set values specifically for dark mode, use a media query:

```css
:root {
  --card-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
}

@media (prefers-color-scheme: dark) {
  :root {
    --card-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  }
}
```

A site can also be forced into dark mode (ignoring the system preference). To override colors in that case, use the `:root[data-theme-mode="dark"]` selector.

## Tips

- Override variables first, write selectors second. Variables hold up better across future upgrades.
- Custom CSS has the highest priority and overrides every variable defined by the built-in theme.
- `oklch()` is convenient for color tuning. A common pattern: keep `--primary` saturated and stable for buttons; let `--site-accent` carry a softer tone for links and inline emphasis.
- Test in both light and dark. If you override a color variable in `:root`, think about whether it also needs a matching override under `@media (prefers-color-scheme: dark)` or `:root[data-theme-mode="dark"]`.

## What's next

- [Code injection](code-injection.md) — embed third-party scripts, external fonts, analytics, comments
- [Export and import](export-and-import.md) — site migration and archiving
