/**
 * Timezone List
 *
 * Provides a curated list of timezones for the settings UI and helpers for
 * normalizing stored values to canonical IANA timezone identifiers.
 */

export interface TimezoneEntry {
  /** Canonical IANA timezone identifier stored in settings */
  value: string;
  /** Human-readable label for the select UI */
  label: string;
  /** UTC offset string, e.g. "+08:00" */
  offset: string;
  /** Accepted IANA timezone names that map to this entry */
  iana: string[];
  /** Historical non-IANA values accepted for backwards compatibility */
  legacyValues?: string[];
}

export const TIMEZONES: TimezoneEntry[] = [
  {
    value: "Etc/GMT+12",
    label: "(UTC-12:00) International Date Line West",
    offset: "-12:00",
    iana: ["Etc/GMT+12"],
    legacyValues: ["International Date Line West"],
  },
  {
    value: "Pacific/Pago_Pago",
    label: "(UTC-11:00) American Samoa",
    offset: "-11:00",
    iana: ["Pacific/Pago_Pago", "Pacific/Midway", "Etc/GMT+11"],
    legacyValues: ["American Samoa"],
  },
  {
    value: "Pacific/Honolulu",
    label: "(UTC-10:00) Hawaii",
    offset: "-10:00",
    iana: ["Pacific/Honolulu", "Etc/GMT+10"],
    legacyValues: ["Hawaii"],
  },
  {
    value: "America/Anchorage",
    label: "(UTC-09:00) Alaska",
    offset: "-09:00",
    iana: ["America/Anchorage", "America/Juneau", "America/Nome"],
    legacyValues: ["Alaska"],
  },
  {
    value: "America/Los_Angeles",
    label: "(UTC-08:00) Pacific Time (US & Canada)",
    offset: "-08:00",
    iana: ["America/Los_Angeles", "America/Vancouver", "America/Tijuana"],
    legacyValues: ["Pacific Time (US & Canada)"],
  },
  {
    value: "America/Denver",
    label: "(UTC-07:00) Mountain Time (US & Canada)",
    offset: "-07:00",
    iana: [
      "America/Denver",
      "America/Edmonton",
      "America/Phoenix",
      "America/Boise",
    ],
    legacyValues: ["Mountain Time (US & Canada)"],
  },
  {
    value: "America/Chicago",
    label: "(UTC-06:00) Central Time (US & Canada)",
    offset: "-06:00",
    iana: [
      "America/Chicago",
      "America/Winnipeg",
      "America/Mexico_City",
      "America/Guatemala",
    ],
    legacyValues: ["Central Time (US & Canada)"],
  },
  {
    value: "America/New_York",
    label: "(UTC-05:00) Eastern Time (US & Canada)",
    offset: "-05:00",
    iana: [
      "America/New_York",
      "America/Toronto",
      "America/Detroit",
      "America/Indiana/Indianapolis",
      "America/Bogota",
      "America/Lima",
    ],
    legacyValues: ["Eastern Time (US & Canada)"],
  },
  {
    value: "America/Halifax",
    label: "(UTC-04:00) Atlantic Time (Canada)",
    offset: "-04:00",
    iana: [
      "America/Halifax",
      "America/Caracas",
      "America/Santiago",
      "America/La_Paz",
    ],
    legacyValues: ["Atlantic Time (Canada)"],
  },
  {
    value: "America/St_Johns",
    label: "(UTC-03:30) Newfoundland",
    offset: "-03:30",
    iana: ["America/St_Johns"],
    legacyValues: ["Newfoundland"],
  },
  {
    value: "America/Argentina/Buenos_Aires",
    label: "(UTC-03:00) Buenos Aires",
    offset: "-03:00",
    iana: [
      "America/Argentina/Buenos_Aires",
      "America/Sao_Paulo",
      "America/Montevideo",
    ],
    legacyValues: ["Buenos Aires"],
  },
  {
    value: "Atlantic/South_Georgia",
    label: "(UTC-02:00) Mid-Atlantic",
    offset: "-02:00",
    iana: ["Atlantic/South_Georgia", "Etc/GMT+2"],
    legacyValues: ["Mid-Atlantic"],
  },
  {
    value: "Atlantic/Azores",
    label: "(UTC-01:00) Azores",
    offset: "-01:00",
    iana: ["Atlantic/Azores", "Atlantic/Cape_Verde"],
    legacyValues: ["Azores"],
  },
  {
    value: "UTC",
    label: "(UTC+00:00) UTC",
    offset: "+00:00",
    iana: ["Etc/UTC", "UTC", "Etc/GMT", "Africa/Accra"],
  },
  {
    value: "Europe/London",
    label: "(UTC+00:00) London",
    offset: "+00:00",
    iana: ["Europe/London", "Europe/Dublin", "Europe/Lisbon"],
    legacyValues: ["London"],
  },
  {
    value: "Europe/Paris",
    label: "(UTC+01:00) Central European Time",
    offset: "+01:00",
    iana: [
      "Europe/Paris",
      "Europe/Berlin",
      "Europe/Amsterdam",
      "Europe/Rome",
      "Europe/Madrid",
      "Europe/Brussels",
      "Europe/Vienna",
      "Europe/Warsaw",
      "Europe/Prague",
      "Europe/Stockholm",
      "Europe/Oslo",
      "Europe/Copenhagen",
      "Europe/Zurich",
      "Africa/Lagos",
    ],
    legacyValues: ["Central European Time"],
  },
  {
    value: "Europe/Helsinki",
    label: "(UTC+02:00) Eastern European Time",
    offset: "+02:00",
    iana: [
      "Europe/Helsinki",
      "Europe/Athens",
      "Europe/Bucharest",
      "Europe/Istanbul",
      "Africa/Cairo",
      "Africa/Johannesburg",
      "Asia/Jerusalem",
      "Asia/Beirut",
    ],
    legacyValues: ["Eastern European Time"],
  },
  {
    value: "Europe/Moscow",
    label: "(UTC+03:00) Moscow",
    offset: "+03:00",
    iana: [
      "Europe/Moscow",
      "Europe/Minsk",
      "Asia/Baghdad",
      "Asia/Riyadh",
      "Africa/Nairobi",
      "Asia/Kuwait",
    ],
    legacyValues: ["Moscow"],
  },
  {
    value: "Asia/Tehran",
    label: "(UTC+03:30) Tehran",
    offset: "+03:30",
    iana: ["Asia/Tehran"],
    legacyValues: ["Tehran"],
  },
  {
    value: "Asia/Dubai",
    label: "(UTC+04:00) Dubai",
    offset: "+04:00",
    iana: ["Asia/Dubai", "Asia/Muscat", "Asia/Baku", "Asia/Tbilisi"],
    legacyValues: ["Dubai"],
  },
  {
    value: "Asia/Kabul",
    label: "(UTC+04:30) Kabul",
    offset: "+04:30",
    iana: ["Asia/Kabul"],
    legacyValues: ["Kabul"],
  },
  {
    value: "Asia/Karachi",
    label: "(UTC+05:00) Karachi",
    offset: "+05:00",
    iana: ["Asia/Karachi", "Asia/Tashkent", "Asia/Yekaterinburg"],
    legacyValues: ["Karachi"],
  },
  {
    value: "Asia/Kolkata",
    label: "(UTC+05:30) Mumbai",
    offset: "+05:30",
    iana: ["Asia/Kolkata", "Asia/Calcutta", "Asia/Colombo"],
    legacyValues: ["Mumbai"],
  },
  {
    value: "Asia/Kathmandu",
    label: "(UTC+05:45) Kathmandu",
    offset: "+05:45",
    iana: ["Asia/Kathmandu"],
    legacyValues: ["Kathmandu"],
  },
  {
    value: "Asia/Dhaka",
    label: "(UTC+06:00) Dhaka",
    offset: "+06:00",
    iana: ["Asia/Dhaka", "Asia/Almaty", "Asia/Omsk"],
    legacyValues: ["Dhaka"],
  },
  {
    value: "Asia/Yangon",
    label: "(UTC+06:30) Yangon",
    offset: "+06:30",
    iana: ["Asia/Yangon", "Asia/Rangoon"],
    legacyValues: ["Yangon"],
  },
  {
    value: "Asia/Bangkok",
    label: "(UTC+07:00) Bangkok",
    offset: "+07:00",
    iana: [
      "Asia/Bangkok",
      "Asia/Jakarta",
      "Asia/Ho_Chi_Minh",
      "Asia/Krasnoyarsk",
    ],
    legacyValues: ["Bangkok"],
  },
  {
    value: "Asia/Shanghai",
    label: "(UTC+08:00) Beijing",
    offset: "+08:00",
    iana: [
      "Asia/Shanghai",
      "Asia/Hong_Kong",
      "Asia/Taipei",
      "Asia/Singapore",
      "Asia/Kuala_Lumpur",
      "Asia/Makassar",
      "Asia/Irkutsk",
      "Australia/Perth",
    ],
    legacyValues: ["Beijing"],
  },
  {
    value: "Asia/Tokyo",
    label: "(UTC+09:00) Tokyo",
    offset: "+09:00",
    iana: ["Asia/Tokyo", "Asia/Seoul", "Asia/Yakutsk"],
    legacyValues: ["Tokyo"],
  },
  {
    value: "Australia/Adelaide",
    label: "(UTC+09:30) Adelaide",
    offset: "+09:30",
    iana: ["Australia/Adelaide", "Australia/Darwin"],
    legacyValues: ["Adelaide"],
  },
  {
    value: "Australia/Sydney",
    label: "(UTC+10:00) Sydney",
    offset: "+10:00",
    iana: [
      "Australia/Sydney",
      "Australia/Melbourne",
      "Australia/Brisbane",
      "Australia/Hobart",
      "Pacific/Guam",
      "Asia/Vladivostok",
    ],
    legacyValues: ["Sydney"],
  },
  {
    value: "Pacific/Noumea",
    label: "(UTC+11:00) Noumea",
    offset: "+11:00",
    iana: ["Pacific/Noumea", "Asia/Magadan", "Pacific/Guadalcanal"],
    legacyValues: ["Noumea"],
  },
  {
    value: "Pacific/Auckland",
    label: "(UTC+12:00) Auckland",
    offset: "+12:00",
    iana: ["Pacific/Auckland", "Pacific/Fiji", "Asia/Kamchatka"],
    legacyValues: ["Auckland"],
  },
  {
    value: "Pacific/Tongatapu",
    label: "(UTC+13:00) Nuku'alofa",
    offset: "+13:00",
    iana: ["Pacific/Tongatapu", "Pacific/Apia"],
    legacyValues: ["Nuku'alofa"],
  },
];

