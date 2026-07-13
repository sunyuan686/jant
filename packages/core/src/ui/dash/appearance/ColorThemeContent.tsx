/**
 * Color theme picker
 */

import type { MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { useLingui } from "../../../i18n/context.js";
import { toPublicPath } from "../../../lib/url.js";
import type { ThemeMode } from "../../../types/config.js";
import type { ColorTheme } from "../../color-themes.js";

function toInlineStyle(variables: Record<string, string>): string {
  return Object.entries(variables)
    .map(([key, value]) => `${key}:${value}`)
    .join(";");
}

function getThemePreviewColor(
  variables: Record<string, string>,
  keys: string[],
  fallback: string,
): string {
  for (const key of keys) {
    const value = variables[key];
    if (value) {
      return value;
    }
  }

  return fallback;
}

function getPreviewVariables(theme: ColorTheme): Record<string, string> {
  return {
    "--preview-bg-light": getThemePreviewColor(
      theme.light,
      ["--background", "--card", "--popover"],
      "transparent",
    ),
    "--preview-fg-light": getThemePreviewColor(
      theme.light,
      ["--foreground", "--card-foreground", "--popover-foreground"],
      "currentColor",
    ),
    "--preview-border-light": getThemePreviewColor(
      theme.light,
      ["--border", "--foreground"],
      "currentColor",
    ),
    "--preview-muted-light": getThemePreviewColor(
      theme.light,
      ["--muted-foreground", "--foreground"],
      "currentColor",
    ),
    "--preview-primary-light": getThemePreviewColor(
      theme.light,
      ["--site-accent", "--primary", "--foreground"],
      "currentColor",
    ),
    "--preview-bg-dark": getThemePreviewColor(
      theme.dark,
      ["--background", "--card", "--popover"],
      "transparent",
    ),
    "--preview-fg-dark": getThemePreviewColor(
      theme.dark,
      ["--foreground", "--card-foreground", "--popover-foreground"],
      "currentColor",
    ),
    "--preview-border-dark": getThemePreviewColor(
      theme.dark,
      ["--border", "--foreground"],
      "currentColor",
    ),
    "--preview-muted-dark": getThemePreviewColor(
      theme.dark,
      ["--muted-foreground", "--foreground"],
      "currentColor",
    ),
    "--preview-primary-dark": getThemePreviewColor(
      theme.dark,
      ["--site-accent", "--primary", "--foreground"],
      "currentColor",
    ),
  };
}

function ThemeModeCard({
  value,
  currentThemeMode,
  title,
  description,
}: {
  value: ThemeMode;
  currentThemeMode: ThemeMode;
  title: string;
  description: string;
}) {
  const expr = `$themeMode === '${value}'`;

  return (
    <label
      class={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-colors ${value === currentThemeMode ? "border-primary" : "border-border"}`}
      data-class:border-primary={expr}
      data-class:border-border={`$themeMode !== '${value}'`}
    >
      <input
        type="radio"
        name="themeMode"
        value={value}
        data-bind="themeMode"
        checked={value === currentThemeMode || undefined}
        class="mt-1"
      />
      <div>
        <div class="font-medium">{title}</div>
        <div class="text-sm text-muted-foreground">{description}</div>
      </div>
    </label>
  );
}

interface ThemeCopy {
  title: MessageDescriptor;
  body: MessageDescriptor;
  help: MessageDescriptor;
}

/**
 * Per-theme preview copy: a plain description of each palette — what the
 * background and accent look like, and when it fits. Keyed by theme id;
 * unknown ids fall back to FALLBACK_COPY.
 */
const THEME_COPY: Record<string, ThemeCopy> = {
  tufte: {
    title: msg({
      message: "Warm ivory",
      comment: "@context: Tufte color theme preview title",
    }),
    body: msg({
      message: "Off-white paper with a deep forest-green accent.",
      comment: "@context: Tufte color theme preview body",
    }),
    help: msg({
      message: "The default. Calm and easy for long reading.",
      comment: "@context: Tufte color theme preview help line",
    }),
  },
  linen: {
    title: msg({
      message: "Warm cream",
      comment: "@context: Linen color theme preview title",
    }),
    body: msg({
      message: "Soft cream background with a muted green accent.",
      comment: "@context: Linen color theme preview body",
    }),
    help: msg({
      message: "The original Jant palette, and a solid everyday pick.",
      comment: "@context: Linen color theme preview help line",
    }),
  },
  frost: {
    title: msg({
      message: "Cool white",
      comment: "@context: Frost color theme preview title",
    }),
    body: msg({
      message: "Pale cool-white with deep indigo text. High contrast.",
      comment: "@context: Frost color theme preview body",
    }),
    help: msg({
      message: "When you want a cooler, sharper look.",
      comment: "@context: Frost color theme preview help line",
    }),
  },
  cotton: {
    title: msg({
      message: "Soft ivory",
      comment: "@context: Cotton color theme preview title",
    }),
    body: msg({
      message: "Very light ivory with a faint tea-green accent.",
      comment: "@context: Cotton color theme preview body",
    }),
    help: msg({
      message: "Nearly white, with a touch of warmth.",
      comment: "@context: Cotton color theme preview help line",
    }),
  },
  bone: {
    title: msg({
      message: "Warm off-white",
      comment: "@context: Bone color theme preview title",
    }),
    body: msg({
      message: "Pale bone-white with a muted green accent.",
      comment: "@context: Bone color theme preview body",
    }),
    help: msg({
      message: "Warm-neutral and easy for long reading.",
      comment: "@context: Bone color theme preview help line",
    }),
  },
  parchment: {
    title: msg({
      message: "Warm parchment",
      comment: "@context: Parchment color theme preview title",
    }),
    body: msg({
      message: "Yellow-tinted paper with an olive-green accent.",
      comment: "@context: Parchment color theme preview body",
    }),
    help: msg({
      message: "A warmer look, like slightly aged paper.",
      comment: "@context: Parchment color theme preview help line",
    }),
  },
  dune: {
    title: msg({
      message: "Warm sand",
      comment: "@context: Dune color theme preview title",
    }),
    body: msg({
      message: "Sandy background with a green accent.",
      comment: "@context: Dune color theme preview body",
    }),
    help: msg({
      message: "Warm and earthy, but still light.",
      comment: "@context: Dune color theme preview help line",
    }),
  },
  ink: {
    title: msg({
      message: "Neutral gray",
      comment: "@context: Ink color theme preview title",
    }),
    body: msg({
      message: "Near-neutral light gray with a steel-blue accent.",
      comment: "@context: Ink color theme preview body",
    }),
    help: msg({
      message: "Minimal color, low distraction.",
      comment: "@context: Ink color theme preview help line",
    }),
  },
  slate: {
    title: msg({
      message: "Cool blue-gray",
      comment: "@context: Slate color theme preview title",
    }),
    body: msg({
      message: "Light blue-gray background, cool and even.",
      comment: "@context: Slate color theme preview body",
    }),
    help: msg({
      message: "A calm, cool backdrop.",
      comment: "@context: Slate color theme preview help line",
    }),
  },
  sage: {
    title: msg({
      message: "Soft green",
      comment: "@context: Sage color theme preview title",
    }),
    body: msg({
      message: "Light sage-green with a matching green accent.",
      comment: "@context: Sage color theme preview body",
    }),
    help: msg({
      message: "Calm and natural, easy on the eyes.",
      comment: "@context: Sage color theme preview help line",
    }),
  },
  clay: {
    title: msg({
      message: "Warm terracotta",
      comment: "@context: Clay color theme preview title",
    }),
    body: msg({
      message: "Muted red-brown background, earthy and warm.",
      comment: "@context: Clay color theme preview body",
    }),
    help: msg({
      message: "An earthier, warmer tone.",
      comment: "@context: Clay color theme preview help line",
    }),
  },
  ember: {
    title: msg({
      message: "Warm orange",
      comment: "@context: Ember color theme preview title",
    }),
    body: msg({
      message: "Orange-tinted background. The warmest palette.",
      comment: "@context: Ember color theme preview body",
    }),
    help: msg({
      message: "Cozy and bold among the warm tones.",
      comment: "@context: Ember color theme preview help line",
    }),
  },
  paper: {
    title: msg({
      message: "Bright paper white",
      comment: "@context: Paper color theme preview title",
    }),
    body: msg({
      message: "Bright warm-white with a moss-green accent.",
      comment: "@context: Paper color theme preview body",
    }),
    help: msg({
      message: "Clean and high-contrast, close to white.",
      comment: "@context: Paper color theme preview help line",
    }),
  },
  snow: {
    title: msg({
      message: "Pure white",
      comment: "@context: Snow color theme preview title",
    }),
    body: msg({
      message: "Pure white with neutral grays. No color tint.",
      comment: "@context: Snow color theme preview body",
    }),
    help: msg({
      message: "The cleanest, most neutral option.",
      comment: "@context: Snow color theme preview help line",
    }),
  },
  espresso: {
    title: msg({
      message: "Cream and coffee brown",
      comment: "@context: Espresso color theme preview title",
    }),
    body: msg({
      message: "Warm cream background with deep coffee-brown accents.",
      comment: "@context: Espresso color theme preview body",
    }),
    help: msg({
      message: "Warm and rich, with strong brown tones.",
      comment: "@context: Espresso color theme preview help line",
    }),
  },
};

const EXAMPLE_LINK = msg({
  message: "Example link",
  comment:
    "@context: Placeholder link label shown in color theme preview cards",
});

const ACCENT_LABEL = msg({
  message: "Accent",
  comment:
    "@context: Label next to the theme accent-color swatch in a color theme preview card",
});

const FALLBACK_COPY: ThemeCopy = {
  title: msg({
    message: "This palette",
    comment: "@context: Fallback color theme preview title",
  }),
  body: msg({
    message: "Headings, body text, and links in this theme.",
    comment: "@context: Fallback color theme preview body",
  }),
  help: msg({
    message: "Pick the one that fits your writing.",
    comment: "@context: Fallback color theme preview help line",
  }),
};

function ThemePreview({ theme }: { theme: ColorTheme }) {
  const { i18n } = useLingui();
  const copy = THEME_COPY[theme.id] ?? FALLBACK_COPY;

  return (
    <div class="min-w-0">
      <div class="theme-preview-meta">
        <span class="theme-preview-name text-[0.95rem]">{theme.name}</span>
      </div>

      <div class="theme-preview-divider mt-2 border-t pt-2">
        <h3 class="theme-preview-title text-[0.98rem]">{i18n._(copy.title)}</h3>

        <p class="theme-preview-body mt-2 text-[0.84rem]">
          {i18n._(copy.body)}{" "}
          <a class="theme-preview-link" tabIndex={-1}>
            {i18n._(EXAMPLE_LINK)}
          </a>{" "}
          <span aria-hidden="true">&middot;</span>{" "}
          <span class="theme-preview-accent">
            <span class="theme-preview-swatch" aria-hidden="true"></span>
            {i18n._(ACCENT_LABEL)}
          </span>
        </p>
        <p class="theme-preview-meta mt-1.5 text-[0.8rem]">
          {i18n._(copy.help)}
        </p>

        <div class="theme-preview-divider mt-3 border-t pt-2">
          <div class="theme-preview-meta flex items-center gap-2 text-[0.72rem]">
            <span>
              {i18n._(
                msg({
                  message: "March 14",
                  comment: "@context: Color theme preview date label",
                }),
              )}
            </span>
            <span aria-hidden="true">&middot;</span>
            <span>
              {i18n._(
                msg({
                  message: "Design",
                  comment: "@context: Color theme preview collection label",
                }),
              )}
            </span>
            <span aria-hidden="true">&middot;</span>
            <span>
              {i18n._(
                msg({
                  message: "Note",
                  comment: "@context: Color theme preview format label",
                }),
              )}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ThemeCard({
  theme,
  selected,
  currentThemeMode,
}: {
  theme: ColorTheme;
  selected: boolean;
  currentThemeMode: ThemeMode;
}) {
  const expr = `$theme === '${theme.id}'`;

  return (
    <label
      class={`theme-preview-panel block cursor-pointer rounded-2xl border transition-colors ${selected ? "border-primary" : "border-border"}`}
      data-class:border-primary={expr}
      data-class:border-border={`$theme !== '${theme.id}'`}
      data-theme-preview-mode={currentThemeMode}
      style={toInlineStyle(getPreviewVariables(theme))}
    >
      <div class="flex items-start gap-3 p-3">
        <input
          type="radio"
          name="theme"
          value={theme.id}
          data-bind="theme"
          checked={selected || undefined}
          class="mt-1"
        />
        <div class="flex-1">
          <ThemePreview theme={theme} />
        </div>
      </div>
    </label>
  );
}

export function ColorThemeContent({
  themes,
  currentThemeId,
  currentThemeMode,
  sitePathPrefix = "",
}: {
  themes: ColorTheme[];
  currentThemeId: string;
  currentThemeMode: ThemeMode;
  sitePathPrefix?: string;
}) {
  const { i18n } = useLingui();

  const themeSignals = JSON.stringify({
    theme: currentThemeId,
    themeMode: currentThemeMode,
  }).replace(/</g, "\\u003c");

  return (
    <div
      data-signals={themeSignals}
      data-on:change={`@post('${toPublicPath("/settings/color-theme", sitePathPrefix)}')`}
      class="max-w-form"
    >
      <fieldset>
        <legend class="text-lg font-semibold">
          {i18n._(
            msg({
              message: "Color theme",
              comment: "@context: Appearance settings heading",
            }),
          )}
        </legend>
        <p class="text-sm text-muted-foreground mb-4">
          {i18n._(
            msg({
              message:
                "Applies to your entire site, including admin pages. Pick a palette, then choose whether it follows the system or stays fixed.",
              comment: "@context: Appearance settings description",
            }),
          )}{" "}
          {i18n._(
            msg({
              message: "Want more control?",
              comment:
                "@context: Prefix before Custom CSS link on color theme page",
            }),
          )}{" "}
          <a
            href={toPublicPath("/settings/custom-css", sitePathPrefix)}
            class="underline hover:text-foreground transition-colors"
          >
            {i18n._(
              msg({
                message: "Custom CSS",
                comment:
                  "@context: Link to Custom CSS settings from color theme page",
              }),
            )}
          </a>{" "}
          {i18n._(
            msg({
              message: "lets you override any theme variable.",
              comment:
                "@context: Suffix after Custom CSS link on color theme page",
            }),
          )}
        </p>

        <div class="mb-6 grid gap-3 md:grid-cols-3">
          <ThemeModeCard
            value="auto"
            currentThemeMode={currentThemeMode}
            title={i18n._(
              msg({
                message: "Auto",
                comment: "@context: Theme mode option label",
              }),
            )}
            description={i18n._(
              msg({
                message: "Follow each visitor's system preference.",
                comment: "@context: Theme mode option description",
              }),
            )}
          />
          <ThemeModeCard
            value="light"
            currentThemeMode={currentThemeMode}
            title={i18n._(
              msg({
                message: "Light",
                comment: "@context: Theme mode option label",
              }),
            )}
            description={i18n._(
              msg({
                message: "Always show the light version of the theme.",
                comment: "@context: Theme mode option description",
              }),
            )}
          />
          <ThemeModeCard
            value="dark"
            currentThemeMode={currentThemeMode}
            title={i18n._(
              msg({
                message: "Dark",
                comment: "@context: Theme mode option label",
              }),
            )}
            description={i18n._(
              msg({
                message: "Always show the dark version of the theme.",
                comment: "@context: Theme mode option description",
              }),
            )}
          />
        </div>

        <div class="grid gap-3">
          {themes.map((theme) => (
            <ThemeCard
              key={theme.id}
              theme={theme}
              selected={theme.id === currentThemeId}
              currentThemeMode={currentThemeMode}
            />
          ))}
        </div>
      </fieldset>
    </div>
  );
}
