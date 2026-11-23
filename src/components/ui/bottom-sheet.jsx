import React from "react";
import { createPortal } from "react-dom";
import { m, AnimatePresence, useDragControls } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Native-style bottom sheet: springs up from the bottom edge, has a grab
 * handle, drags down to dismiss and respects the iOS/Android home indicator.
 *
 * Use this instead of a centered dialog for mobile flows (bid input,
 * filters, auction details).
 */
export default function BottomSheet({
  open,
  onClose,
  title,
  description,
  icon: Icon,
  children,
  footer,
  className,
  maxHeight = "88dvh",
  dismissible = true
}) {
  // Drag-to-dismiss starts only from the handle/title bar. Letting the whole
  // panel listen for vertical drags made framer-motion block touch scrolling
  // in the content (swiping a long list pulled the sheet down instead).
  const dragControls = useDragControls();
  const startDrag = (e) => { if (dismissible) dragControls.start(e); };

  // Lock background scroll while the sheet is up.
  React.useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  React.useEffect(() => {
    if (!open || !dismissible) return;
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, dismissible, onClose]);

  // Portal to <body>: sheets must escape the transformed mobile app shell,
  // otherwise `fixed` is measured against the shell instead of the viewport.
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <m.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[70] bg-background/80 backdrop-blur-[3px] flex items-end justify-center"
          onClick={() => dismissible && onClose?.()}
        >
          <m.div
            role="dialog"
            aria-modal="true"
            aria-label={typeof title === "string" ? title : undefined}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            drag={dismissible ? "y" : false}
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 110 || info.velocity.y > 700) onClose?.();
            }}
            onClick={(e) => e.stopPropagation()}
            style={{ maxHeight }}
            className={cn(
              "w-full sm:max-w-lg bg-card border-t border-primary/30 rounded-t-2xl",
              "shadow-[0_-18px_50px_-20px_hsl(var(--primary)/0.35)] flex flex-col overflow-hidden pb-safe",
              className
            )}
          >
            {/* Drag area: grab handle + title bar. touch-none so the browser
                hands the gesture to the drag instead of trying to scroll. */}
            <div onPointerDown={startDrag} className={cn("shrink-0", dismissible && "touch-none")}>
            <div className="pt-2.5 pb-1 flex justify-center cursor-grab active:cursor-grabbing">
              <span className="h-1.5 w-10 rounded-full bg-muted-foreground/30" />
            </div>

            {(title || dismissible) && (
              <div className="flex items-center justify-between gap-3 px-5 pb-3">
                <div className="min-w-0">
                  {title && (
                    <h2 className="font-display font-bold text-base text-foreground flex items-center gap-2 truncate">
                      {Icon && <Icon className="w-4 h-4 shrink-0" />}
                      {title}
                    </h2>
                  )}
                  {description && (
                    <p className="text-[12px] text-muted-foreground mt-0.5 truncate">{description}</p>
                  )}
                </div>
                {dismissible && (
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close"
                    className="w-9 h-9 shrink-0 rounded-full bg-muted grid place-items-center text-muted-foreground active:scale-95 transition"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
            </div>

            {/* The only scroller: content between the title bar and footer. */}
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 pb-4 no-scrollbar">
              {children}
            </div>

            {footer && (
              <div className="shrink-0 border-t border-border px-5 py-3 bg-card">{footer}</div>
            )}
          </m.div>
        </m.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
