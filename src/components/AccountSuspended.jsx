import React from "react";
import { ShieldAlert } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";

export default function AccountSuspended() {
  const { t } = useI18n();
  return (
    <div className="min-h-screen grid place-items-center bg-muted/30 px-4">
      <div className="max-w-md text-center space-y-4">
        <div className="w-14 h-14 rounded-full bg-destructive/10 text-destructive grid place-items-center mx-auto">
          <ShieldAlert className="w-7 h-7" />
        </div>
        <h1 className="font-display text-2xl font-bold">{t.auth.suspended}</h1>
        <p className="text-muted-foreground text-sm">{t.auth.suspendedDesc}</p>
        <Button variant="outline" onClick={() => { base44.auth.logout(); window.location.href = "/login"; }}>
          {t.common.logout}
        </Button>
      </div>
    </div>
  );
}