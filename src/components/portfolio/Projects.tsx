import type { Project } from '../../content/portfolio';
import { cn } from '../../lib/utils';
import { Card } from '../ui/card';
import { Tags, type Presentation } from './Tags';
import styles from './ProjectArtwork.module.css';

function ProjectArtwork({
  artwork,
  index,
  featured,
  editorial,
}: {
  artwork: Project['artwork'];
  index: number;
  featured: boolean;
  editorial: boolean;
}) {
  return (
    <div
      className={cn(
        'relative grid place-items-center overflow-hidden',
        editorial ? 'h-50 max-reader:h-[185px]' : 'h-[190px]',
        featured && 'reader:h-full reader:min-h-[340px]',
        artwork ? styles[artwork] : 'bg-project-art',
      )}
      aria-hidden="true"
    >
      {artwork === 'record' ? (
        <div className={styles.recordDisc}>
          <span>m.</span>
        </div>
      ) : artwork === 'books' ? (
        <div className={styles.bookSpines}>
          <i />
          <i />
          <i />
        </div>
      ) : artwork === 'breeze' ? (
        <span className={styles.breezeMark}>≈</span>
      ) : null}
      <span className="absolute top-4 left-4.5 font-serif text-[13px] italic leading-[normal] opacity-50">
        {String(index + 1).padStart(2, '0')}
      </span>
    </div>
  );
}

export function Projects({
  items,
  presentation = 'compact',
}: {
  items: Project[];
  presentation?: Presentation;
}) {
  const editorial = presentation === 'editorial';
  return (
    <div className={cn('grid gap-6', editorial && 'reader:grid-cols-2 max-reader:gap-5')}>
      {items.map((project, index) => {
        const featured = editorial && index === 0;
        return (
          <Card
            role="article"
            key={project.id}
            className={cn(
              'min-w-0 gap-0 overflow-hidden border py-0 shadow-none',
              editorial && 'rounded-panel',
              featured && 'reader:col-span-full reader:grid reader:grid-cols-[0.85fr_1.15fr]',
            )}
          >
            <ProjectArtwork
              artwork={project.artwork}
              index={index}
              featured={featured}
              editorial={editorial}
            />
            <div
              className={cn('min-w-0', editorial ? 'p-7.5 max-reader:p-[23px]' : 'p-6 max-sm:p-5')}
            >
              <p
                className={cn(
                  'text-[10px] font-semibold uppercase text-muted-foreground leading-[1.6] tracking-[0.16em]',
                  editorial && 'mb-2.5',
                )}
              >
                {project.eyebrow}
              </p>
              <h3
                className={cn(
                  'font-serif font-normal',
                  editorial
                    ? 'mb-[15px] text-[34px] tracking-[-0.7px] max-reader:text-[30px]'
                    : 'mt-[5px] mb-3 text-[30px]',
                  'leading-[normal]',
                )}
              >
                {project.name}
              </h3>
              <p
                className={
                  editorial
                    ? 'max-w-[60ch] text-base leading-[1.7] text-muted-foreground'
                    : 'text-[13px] leading-[1.85] text-copy-compact'
                }
              >
                {project.description}
              </p>
              <div className={editorial ? 'mt-4.5 mb-3' : 'my-[15px]'}>
                <Tags tags={project.tags} presentation={presentation} />
              </div>
              <details
                className={cn('group text-detail', editorial ? 'text-sm' : 'my-4.5 text-xs')}
              >
                <summary
                  className={cn(
                    'cursor-pointer',
                    editorial
                      ? 'flex min-h-11 w-full items-center leading-[2] after:ml-auto after:text-xl after:content-["+"] group-open:after:content-["−"]'
                      : 'min-h-8 w-fit leading-[2]',
                  )}
                >
                  Behind the project
                </summary>
                <ul
                  className={cn(
                    'list-disc pl-4.5 leading-[1.8] [&>li+li]:mt-2',
                    editorial && 'text-sm',
                  )}
                >
                  {project.details.map((detail) => (
                    <li key={detail}>{detail}</li>
                  ))}
                </ul>
              </details>
              {project.url && (
                <a
                  className={cn(
                    'text-link',
                    editorial && 'inline-flex min-h-11 items-center text-[13px] leading-[1.5]',
                  )}
                  href={project.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  View project on GitHub <span aria-hidden="true">↗</span>
                </a>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