function findLegacyTimezoneEntry(value: string): TimezoneEntry | undefined {
  return TIMEZONES.find((tz) => tz.legacyValues?.includes(value));
}

function resolveRuntimeTimeZone(value: string): string | null {
  try {
    return new Intl.DateTimeFormat("en-US", { timeZone: value })
      .resolvedOptions()
      .timeZone.trim();
  } catch {
    return null;
  }
}

/**
 * Normalizes a timezone value from settings, env, or browser detection. Any
 * IANA name or fixed-offset identifier supported by the runtime is preserved;
 * historical display labels are mapped to their curated replacement. Unknown
 * values fall back to UTC.
 *
 * @param value - Timezone value to normalize
 * @returns Runtime-normalized timezone identifier or UTC
 *
 * @example
 * ```ts
 * normalizeTimeZone("Asia/Shanghai"); // "Asia/Shanghai"
 * normalizeTimeZone("Beijing"); // "Asia/Shanghai"
 * normalizeTimeZone("Unknown/Zone"); // "UTC"
 * ```
 */
export function normalizeTimeZone(value: string | null | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    return "UTC";
  }

  const runtimeTimeZone = resolveRuntimeTimeZone(trimmed);
  if (runtimeTimeZone) {
    return runtimeTimeZone;
  }

  return findLegacyTimezoneEntry(trimmed)?.value ?? "UTC";
}

