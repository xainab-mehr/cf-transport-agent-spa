import type { ComponentProps, HTMLAttributes } from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"

export type MessageProps = HTMLAttributes<HTMLDivElement> & {
  from: "user" | "assistant"
}

export const Message = ({ className, from, ...props }: MessageProps) => (
  <div
    className={cn(
      "group flex w-full items-end justify-end py-2",
      from === "user" ? "is-user" : "is-assistant flex-row-reverse justify-end",
      className
    )}
    {...props}
  />
)

const messageContentVariants = cva(
  "is-user:dark flex flex-col gap-2 overflow-hidden text-sm font-light leading-relaxed",
  {
    variants: {
      variant: {
        contained: [
          "max-w-[92%] px-4 py-3 sm:max-w-[86%]",
          "group-[.is-user]:bg-cf-navy group-[.is-user]:text-white group-[.is-user]:rounded-2xl group-[.is-user]:rounded-br-md",
          "group-[.is-assistant]:bg-cf-pale/70 group-[.is-assistant]:text-cf-navy group-[.is-assistant]:rounded-2xl group-[.is-assistant]:rounded-bl-md",
        ],
        flat: [
          "group-[.is-user]:max-w-[80%] group-[.is-user]:bg-cf-pale group-[.is-user]:px-4 group-[.is-user]:py-3 group-[.is-user]:text-cf-navy group-[.is-user]:rounded-2xl",
          "group-[.is-assistant]:text-cf-navy",
        ],
      },
    },
    defaultVariants: {
      variant: "contained",
    },
  }
)

export type MessageContentProps = HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof messageContentVariants>

export const MessageContent = ({
  children,
  className,
  variant,
  ...props
}: MessageContentProps) => (
  <div
    className={cn(messageContentVariants({ variant, className }))}
    {...props}
  >
    {children}
  </div>
)

export type MessageAvatarProps = ComponentProps<typeof Avatar> & {
  src: string
  name?: string
}

export const MessageAvatar = ({
  src,
  name,
  className,
  ...props
}: MessageAvatarProps) => (
  <Avatar className={cn("ring-border size-8 ring-1", className)} {...props}>
    <AvatarImage alt="" className="mt-0 mb-0" src={src} />
    <AvatarFallback>{name?.slice(0, 2) || "ME"}</AvatarFallback>
  </Avatar>
)
