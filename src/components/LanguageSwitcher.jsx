import React from "react";
import { Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export default function LanguageSwitcher({ className }) {
  const { toggleLang, t } = useI18n();
  return (
    <Button
      variant="ghost"
      size="iconSm"
      onClick={toggleLang}
      aria-label="Change language"
      className={cn("border border-border/70 bg-card/70 text-muted-foreground hover:border-primary/50 hover:bg-primary/10 hover:text-primary sm:w-auto sm:px-3", className)}
    >
      <Globe className="w-4 h-4" />
      <span className="hidden sm:inline">{t.langName}</span>
    </Button>
  );
}