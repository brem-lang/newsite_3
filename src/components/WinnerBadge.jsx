import { Trophy } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export default function WinnerBadge({ count, className }) {
  const { t } = useI18n();
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/15 px-3 py-1 text-xs font-bold text-primary shadow-[0_4px_18px_-10px_hsl(var(--primary)/0.7)]",
        className
      )}
    >
      <Trophy className="w-3.5 h-3.5" />
      {t.account.status.won}
      {count ? <span className="tabular-nums opacity-80">×{count}</span> : null}
    </span>
  );
}