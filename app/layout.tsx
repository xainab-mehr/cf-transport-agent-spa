import type { Metadata } from "next";
import { Poppins, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Analytics, AnalyticsNoScript } from "@/components/analytics";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CryoFuture Transport Assistant",
  description:
    "Chat with the CryoFuture Transport Assistant to plan, schedule, and track secure specimen transport.",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* Consent Mode defaults load before the container. Renders nothing
            unless NEXT_PUBLIC_GTM_ID is set. */}
        <Analytics />
      </head>
      <body
        className={`${poppins.variable} ${geistMono.variable} font-sans antialiased`}
      >
        <AnalyticsNoScript />
        {children}
      </body>
    </html>
  );
}
