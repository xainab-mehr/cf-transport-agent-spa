# Analytics Setup

Google Analytics 4 tracking for the CryoFuture Transport Assistant, delivered through Google Tag Manager with Google Consent Mode v2. This document covers how the implementation works, what to do when moving to production, and the privacy decisions built into it.

## Current state

The analytics layer ships **inactive by design**. The environment variable `NEXT_PUBLIC_GTM_ID` is intentionally blank, which means no analytics scripts load, no requests reach Google, and no cookies are written. Testing and staging stay clean, and no data is collected until someone deliberately turns it on.

Verified behavior with the variable left blank:

| Check | Result |
|---|---|
| Google network requests | 0 |
| GTM scripts in DOM | 0 |
| Consent bootstrap script | Not rendered |
| Cookies written | None |
| Page errors | 0 |
| Tracked element clicks | Safe, no errors thrown |

## Going live

Set one environment variable in your production host:

```
NEXT_PUBLIC_GTM_ID=GTM-XXXXXXX
```

Use the CryoFuture container ID already running on the main site. Because the variable is read at build time, a rebuild and redeploy is required after setting it. Nothing else in the codebase needs to change.

**The GA4 measurement ID does not belong in this repository.** It is configured as a tag inside the GTM container, which keeps one source of truth for tag management and consent rules across cryofuture.com and this subdomain. If the measurement ID ever changes, it changes in GTM and this application is unaffected.

## Why Tag Manager rather than a direct GA4 snippet

Adding a standalone gtag snippet here would create a second, independent place where tags are managed. Firing GA4 through the existing container means consent rules, tag changes, and any future additions such as conversion tracking all live in one place. It also means the marketing team can adjust tracking without a code deployment.

## Consent model

The implementation registers Google Consent Mode v2 defaults **before** the container loads, with every tracking-related storage type set to denied:

| Signal | Default | Reasoning |
|---|---|---|
| `ad_storage` | denied | No advertising cookies without consent |
| `ad_user_data` | denied | No user data shared for advertising |
| `ad_personalization` | denied | No personalized advertising |
| `analytics_storage` | denied | No analytics cookies without consent |
| `functionality_storage` | granted | Required for the page to function |
| `security_storage` | granted | Required for security and fraud prevention |

A `wait_for_update` of 500ms gives the consent check time to resolve, which prevents a burst of denied-state hits on first paint.

### Handoff from the main site

CryoFuture runs **CookieYes** (the `cookie-law-info` WordPress plugin, lite tier, version 3.5.4) on cryofuture.com, configured as a CCPA style "Do Not Sell or Share" opt-out banner. Its consent record lives in the `cky-consent` cookie.

This implementation reads that cookie. If a visitor already made a choice on the main site and the cookie is scoped to `.cryofuture.com`, the choice is honored and the visitor is not asked twice. Anything missing or unrecognized leaves consent denied, which is the safe direction.

Verified behavior:

| Scenario | Consent default | Consent update |
|---|---|---|
| No prior cookie | All tracking denied | None sent, stays denied |
| Prior CookieYes accept | All tracking denied | Granted after cookie read |

### Open item worth resolving

CookieYes lite is a WordPress plugin, so it renders only on pages WordPress serves. A separately hosted application on a subdomain gets no banner and no preference center. A visitor who lands directly on this page from an email or ad has no way to express a choice.

The cookie handoff above covers returning visitors. It does not cover first-time direct arrivals. Two paths forward:

1. **Upgrade CookieYes** to a paid tier that supports cross-domain consent and native Consent Mode integration, then deploy its script on this subdomain.
2. **Add a lightweight consent notice** to this page that writes the same `cky-consent` cookie, keeping both properties consistent.

Worth confirming with whoever owns privacy review before launch. Also worth verifying in the CookieYes settings that the consent cookie is scoped to `.cryofuture.com` rather than host-only, otherwise the handoff will not work across subdomains.

Separately, note that no Consent Mode signals currently appear on cryofuture.com itself. The main site loads GTM (`GTM-WC4FR5W`) and a Google tag (`GT-NSSVNPD7`) without any `ad_storage` or `analytics_storage` declarations. This subdomain will be the stricter of the two properties once deployed.

## Events

Five events push to the GTM data layer. Create matching Custom Event triggers in the container to forward them to GA4.

| Event name | Fires when | Parameters |
|---|---|---|
| `agent_connected` | Assistant session connects successfully | none |
| `chat_started` | Visitor sends their first message | none |
| `phone_click` | Visitor taps the transportation team number | `link_location: below_chat` |
| `learn_more_click` | Mobile visitor taps through to service features | `link_location: mobile_scroll_cue` |
| `privacy_policy_click` | Visitor opens the privacy policy | `link_location: composer_footer` |

`chat_started` and `agent_connected` are guarded so they fire once per session rather than repeatedly.

## What is deliberately not tracked

This page operates in a reproductive medicine context, where anything a visitor types may constitute protected health information. The following are excluded from analytics entirely:

Message content is never sent, in either direction. Names, email addresses, phone numbers, and quote numbers are never captured. No specimen type, clinic name, or fertility benefit information is recorded. Events confirm that an interaction occurred, never what was discussed.

This is a deliberate constraint, not an oversight. Sending conversation content to analytics would create meaningful regulatory exposure and is not worth the marginal insight. If richer funnel data is needed later, the safer approach is server-side aggregation with explicit review rather than client-side event parameters.

## File map

| File | Role |
|---|---|
| `components/analytics.tsx` | GTM loader and Consent Mode bootstrap, returns null when unconfigured |
| `lib/analytics-events.ts` | Typed event helpers, fail silently, never throw |
| `app/layout.tsx` | Mounts the consent script in `head` and the noscript fallback in `body` |
| `.env.example` | Documents the variable with production guidance |

## Verification after deployment

Confirm in GTM Preview mode that the consent default fires before the container initializes, then check GA4 Realtime for a pageview. Trigger each of the five events manually and confirm they appear. Finally, inspect the network tab to verify no analytics requests carry message content or personal details.
