import React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

/**
 * Drop-in for a native <select>: same props (value, onChange(e) with
 * e.target.value, <option> children, id, name, disabled, required,
 * className), drawn with the site's own dropdown (the one the Auctions sort
 * uses) instead of the operating system's list.
 *
 * - Values come back as strings, like a native select.
 * - <option value=""> works (Radix can't hold "" so it's mapped internally).
 * - Only layout classes (width, height, margin, flex, grid, inline-start
 *   padding for an icon) are kept from `className`, so a dropdown is as tall
 *   as the text fields next to it in the same form; the look comes from the trigger, so
 *   every dropdown matches. A height of h-8/h-9 or text-xs picks the small
 *   size. `triggerClassName` adds classes untouched (e.g. a status colour).
 */
const EMPTY = "__empty__";
const toRadix = (v) => (v === "" || v == null ? EMPTY : String(v));
const fromRadix = (v) => (v === EMPTY ? "" : v);

const LAYOUT =
  /^(?:[a-z0-9]+:)*-?(?:w-|min-w-|max-w-|m[trblxyse]?-|flex|shrink|grow|basis-|col-|row-|order-|self-|justify-self-|hidden$|block$|inline|ps-|pe-|pl-|h-\d|h-\[)/;

function readOptions(children) {
  const out = [];
  const walk = (nodes) =>
    React.Children.forEach(nodes, (child) => {
      if (!React.isValidElement(child)) return;
      if (child.type === React.Fragment || child.type === "optgroup") return walk(child.props.children);
      if (child.type !== "option") return;
      const { value, children: label, disabled } = child.props;
      const v = value ?? (typeof label === "string" ? label : "");
      out.push({ value: String(v), label, disabled: !!disabled });
    });
  walk(children);
  return out;
}

const SelectField = React.forwardRef(function SelectField(
  {
    value,
    defaultValue,
    onChange,
    onValueChange,
    children,
    className,
    id,
    name,
    disabled,
    required,
    placeholder,
    size,
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledby,
    title,
    dir,
    // Extra trigger classes kept as-is (e.g. a status colour).
    triggerClassName,
  },
  ref
) {
  const options = readOptions(children);
  const classes = String(className || "").split(/\s+/).filter(Boolean);
  const small = size === "sm" || classes.some((c) => /^(h-[5-9]|py-[0-1](\.5)?|text-xs)$/.test(c.replace(/^[a-z]+:/, "")));
  const kept = classes.filter((c) => LAYOUT.test(c));
  // A native select with no width sizes to its content; the trigger would
  // stretch to full width, so match the native behaviour.
  if (!kept.some((c) => /(^|:)w-/.test(c))) kept.unshift("w-auto");
  const layout = kept.join(" ");

  const handle = (v) => {
    const next = fromRadix(v);
    onValueChange?.(next);
    onChange?.({ target: { value: next, name, id }, currentTarget: { value: next, name, id } });
  };

  return (
    <Select
      value={value === undefined ? undefined : toRadix(value)}
      defaultValue={defaultValue === undefined ? undefined : toRadix(defaultValue)}
      onValueChange={handle}
      disabled={disabled}
      required={required}
      name={name}
    >
      <SelectTrigger
        ref={ref}
        id={id}
        size={small ? "sm" : "default"}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledby}
        title={title}
        dir={dir}
        className={cn(small && "text-xs", layout, triggerClassName)}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      {/* Above dialogs and bottom sheets (z-[70]) it may open from. */}
      <SelectContent className="z-80">
        {/* Index in the key: lists like dial codes repeat values (+1 for
            several countries), which a native <select> allows. */}
        {options.map((o, i) => (
          <SelectItem key={`${i}:${o.value}`} value={toRadix(o.value)} disabled={o.disabled} className={small ? "text-xs" : undefined}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
});

export default SelectField;
export { SelectField };
