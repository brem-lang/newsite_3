import * as React from "react"

import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"

const LINKABLE = new Set(["input", "select", "textarea"])

// True for a native form control or a component that forwards `id` to one
// (Input, Textarea). Composite widgets (pickers, wrappers) are left alone.
function isLinkable(el) {
  if (!React.isValidElement(el)) return false
  if (typeof el.type === "string") return LINKABLE.has(el.type)
  const name = el.type?.displayName || el.type?.name
  return name === "Input" || name === "Textarea"
}

/**
 * Label + control, linked for click-to-focus and screen readers. The first
 * direct child that is a form control gets the id (generated unless it already
 * has one); hints and other siblings render unchanged.
 *
 *   <FormField label="Title"><Input value={…} onChange={…} /></FormField>
 */
export function FormField({ label, children, className, labelClassName }) {
  const autoId = React.useId()
  let id
  const linked = React.Children.map(children, (child) => {
    if (id || !isLinkable(child)) return child
    id = child.props.id || autoId
    return child.props.id ? child : React.cloneElement(child, { id })
  })
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id} className={labelClassName}>{label}</Label>
      {linked}
    </div>
  )
}
