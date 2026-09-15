import { Fragment } from 'react';
import { aboutCopy, education, profile, research } from '../../content/portfolio';
import { cn } from '../../lib/utils';
import { Card } from '../ui/card';
import type { Presentation } from './Tags';

export function About({ presentation = 'compact' }: { presentation?: Presentation }) {
  const editorial = presentation === 'editorial';
  const body = editorial
    ? 'text-base leading-[1.8] text-muted-foreground'
    : 'text-[13px] leading-[1.85] text-copy-compact';
  const heading = cn(
    'font-serif font-normal',
    editorial ? 'mt-[34px] mb-4 text-2xl' : 'mt-7 mb-4.5 text-[25px]',
    'leading-[normal]',
  );
  const subheading = cn('mb-[7px] font-medium', editorial ? 'text-base' : 'text-[13px]');
  return (
    <div className={editorial ? 'max-w-[62ch]' : undefined}>
      <p
        className={cn(
          'mb-5 font-serif font-normal tracking-[-0.5px]',
          editorial ? 'text-[34px] leading-[1.3]' : 'text-[30px] leading-[1.25]',
        )}
      >
        {aboutCopy.headline.map((line, index) => (
          <Fragment key={line}>
            {index > 0 && <br />}
            {line}
          </Fragment>
        ))}
      </p>
      <p className={body}>
        {profile.intro} {aboutCopy.roomDescription}
      </p>
      <h3 className={heading}>Education</h3>
      {education.map((item) => (
        <div className="mb-4.5 border-b border-border pb-4.5" key={item.institution}>
          <span
            className={cn(
              'mb-[7px] block text-muted-foreground',
              editorial ? 'text-xs' : 'text-[10px]',
            )}
          >
            {item.period}
          </span>
          <h4 className={subheading}>{item.institution}</h4>
          <p
            className={
              editorial
                ? 'text-sm leading-[1.7] text-muted-foreground'
                : 'text-xs leading-[1.5] text-muted-foreground'
            }
          >
            {item.degree}
          </p>
        </div>
      ))}
      <h3 className={heading}>Research</h3>
      <h4 className={subheading}>{research.title}</h4>
      <p className={body}>{research.description}</p>
      <Card
        className={cn(
          'mt-7.5 gap-0 shadow-none',
          editorial ? 'rounded-[14px] border bg-card p-6' : 'border-0 bg-card px-[25px] py-6',
        )}
      >
        <p className="eyebrow">Say hello</p>
        <a
          className="mt-2.5 mb-4.5 block font-serif text-xl leading-[normal] wrap-anywhere"
          href={`mailto:${profile.email}`}
        >
          {profile.email} ↗
        </a>
        <div className="flex gap-[22px] text-[11px]">
          <a
            className={editorial ? 'inline-flex min-h-11 items-center text-[13px]' : undefined}
            href={profile.github}
            target="_blank"
            rel="noreferrer"
          >
            GitHub ↗
          </a>
          <a
            className={editorial ? 'inline-flex min-h-11 items-center text-[13px]' : undefined}
            href={profile.linkedin}
            target="_blank"
            rel="noreferrer"
          >
            LinkedIn ↗
          </a>
        </div>
      </Card>
    </div>
  );
}
