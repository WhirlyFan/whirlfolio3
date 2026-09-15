import { ArrowUpRight } from 'lucide-react';
import type { Photo } from '../../content/portfolio';
import { cn } from '../../lib/utils';
import type { Presentation } from './Tags';

export function Photography({
  items,
  photographer,
  presentation = 'compact',
}: {
  items: Photo[];
  photographer: string;
  presentation?: Presentation;
}) {
  const editorial = presentation === 'editorial';
  if (!items.length) return <p className="text-muted-foreground">Photographs will appear here.</p>;
  return (
    <div
      className={
        editorial
          ? 'grid grid-cols-2 gap-7 max-reader:grid-cols-1 max-reader:gap-8'
          : 'grid gap-[26px]'
      }
    >
      {items.map((photo, index) => (
        <figure className="min-w-0" key={photo.id}>
          <a
            className={cn('block overflow-hidden', editorial ? 'rounded-[6px]' : 'rounded-tag')}
            href={photo.src}
            target="_blank"
            rel="noreferrer"
            aria-label={`Open ${photo.title} photograph`}
          >
            <img
              className="block h-auto w-full"
              src={photo.src}
              alt={photo.alt}
              loading="lazy"
              width={photo.width}
              height={photo.height}
            />
          </a>
          <figcaption
            className={
              editorial
                ? 'mt-4.5 flex justify-between gap-3.5 text-xs max-reader:mt-[13px] max-reader:text-[11px]'
                : 'mt-3 flex justify-between gap-2.5 text-[10px] text-muted-foreground'
            }
          >
            <span className={editorial ? 'flex items-center gap-2.25' : 'text-foreground'}>
              {editorial && (
                <small className="text-[10px] text-muted-foreground">
                  {String(index + 1).padStart(2, '0')}
                </small>
              )}
              {photo.title}
            </span>
            <span
              className={
                editorial
                  ? 'flex items-center gap-2.25 text-muted-foreground'
                  : 'text-muted-foreground'
              }
            >
              {photographer}
              {editorial ? <ArrowUpRight className="size-[13px]" aria-hidden="true" /> : ' ↗'}
            </span>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