/**
 * Returns whether the runtime recognizes a timezone value or the app can map
 * it from a historical display label.
 *
 * @param value - Timezone value to validate
 * @returns `true` when the value can be normalized safely
 */
export function isSupportedTimeZone(value: string | null | undefined): boolean {
  const trimmed = value?.trim();
  if (!trimmed) {
    return false;
  }

  return (
    resolveRuntimeTimeZone(trimmed) !== null ||
    findLegacyTimezoneEntry(trimmed) !== undefined
  );
}

/**
 * Returns the curated settings options plus a valid current value that is not
 * already represented. This keeps the UI compact without losing an IANA zone
 * or fixed offset detected outside the curated list.
 *
 * @param currentValue - Current stored timezone value
 * @returns Timezone options that can represent the current setting
 */
export function getTimeZoneOptions(currentValue: string): TimezoneEntry[] {
  const normalized = normalizeTimeZone(currentValue);
  if (TIMEZONES.some((timezone) => timezone.value === normalized)) {
    return TIMEZONES;
  }

  return [
    ...TIMEZONES,
    {
      value: normalized,
      label: normalized,
      offset: "",
      iana: [normalized],
    },
  ];
}

/**
 * Maps an IANA timezone name from the browser to the canonical stored value.
 *
 * @param iana - IANA timezone identifier from `Intl.DateTimeFormat`
 * @returns Canonical IANA timezone identifier used by Jant
 */
export function mapIanaToTimezone(iana: string): string {
  return normalizeTimeZone(iana);
}
