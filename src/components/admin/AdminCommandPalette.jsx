import React, { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useI18n } from "@/lib/i18n";
import { GROUPS, SECTIONS, sectionLabel } from "@/lib/adminNav";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";

export default function AdminCommandPalette({ open, onOpenChange, basePath }) {
  const { t } = useI18n();
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  const go = (id) => {
    onOpenChange(false);
    navigate({ to: "/admin/$section", params: { section: id } });
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder={t.admin.searchPlaceholder || "Jump to a section…"} />
      <CommandList>
        <CommandEmpty>{t.common?.noResults || "No results"}</CommandEmpty>
        {GROUPS.map((g) => (
          <CommandGroup key={g.id} heading={g.label(t)}>
            {g.items.map((id) => {
              const Icon = SECTIONS[id]?.icon;
              return (
                <CommandItem key={id} value={`${g.label(t)} ${sectionLabel(t, id)} ${id}`} onSelect={() => go(id)}>
                  {Icon && <Icon className="me-2 w-4 h-4" />}
                  {sectionLabel(t, id)}
                </CommandItem>
              );
            })}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  );
}
