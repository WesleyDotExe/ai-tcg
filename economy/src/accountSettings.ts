// The owner's account settings (owner 2026-11-01: "theme, background choice,
// sound and music, and 'the skip hint has been seen', saved to the owner's
// account"). One row per owner, written the first time the owner changes
// anything; an owner who never has reads the defaults. The lists here are
// the website's (render/reference/owner-web-mockup.html and the owner's
// 2026-11-01 Season 0 spec): three themes, the six liquid backgrounds
// (Glacier the default) and the two plain ones. Migration 15 freezes its own
// copy of them, as every migration does.

export const THEMES = ["system", "light", "dark"] as const;
export type Theme = (typeof THEMES)[number];

/** Glacier is the default (owner 2026-11-01). */
export const BACKGROUNDS = ["glacier", "ocean", "aurora", "sunset", "lavender", "graphite", "black", "purple"] as const;
export type Background = (typeof BACKGROUNDS)[number];

export interface AudioSetting {
  on: boolean;
  /** 0 to 100, whole numbers. */
  volume: number;
}

/** (v23) Settings -> Notifications (owner app spec 2026-10-05 D): which
 * kinds the owner is told about. Off means none of that kind is written
 * from then on; the ones already written stay. Auto-play switching itself
 * off has no switch: it is always told (it changes what the agent does). */
export interface NotificationSettings {
  bigPulls: boolean;
  matchResults: boolean;
  dailyPack: boolean;
}

export const NOTIFICATION_SETTINGS = ["bigPulls", "matchResults", "dailyPack"] as const;

export interface AccountSettings {
  theme: Theme;
  background: Background;
  sound: AudioSetting;
  music: AudioSetting;
  /** The "tap to skip" hint under a boast's or an intro's Skip: once the
   * owner has skipped one in the website, it isn't shown again (owner
   * 2026-11-01, render session 43 call 2). */
  skipHintSeen: boolean;
  /** (v21) Settings -> Play, "Ask for 2× in every match" (owner app spec
   * 2026-10-05 D): when on, the owner's side asks for 2× as each of its
   * live matches starts, as if the owner had tapped "Ask for 2×" at once.
   * The match still runs at 1× until the other side agrees too. */
  ask2xEveryMatch: boolean;
  /** (v23) Settings -> Notifications. */
  notifications: NotificationSettings;
  /** When the owner last changed a setting; null while every one is the
   * default and nothing was ever saved. */
  updatedAt: string | null;
}

/** What a new account reads. The volumes are the replays' slider defaults
 * (render: effects 80, music 60); sound and music start on, as they do in
 * the replays. */
export const DEFAULT_ACCOUNT_SETTINGS: Readonly<Omit<AccountSettings, "updatedAt">> = Object.freeze({
  theme: "system",
  background: "glacier",
  sound: Object.freeze({ on: true, volume: 80 }),
  music: Object.freeze({ on: true, volume: 60 }),
  skipHintSeen: false,
  ask2xEveryMatch: false,
  notifications: Object.freeze({ bigPulls: true, matchResults: true, dailyPack: true }),
});

/** A change to the settings: any of the fields, each audio one in part. */
export interface AccountSettingsPatch {
  theme?: Theme;
  background?: Background;
  sound?: Partial<AudioSetting>;
  music?: Partial<AudioSetting>;
  skipHintSeen?: boolean;
  ask2xEveryMatch?: boolean;
  notifications?: Partial<NotificationSettings>;
}

const PATCH_FIELDS = ["theme", "background", "sound", "music", "skipHintSeen", "ask2xEveryMatch", "notifications"] as const;
const AUDIO_FIELDS = ["on", "volume"] as const;

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** Why `patch` isn't a valid change, or undefined when it is. It takes
 * anything (a parsed request body) and names the first problem: an unknown
 * field, a wrong type, a theme or background not on the list, a volume
 * outside 0-100 or not whole. An empty patch is valid (it changes nothing). */
export function accountSettingsProblem(patch: unknown): string | undefined {
  if (!isObject(patch)) return "the settings must be an object";
  for (const key of Object.keys(patch)) {
    if (!(PATCH_FIELDS as readonly string[]).includes(key)) return `unknown setting "${key}" (settings: ${PATCH_FIELDS.join(", ")})`;
  }
  if ("theme" in patch && !(THEMES as readonly unknown[]).includes(patch.theme)) return `"theme" must be one of ${THEMES.join(", ")}`;
  if ("background" in patch && !(BACKGROUNDS as readonly unknown[]).includes(patch.background)) {
    return `"background" must be one of ${BACKGROUNDS.join(", ")}`;
  }
  for (const name of ["sound", "music"] as const) {
    if (!(name in patch)) continue;
    const audio = patch[name];
    if (!isObject(audio)) return `"${name}" must be an object ({ on, volume }, either or both)`;
    for (const key of Object.keys(audio)) {
      if (!(AUDIO_FIELDS as readonly string[]).includes(key)) return `unknown field "${name}.${key}" (fields: on, volume)`;
    }
    if ("on" in audio && typeof audio.on !== "boolean") return `"${name}.on" must be true or false`;
    if ("volume" in audio && !(Number.isInteger(audio.volume) && (audio.volume as number) >= 0 && (audio.volume as number) <= 100)) {
      return `"${name}.volume" must be a whole number from 0 to 100`;
    }
  }
  if ("skipHintSeen" in patch && typeof patch.skipHintSeen !== "boolean") return `"skipHintSeen" must be true or false`;
  if ("ask2xEveryMatch" in patch && typeof patch.ask2xEveryMatch !== "boolean") return `"ask2xEveryMatch" must be true or false`;
  if ("notifications" in patch) {
    const n = patch.notifications;
    if (!isObject(n)) return `"notifications" must be an object ({ ${NOTIFICATION_SETTINGS.join(", ")} }, any of them)`;
    for (const key of Object.keys(n)) {
      if (!(NOTIFICATION_SETTINGS as readonly string[]).includes(key)) return `unknown field "notifications.${key}" (fields: ${NOTIFICATION_SETTINGS.join(", ")})`;
      if (typeof n[key] !== "boolean") return `"notifications.${key}" must be true or false`;
    }
  }
  return undefined;
}

/** `current` with `patch` applied (the patch already checked). */
export function applyAccountSettingsPatch(current: Omit<AccountSettings, "updatedAt">, patch: AccountSettingsPatch): Omit<AccountSettings, "updatedAt"> {
  return {
    theme: patch.theme ?? current.theme,
    background: patch.background ?? current.background,
    sound: { ...current.sound, ...patch.sound },
    music: { ...current.music, ...patch.music },
    skipHintSeen: patch.skipHintSeen ?? current.skipHintSeen,
    ask2xEveryMatch: patch.ask2xEveryMatch ?? current.ask2xEveryMatch,
    notifications: { ...current.notifications, ...patch.notifications },
  };
}
