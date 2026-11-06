// Notifications (schema v23; owner 2026-11-05 and 2026-11-06: the top bar's
// bell and the Notifications widget). The Season 0 list, from the 2026-10-05
// spec's Settings -> Notifications (big pulls, match results, the free daily
// pack ready) plus what the owner added: auto-play switched off at the day's
// rewards cap, and "your agent's time is up".
//
// The store writes each one in the same transaction as what caused it
// (store.ts, "notifications"), so a notification exists exactly when its
// event does. This file is the shapes and the switches.

import type { Finish } from "./schema.js";
import type { NotificationSettings } from "./accountSettings.js";

export const NOTIFICATION_KINDS = ["matchResult", "bigPull", "dailyPack", "autoPlayStopped"] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

/** The account setting each kind is switched by; null is always on. */
export const NOTIFICATION_SWITCH: Readonly<Record<NotificationKind, keyof NotificationSettings | null>> = Object.freeze({
  matchResult: "matchResults",
  bigPull: "bigPulls",
  dailyPack: "dailyPack",
  autoPlayStopped: null,
});

/** One of the owner's matches ended (every outcome: a cancel pays nothing,
 * and the owner should know that too). From the owner's side. */
export interface MatchResultNotice {
  matchId: string;
  result: "win" | "loss" | "draw" | "cancelled" | "abandonedByYou" | "abandonedByOpponent";
  agentId: string;
  agentName: string;
  opponent: { ownerId: string; ownerName: string; agentName: string };
  /** What the match paid this owner. */
  credits: number;
  /** The owner's rating change; null for a cancel (never rated). */
  rating: { before: number; after: number; change: number } | null;
  turns: number | null;
}

/** A pack the store marks `fullReveal` was opened: Gold, a Prototype, a
 * secret card, a Zero-Day card, or a Jackpot pack. The same rule the pack
 * ceremony uses for a "big pull", so the bell and the reveal agree. */
export interface BigPullNotice {
  packId: string;
  setCode: string;
  jackpot: boolean;
  /** The cards that made it big (every card, for a Jackpot pack with no
   * such finish), in pack order. */
  cards: { copyId: string; cardId: string; name: string; rarity: string; finish: Finish; isNew: boolean; prototype: { runCode: string; serial: number; runSize: number } | null }[];
}

/** A free daily pack is waiting to be claimed. One per reset day, written
 * the first time the owner's notifications are read that day with a pack
 * waiting (nothing runs at midnight). Claiming the last waiting pack marks
 * it read. */
export interface DailyPackNotice {
  /** The reset day (Sydney) it is for, and when that day began. */
  day: string;
  readySince: string;
  waiting: number;
  cap: number;
}

/** Auto-play switched itself off: today's rewards maxed, or the play-time
 * allowance's time up (after the last match finished). */
export interface AutoPlayStoppedNotice {
  reason: "dailyRewardsMaxed" | "timeUp";
  /** The reset day the stop belongs to. */
  day: string;
  /** For "timeUp", the allowance's length in minutes; otherwise null. */
  allowanceMinutes: number | null;
}

export type NotificationBody =
  | { kind: "matchResult"; matchResult: MatchResultNotice }
  | { kind: "bigPull"; bigPull: BigPullNotice }
  | { kind: "dailyPack"; dailyPack: DailyPackNotice }
  | { kind: "autoPlayStopped"; autoPlayStopped: AutoPlayStoppedNotice };

export type Notification = NotificationBody & {
  notificationId: number;
  createdAt: string;
  readAt: string | null;
};

export interface NotificationPage {
  notifications: Notification[];
  /** More (older) notifications past this page. */
  more: boolean;
  /** Unread, not cleared, of every kind (the bell's badge), whatever the
   * page's filter. */
  unread: number;
  /** Unread per kind, for the feed's filters. */
  unreadByKind: Record<NotificationKind, number>;
}

/** The longest page, and the default. */
export const NOTIFICATION_PAGE_MAX = 100;
export const NOTIFICATION_PAGE_DEFAULT = 20;
