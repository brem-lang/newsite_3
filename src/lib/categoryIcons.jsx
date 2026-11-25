import React from "react";
import {
  Armchair, Baby, Bike, BookOpen, Building2, Camera, Car, Crown, Dumbbell, Gamepad2, Gem, Gift,
  Headphones, Home, Laptop, Palette, PawPrint, Plane, Shirt, ShoppingBag, Smartphone, Sparkles,
  Tag, Trophy, Tv, Watch, Wine,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Icons a category can use. The category's `icon` column stores the key
 * (e.g. "Watch"). Keys must stay stable: changing one breaks saved categories.
 */
export const CATEGORY_ICONS = {
  Smartphone, Laptop, Tv, Headphones, Camera, Gamepad2,
  Watch, Gem, Crown, ShoppingBag, Shirt, Sparkles,
  Car, Bike, Plane, Building2, Home, Armchair,
  Palette, BookOpen, Trophy, Dumbbell, Wine, Gift, Baby, PawPrint, Tag,
};

export const DEFAULT_CATEGORY_ICON = "Tag";

/**
 * A category's icon. Accepts a key from CATEGORY_ICONS. Older categories
 * may hold an emoji, which is shown as text. Empty or unknown values fall
 * back to a tag icon.
 */
export function CategoryIcon({ icon, className, ...props }) {
  const value = String(icon || "").trim();
  const Icon = CATEGORY_ICONS[value];
  if (Icon) return <Icon className={className} aria-hidden="true" {...props} />;
  // An emoji or short symbol (anything that isn't a plain word).
  if (value && !/^[A-Za-z0-9_-]+$/.test(value)) {
    return <span className={cn("leading-none", className)} aria-hidden="true">{value}</span>;
  }
  const Fallback = CATEGORY_ICONS[DEFAULT_CATEGORY_ICON];
  return <Fallback className={className} aria-hidden="true" {...props} />;
}
