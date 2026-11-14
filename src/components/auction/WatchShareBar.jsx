import React from "react";
import { Heart, Share2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export default function WatchShareBar({ watched, onWatch, onShare }) {
  const { t } = useI18n();
  return (
    <div className="flex items-center gap-2 shrink-0">
      <Button
        type="button"
        variant="outline"
        onClick={onWatch}
        className={cn(
          "h-9 gap-1.5 px-3 text-xs font-bold",
          watched ? "border-primary bg-primary/15 text-primary" : "text-muted-foreground"
        )}
      >
        <Heart className={cn("w-4 h-4", watched && "fill-current")} /> {watched ? t.auction.watching : t.auction.watch}
      </Button>
      <Button
        type="button"
        variant="outline"
        onClick={onShare}
        className="h-9 gap-1.5 px-3 text-xs font-bold text-muted-foreground"
      >
        <Share2 className="w-4 h-4" /> {t.auction.share}
      </Button>
    </div>
  );
}