import { useEffect, useLayoutEffect, useRef } from 'react';
import { profile, sections } from '../content/portfolio';
import type { SectionId } from '../room/types';
import { PortfolioContent } from './PortfolioContent';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './ui/dialog';
import { cn } from '../lib/utils';

function isVisible(element: HTMLElement | null) {
  if (!element?.isConnected || element.hidden || element.getClientRects().length === 0)
    return false;
  const style = getComputedStyle(element);
  return style.display !== 'none' && style.visibility !== 'hidden';
}

export function ContentDialog({
  section,
  onClose,
}: {
  section: SectionId | null;
  onClose(): void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLButtonElement>(null);
  const originRef = useRef<HTMLElement | null>(null);
  const sectionRef = useRef(section);
  sectionRef.current = section;
  const lastSection = useRef(section);
  if (section) lastSection.current = section;
  useLayoutEffect(() => {
    const dialog = ref.current;
    if (!section || originRef.current) return;
    const activeElement = document.activeElement as HTMLElement | null;
    if (activeElement !== document.body && !dialog?.contains(activeElement))
      originRef.current = activeElement;
  }, [section]);
  useEffect(() => {
    if (section) backRef.current?.focus({ preventScroll: true });
  }, [section]);
  const displayedSection = section ?? lastSection.current;
  const meta = sections.find((item) => item.id === displayedSection);
  return (
    <Dialog
      open={Boolean(section)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      {displayedSection && meta && (
        <DialogContent
          ref={ref}
          showCloseButton={false}
          className={cn(
            'content-dialog flex h-[calc(100dvh-24px)] w-[calc(100vw-24px)] max-w-none flex-col gap-0 overflow-hidden bg-card p-0 sm:left-auto sm:right-[4vw] sm:h-[min(840px,calc(100dvh-60px))] sm:w-[620px] sm:max-w-[calc(100vw-56px)] sm:translate-x-0',
            displayedSection === 'projects' && 'desk-reader',
          )}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            backRef.current?.focus({ preventScroll: true });
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            // A route change to the reading view owns its own destination focus.
            if (sectionRef.current !== null) return;
            const fallback = document.querySelector<HTMLElement>(
              `[data-collection="${displayedSection}"]`,
            );
            const destination = isVisible(originRef.current) ? originRef.current : fallback;
            destination?.focus({ preventScroll: true });
            originRef.current = null;
          }}
        >
          <header className="reader-header flex-wrap">
            <div>
              <p className="eyebrow">
                {meta.place} / {meta.number}
              </p>
              <DialogTitle className="font-serif text-[31px] font-normal sm:text-[38px]">
                {meta.title}
              </DialogTitle>
              <DialogDescription className="sr-only">
                {meta.title} from {profile.name}’s portfolio.
              </DialogDescription>
            </div>
            <Button
              ref={backRef}
              variant="secondary"
              className="close-reader ml-auto"
              aria-label="Back to room"
              onClick={onClose}
            >
              ↙ <span>Back to room</span>
            </Button>
          </header>
          <div className="reader-body">
            <PortfolioContent section={displayedSection} />
            <a href={`#portfolio/${displayedSection}`} className="text-link full-reading-link">
              Continue in the full portfolio ↗
            </a>
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
}
