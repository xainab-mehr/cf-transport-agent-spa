"use client";

import type { LucideIcon } from "lucide-react";
import {
  BadgeCheck,
  Clock,
  Gauge,
  MapPin,
  ShieldCheck,
  Thermometer,
  Truck,
} from "lucide-react";

import { cn } from "@/lib/utils";

type Benefit = {
  icon: LucideIcon;
  title: string;
  description: string;
  /** Longer copy: renders the icon inline with the title to save height. */
  compact?: boolean;
};

const BENEFITS: Benefit[] = [
  {
    icon: Truck,
    title: "Dedicated medical couriers",
    description:
      "Trained specifically in specimen transportation, never commercial carriers.",
  },
  {
    icon: MapPin,
    title: "GPS tracking throughout",
    description:
      "Location visibility from pickup to delivery, monitored by our logistics team.",
  },
  {
    icon: Thermometer,
    title: "Temperature monitoring",
    description:
      "Internal and external readings tracked continuously in transit.",
  },
  {
    icon: Gauge,
    title: "Tilt monitoring",
    description:
      "Confirms your tank remains upright and secure for the entire journey.",
  },
  {
    icon: Clock,
    title: "24/7 logistics oversight",
    description:
      "Every shipment is actively monitored by our tissue logistics team from pickup through delivery, ensuring continuous oversight and rapid response if needed.",
    compact: true,
  },
];

/** Shared glassmorphism surface so every callout box matches. */
const GLASS_SURFACE =
  "border border-white/60 bg-white/30 shadow-[0_8px_32px_-12px_rgba(33,72,102,0.25)] backdrop-blur-xl";

/**
 * Restored glassmorphism benefit cards below the centered chat widget.
 * A distinct eyebrow, headline, and supporting paragraph provide hierarchy.
 */
export function BenefitsPanel({
  className,
  id,
}: {
  className?: string;
  id?: string;
}) {
  return (
    <div
      id={id}
      className={cn(
        "flex h-full w-full scroll-mt-20 flex-col gap-3 pt-6 pb-8 sm:pt-10 xl:gap-3",
        className
      )}
    >
      <div className="mb-5 flex max-w-[680px] shrink-0 flex-col gap-3">
        <p className="text-[9px] font-medium tracking-[0.19em] text-cf-ocean uppercase">
          Why CryoFuture Transport
        </p>
        <h2 className="cf-headline text-[clamp(1.65rem,3.2vw,2.55rem)] leading-[1.15] font-light tracking-[-0.03em] text-cf-navy">
          Your journey deserves more than standard shipping
        </h2>
        <p className="cf-subhead max-w-[65ch] text-xs leading-[1.7] font-light text-cf-slate">
          Every mile is accounted for with six layers of specialized transport
          care—from dedicated couriers through continuous logistics oversight.
        </p>
      </div>

      {/* All six feature boxes live in one grid with three equal rows, so every
          box resolves to an identical height. Row 3 holds the 24/7 oversight
          tile and the guarantee side by side. */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-2.5 sm:grid-cols-2 sm:grid-rows-[repeat(3,minmax(0,1fr))] xl:gap-3">
        {BENEFITS.map((benefit) => (
          <div
            key={benefit.title}
            className={cn(
              "group relative flex min-h-0 flex-col overflow-hidden rounded-2xl p-3.5 xl:p-4",
              benefit.compact && "px-3.5 py-3 xl:px-4 xl:py-3.5",
              GLASS_SURFACE,
              "transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/45 hover:shadow-[0_12px_36px_-12px_rgba(33,72,102,0.32)]"
            )}
          >
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/90 to-transparent"
            />

            {/* Rows 1 and 2 stack the icon above the text. Row 3 carries longer
                copy, so the icon moves inline with the title to save height. */}
            <div
              className={cn(
                "flex min-h-0 flex-1 flex-col justify-center",
                benefit.compact ? "gap-1.5" : "gap-2 xl:gap-2.5"
              )}
            >
              <div
                className={cn(
                  "flex",
                  benefit.compact
                    ? "items-center gap-2.5"
                    : "flex-col gap-2 xl:gap-2.5"
                )}
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-xl border border-white/70 bg-gradient-to-br from-cf-teal/25 to-cf-blue/25 backdrop-blur-md xl:size-9">
                  <benefit.icon
                    className="size-4 text-cf-ocean"
                    strokeWidth={1.75}
                  />
                </span>

                <p className="text-sm leading-snug font-medium text-cf-navy">
                  {benefit.title}
                </p>
              </div>

              <p
                className={cn(
                  "font-light text-cf-slate",
                  benefit.compact
                    ? "text-[12.5px] leading-[1.45]"
                    : "text-[13px] leading-relaxed"
                )}
              >
                {benefit.description}
              </p>
            </div>
          </div>
        ))}

        {/* Transport Service Guarantee. Sits in column 2 of row 3, beside
            the 24/7 oversight tile, sharing the same row height. */}
        <div
          className={cn(
            "relative flex min-h-0 flex-col justify-center overflow-hidden rounded-2xl px-3.5 py-3 xl:px-4 xl:py-3.5",
            GLASS_SURFACE
          )}
        >
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/90 to-transparent"
          />

          <div className="relative flex min-h-0 flex-1 flex-col justify-center gap-1.5">
            <div className="flex items-center gap-2.5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-xl border border-white/70 bg-gradient-to-br from-cf-teal/25 to-cf-blue/25 backdrop-blur-md xl:size-9">
                <ShieldCheck
                  className="size-4 text-cf-ocean"
                  strokeWidth={1.75}
                />
              </span>

              <p className="text-sm leading-snug font-medium text-cf-navy">
                $25,000 Transport Service Guarantee
                <span className="ml-2 inline-block rounded-full border border-cf-blue/30 bg-cf-blue/10 px-1.5 py-0.5 align-middle text-[9px] font-medium tracking-wide text-cf-ocean uppercase">
                  Included
                </span>
              </p>
            </div>

            <p className="text-[12.5px] leading-[1.45] font-light text-cf-slate">
              Included at no additional cost on every transport, with options to
              increase coverage if desired.
            </p>
          </div>
        </div>
      </div>

      {/* Closing reassurance */}
      <div
        className={cn(
          "flex shrink-0 items-center gap-2.5 rounded-2xl px-4 py-2.5 xl:py-3",
          GLASS_SURFACE
        )}
      >
        <BadgeCheck className="size-4 shrink-0 text-cf-ocean" strokeWidth={2} />
        <p className="text-[13px] leading-relaxed font-light text-cf-navy">
          Your specimens are irreplaceable. We protect them every step of the
          way.
        </p>
      </div>
    </div>
  );
}
