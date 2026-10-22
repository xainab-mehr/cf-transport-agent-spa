import Script from "next/script";

/**
 * Google Analytics 4 loader with optional Google Tag Manager support.
 *
 * Configuration is environment driven:
 *   - NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX  (Direct GA4 - simpler)
 *   - NEXT_PUBLIC_GTM_ID=GTM-XXXXXXX  (Tag Manager - more flexible)
 *
 * If both are set, GTM takes precedence. With neither set, nothing loads.
 */

const GA_ID = process.env.NEXT_PUBLIC_GA_ID?.trim();
const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID?.trim();

export function Analytics() {
  // If GTM is configured, use that (existing behavior)
  if (GTM_ID) {
    return (
      <>
        <script
          dangerouslySetInnerHTML={{
            __html: `
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('consent', 'default', {
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
  analytics_storage: 'denied',
  functionality_storage: 'granted',
  security_storage: 'granted',
  wait_for_update: 500
});
`,
          }}
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

  // If GA4 is configured directly, use the simpler gtag.js approach
  if (GA_ID) {
    return (
      <>
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
          strategy="afterInteractive"
        />
        <Script id="cf-ga4" strategy="afterInteractive">
          {`
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GA_ID}');
`}
        </Script>
      </>
    );
  }

  // Nothing configured, render nothing
  return null;
}

/** Noscript iframe fallback for GTM only */
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
