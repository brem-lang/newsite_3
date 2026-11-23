"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { cva } from "class-variance-authority"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

const Dialog = DialogPrimitive.Root

const DialogTrigger = DialogPrimitive.Trigger

const DialogPortal = DialogPrimitive.Portal

const DialogClose = DialogPrimitive.Close

const DialogOverlay = React.forwardRef(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props} />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName


// Width scale for dialogs: sm = confirmations and single-field prompts,
// md = standard forms (default), lg = wide forms/tables, xl = detail views.
const dialogSizes = cva("", {
  variants: {
    size: {
      sm: "max-w-md",
      md: "max-w-lg",
      lg: "max-w-2xl",
      xl: "max-w-5xl",
    },
  },
  defaultVariants: { size: "md" },
})

const isSlot = (node, Comp) => React.isValidElement(node) && node.type === Comp

/** Direct children (fragments flattened) that are header/footer, or wrap one. */
const hasSlotChild = (children) =>
  React.Children.toArray(children).some((c) => isSlot(c, DialogHeader) || isSlot(c, DialogFooter))

/*
 * Split children into [header] [scrolling body] [footer], so the scrollbar
 * covers only the body and the title and actions never move.
 *
 * Header/footer are found among the direct children. A wrapper that holds them
 * (DialogForm, or e.g. <Tabs className="contents">) is entered and split the
 * same way; such wrappers must be display: contents so the three parts stay
 * flex items of the dialog box.
 */
function splitDialogChildren(children, scrollClassName) {
  const items = React.Children.toArray(children)
  const wrapperIndex = items.findIndex(
    (c) => React.isValidElement(c) && !isSlot(c, DialogHeader) && !isSlot(c, DialogFooter) && hasSlotChild(c.props.children)
  )
  if (wrapperIndex !== -1 && !items.some((c) => isSlot(c, DialogHeader) || isSlot(c, DialogFooter))) {
    return items.map((c, i) =>
      i === wrapperIndex ? React.cloneElement(c, undefined, splitDialogChildren(c.props.children, scrollClassName)) : c
    )
  }

  const headers = []
  const footers = []
  const body = []
  items.forEach((c) => {
    if (isSlot(c, DialogHeader)) headers.push(c)
    else if (isSlot(c, DialogFooter)) footers.push(c)
    else body.push(c)
  })

  return [
    ...headers,
    body.length > 0 && (
      <div
        key="dialog-body"
        data-slot="dialog-body"
        className={cn(
          "grid min-h-0 flex-1 content-start gap-4 overflow-y-auto overscroll-contain px-6",
          headers.length ? "pt-4" : "pt-6",
          footers.length ? "pb-4" : "pb-6",
          scrollClassName
        )}
      >
        {body}
      </div>
    ),
    ...footers,
  ]
}

/*
 * Layout: the outer box is fixed and never taller than the visible viewport
 * (dvh, so mobile toolbars and the keyboard are respected). DialogHeader and
 * DialogFooter sit outside the scroller; only the content between them
 * scrolls. The close button is pinned to the box, so it never scrolls away.
 */
const DialogContent = React.forwardRef(({ className, children, scrollClassName, size, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-1/2 top-1/2 z-50 flex w-[calc(100%-2rem)] max-h-[calc(100dvh-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
        dialogSizes({ size }),
        className
      )}
      {...props}>
      {splitDialogChildren(children, scrollClassName)}
      <DialogPrimitive.Close
        className="absolute end-4 top-4 z-20 grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent/40 disabled:pointer-events-none cursor-pointer">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
))
DialogContent.displayName = DialogPrimitive.Content.displayName

// Fixed above the scrolling body; end padding keeps titles clear of the X.
function DialogHeader({
  className,
  ...props
}) {
  return (
    <div
      data-slot="dialog-header"
      className={cn(
        "flex shrink-0 flex-col gap-1.5 border-b border-border bg-background px-6 pt-5 pb-4 pe-14 text-start",
        className
      )}
      {...props} />
  )
}
DialogHeader.displayName = "DialogHeader"

// Optional wrapper for the scrolling content between header and footer.
const DialogBody = ({
  className,
  ...props
}) => (
  <div className={cn("grid gap-4", className)} {...props} />
)
DialogBody.displayName = "DialogBody"

// Wraps header, body and footer in a real <form> so Enter submits and the
// browser checks required/min/type. display: contents keeps the fixed
// header / scrolling body / fixed footer layout intact.
const DialogForm = React.forwardRef(({ className, ...props }, ref) => (
  <form ref={ref} className={cn("contents", className)} {...props} />
))
DialogForm.displayName = "DialogForm"

// Fixed below the scrolling body, so actions are always reachable.
function DialogFooter({
  className,
  ...props
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex shrink-0 flex-col-reverse gap-2 border-t border-border bg-background px-6 py-4 sm:flex-row sm:justify-end",
        className
      )}
      {...props} />
  )
}
DialogFooter.displayName = "DialogFooter"

const DialogTitle = React.forwardRef(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold leading-tight tracking-tight", className)}
    {...props} />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props} />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogForm,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}
