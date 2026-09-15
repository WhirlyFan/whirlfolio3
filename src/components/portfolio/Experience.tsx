import type { Experience as ExperienceEntry } from '../../content/portfolio';
import { cn } from '../../lib/utils';
import { Badge } from '../ui/badge';
import { Tags, type Presentation } from './Tags';

export function Experience({
  items,
  presentation = 'compact',
}: {
  items: ExperienceEntry[];
  presentation?: Presentation;
}) {
  const editorial = presentation === 'editorial';
  return (
    <div className={editorial ? 'border-t border-border' : undefined}>
      {items.map((job) => (
        <article
          key={job.id}
          className={
            editorial
              ? 'grid grid-cols-[220px_minmax(0,1fr)] gap-14 border-b border-border py-9 last:border-0 last:pb-0 max-reader:grid-cols-1 max-reader:gap-4.5 max-reader:py-7'
              : 'relative border-l border-border pb-[27px] pl-[25px] last:pb-0 before:absolute before:top-[5px] before:-left-1 before:size-[7px] before:rounded-full before:bg-timeline'
          }
        >
          <div
            className={
              editorial
                ? 'flex flex-col items-start gap-3.5 pt-[5px] text-[13px] text-muted-foreground max-reader:flex-row max-reader:flex-wrap max-reader:items-center max-reader:gap-3 max-reader:pt-0 max-reader:text-xs'
                : 'mb-2.25 text-[10px] text-muted-foreground'
            }
          >
            {job.current &&
              (editorial ? (
                <Badge variant="secondary" className="px-2.5 py-1 text-[11px] font-medium">
                  Currently
                </Badge>
              ) : (
                <span className="status-dot" />
              ))}
            <span>{job.period}</span>
          </div>
          <div className={editorial ? 'max-w-[70ch]' : undefined}>
            <h3
              className={cn(
                'font-serif font-normal',
                editorial ? 'mb-2 text-[29px] max-reader:text-[27px]' : 'mb-1.5 text-[27px]',
                !editorial && 'leading-[normal]',
              )}
            >
              {job.company}
            </h3>
            <p
              className={
                editorial
                  ? 'mb-3.5 text-sm leading-[1.75]'
                  : 'mb-3 text-xs font-medium leading-[1.5]'
              }
            >
              {job.role}
            </p>
            <p
              className={
                editorial
                  ? 'mb-4.5 text-base leading-[1.75] text-muted-foreground'
                  : 'text-[13px] leading-[1.85] text-copy-compact'
              }
            >
              {job.description}
            </p>
            <div className={editorial ? undefined : 'mt-[15px]'}>
              <Tags tags={job.tags} presentation={presentation} />
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
