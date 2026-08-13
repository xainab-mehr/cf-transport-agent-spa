"use client"

import { memo, type ComponentProps } from "react"
import { Streamdown } from "streamdown"

import { cn } from "@/lib/utils"

type ResponseProps = ComponentProps<typeof Streamdown>

export const Response = memo(
  ({ className, ...props }: ResponseProps) => (
    <Streamdown
      className={cn(
        "size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
        // Compact, brand-consistent markdown rhythm inside chat bubbles
        "whitespace-normal [&_p]:my-1.5",
        // Streamdown renders lists with pre-wrap whitespace, which turns the
        // newlines between <li> tags into extra blank line boxes. Force normal
        // whitespace on lists so items sit tight together.
        "[&_ul]:my-2 [&_ol]:my-2 [&_ul]:whitespace-normal [&_ol]:whitespace-normal",
        "[&_li]:my-0 [&_li]:py-0.5 [&_li]:whitespace-normal [&_li]:leading-relaxed",
        // Indent lists and hang the markers so wrapped lines align with the
        // first line of text rather than running back under the bullet.
        "[&_ul]:list-disc [&_ol]:list-decimal",
        "[&_ul]:pl-5 [&_ol]:pl-5 [&_ul]:list-outside [&_ol]:list-outside",
        "[&_li]:pl-1 [&_li>p]:my-0",
        "[&_li_ul]:mt-1 [&_li_ul]:mb-0 [&_li_ol]:mt-1 [&_li_ol]:mb-0",
        "[&_li]:marker:text-cf-slate",
        "[&_a]:text-cf-blue [&_a]:underline [&_a]:underline-offset-2 [&_strong]:font-medium",
        "[&_h1]:text-base [&_h2]:text-base [&_h3]:text-sm [&_h1]:font-medium [&_h2]:font-medium [&_h3]:font-medium",
        "[&_code]:rounded [&_code]:bg-white/60 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[12px]",
        className
      )}
      {...props}
    />
  ),
  (prevProps, nextProps) => prevProps.children === nextProps.children
)

Response.displayName = "Response"
