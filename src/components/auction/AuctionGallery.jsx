import React from "react";
import { Image } from "@/components/ui/image";
import { useI18n } from "@/lib/i18n";

export default function AuctionGallery({ auction }) {
  const { t } = useI18n();
  return (
    <div className="native-panel rounded-xl overflow-hidden">
      <div className="relative aspect-square bg-muted group">
        <Image src={auction.image_url} alt={auction.title} className="w-full h-full transition-transform duration-500 group-hover:scale-105" fittingType="fill" />
      </div>
      <div className="px-4 py-3 border-t border-border text-xs text-muted-foreground">{t.auction.gallery}: <span className="text-foreground font-bold">{auction.title}</span></div>
    </div>
  );
}