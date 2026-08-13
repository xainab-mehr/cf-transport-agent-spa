import Script from "next/script";

/**
 * Google Tag Manager loader with Google Consent Mode v2.
 *
 * Configuration is entirely environment driven. With no container ID set,
 * this component renders nothing at all, so local development and staging
 * stay completely free of analytics requests.
 *
 * Required for production:
 *   NEXT_PUBLIC_GTM_ID=GTM-XXXXXXX
 *
 * The GA4 measurement ID is deliberately NOT referenced here. GA4 fires as a
 * tag inside the GTM container, which keeps a single source of truth for tag
 * management and consent rules across cryofuture.com and this subdomain.
 *
 * Consent posture:
 *   All storage types default to "denied" before GTM loads. Nothing that
 *   writes a cookie or identifier can fire until consent is granted. If a
 *   visitor already made a choice on the main WordPress site, the CookieYes
 *   cookie is read and that choice is honored without asking again.
 */

const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID?.trim();

/**
 * Consent Mode v2 defaults plus CookieYes handoff.
 *
 * Runs before the GTM snippet so the default state is registered first.
 * `wait_for_update` gives the cookie check time to resolve, which prevents
 * a burst of denied-state hits on first paint.
 */
const CONSENT_BOOTSTRAP = `
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}

/* Deny everything until we have a signal. Order matters: this must run
   before the container loads. */
gtag('consent', 'default', {
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
  analytics_storage: 'denied',
  functionality_storage: 'granted',
  security_storage: 'granted',
  wait_for_update: 500
});

/* Honor a prior choice made on cryofuture.com. CookieYes stores its record
   in the "cky-consent" cookie; when the cookie is scoped to .cryofuture.com
   it is readable from this subdomain, so a returning visitor is not asked
   twice. Absent or unrecognized values leave the denied default in place. */
try {
  var match = document.cookie.match(/(?:^|;\\s*)cky-consent=([^;]*)/);
  var record = match ? decodeURIComponent(match[1]) : null;

  if (record === 'yes') {
    gtag('consent', 'update', {
      ad_storage: 'granted',
      ad_user_data: 'granted',
      ad_personalization: 'granted',
      analytics_storage: 'granted'
    });
  }
} catch (e) {
  /* Any parsing failure leaves consent denied, which is the safe direction. */
}

/* Signals to the container that Consent Mode is managed here rather than by
   a CMP template inside GTM. */
gtag('set', 'developer_id.dNzMwOD', true);
`;

export function Analytics() {
  if (!GTM_ID) return null;

  return (
    <>
      {/* Plain script tag rather than next/script: Consent Mode defaults must be
          registered synchronously before the container loads, and in the App
          Router the `beforeInteractive` strategy is only valid in a custom
          Document. Inlining here guarantees execution order. */}
      <script
        dangerouslySetInnerHTML={{ __html: CONSENT_BOOTSTRAP }}
        id="cf-consent-default"
      />

      <Script id="cf-gtm" strategy="afterInteractive">
        {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${GTM_ID}');`}
      </Script>
    </>
  );
}

/** Noscript iframe fallback, rendered directly after the opening body tag. */
export function AnalyticsNoScript() {
  if (!GTM_ID) return null;

  return (
    <noscript>
      <iframe
        height="0"
        src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
        style={{ display: "none", visibility: "hidden" }}
        title="Google Tag Manager"
        width="0"
      />
    </noscript>
  );
}
