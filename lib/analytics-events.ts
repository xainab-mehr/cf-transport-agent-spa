/**
 * Privacy-safe analytics events for the transport assistant.
 *
 * IMPORTANT: never pass message content, names, email addresses, phone numbers,
 * quote numbers, or anything a visitor types into these functions. This page
 * operates in a reproductive medicine context, so anything a patient enters is
 * treated as protected and stays out of analytics entirely. Events record that
 * an interaction happened, never what was said.
 *
 * Events are pushed to `window.dataLayer` and picked up by triggers in the GTM
 * container. When no container is configured the pushes are harmless no-ops,
 * since nothing is listening.
 */

type EventName =
  | "agent_connected"
  | "chat_started"
  | "phone_click"
  | "learn_more_click"
  | "privacy_policy_click";

type EventParams = Record<string, string | number | boolean>;

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
  }
}

/**
 * Pushes an event to the GTM data layer.
 *
 * Fails silently and never throws, so a blocked or missing container can never
 * interfere with the conversation itself.
 */
export function trackEvent(name: EventName, params: EventParams = {}): void {
  if (typeof window === "undefined") return;

  try {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event: name, ...params });
  } catch {
    /* Analytics must never break the page. */
  }
}

/** Fired once when the assistant session successfully connects. */
export const trackAgentConnected = () => trackEvent("agent_connected");

/**
 * Fired when the visitor sends their first message.
 * Records only that the conversation began, never the message body.
 */
export const trackChatStarted = () => trackEvent("chat_started");

/** Fired when the visitor taps the transportation team phone number. */
export const trackPhoneClick = () =>
  trackEvent("phone_click", { link_location: "below_chat" });

/** Fired when a mobile visitor taps through to the service features. */
export const trackLearnMoreClick = () =>
  trackEvent("learn_more_click", { link_location: "mobile_scroll_cue" });

/** Fired when the visitor opens the privacy policy from the consent line. */
export const trackPrivacyPolicyClick = () =>
  trackEvent("privacy_policy_click", { link_location: "composer_footer" });
