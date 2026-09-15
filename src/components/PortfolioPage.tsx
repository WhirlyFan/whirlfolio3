import type { ReactNode } from 'react';
import { ArrowDown, ArrowUpRight } from 'lucide-react';
import {
  asset,
  experience,
  photographyIntro,
  photos,
  profile,
  projects,
} from '../content/portfolio';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Projects } from './portfolio/Projects';
import { Experience } from './portfolio/Experience';
import { Photography } from './portfolio/Photography';
import { About } from './portfolio/About';
import { cn } from '../lib/utils';

function SectionHeading({
  number,
  label,
  title,
  children,
}: {
  number: string;
  label: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <header className="mb-8 flex items-end justify-between gap-8 max-reader:mb-6 max-reader:flex-wrap max-reader:items-start max-reader:gap-4.5">
      <div>
        <span className="text-[10px] font-semibold tracking-[0.14em] uppercase text-muted-foreground">
          {number} / {label}
        </span>
        <h2
          tabIndex={-1}
          className="mt-2.5 font-serif text-[44px] leading-[1.15] font-normal tracking-[-1.3px] max-reader:text-[37px]"
        >
          {title}
        </h2>
      </div>
      {children}
    </header>
  );
}

const sectionSpacing = 'border-t border-border pt-[54px] pb-15 max-reader:pt-9 max-reader:pb-11';
const sectionNote = 'text-sm leading-[1.7] text-muted-foreground max-reader:text-[13px]';

/** This page owns section placement; each content component owns its appearance. */
export function PortfolioPage({ onRoom }: { onRoom(): void }) {
  const heroPhoto = photos.find((photo) => photo.featured) ?? photos[0];
  const roleCompany = [profile.role.team, 'at', profile.company].filter(Boolean).join(' ');
  return (
    <main className="mx-auto max-w-[1440px] px-10 pt-[116px] pb-8 wide:px-page-gutter max-wide:pb-[108px] max-reader:px-6 max-reader:pt-[98px] max-[381px]:px-5">
      <section
        className={cn(
          'grid items-center gap-16 pt-3 pb-14 max-wide:gap-10 max-reader:gap-7 max-reader:pt-0 max-reader:pb-10',
          heroPhoto && 'reader:grid-cols-[1.12fr_0.88fr]',
        )}
        aria-labelledby="portfolio-heading"
      >
        <div className="min-w-0">
          <p className="mb-5 text-[11px] font-semibold tracking-[0.13em] text-muted-foreground uppercase max-reader:mb-4.5 max-reader:text-[9px] max-reader:tracking-[0.11em]">
            A portfolio of work & a few things I love
          </p>
          <h1
            id="portfolio-heading"
            tabIndex={-1}
            className="mt-0 mb-5 font-serif text-[clamp(54px,5.3vw,78px)] leading-[1.04] font-normal tracking-[-3px] max-reader:mb-4 max-reader:text-[54px] max-reader:tracking-[-2px] max-[381px]:text-[48px]"
          >
            {profile.name}
            <span className="text-ring">.</span>
          </h1>
          <p className="mb-4.5 text-[19px] leading-[1.5] max-reader:mb-4 max-reader:text-[17px]">
            {profile.role.title}
            <br />
            <span className="text-base text-muted-foreground max-reader:text-[15px]">
              {roleCompany}
            </span>
          </p>
          <p className="mb-[26px] max-w-[46ch] text-base leading-[1.75] text-muted-foreground max-reader:mb-5">
            {profile.intro}
          </p>
          <div className="flex flex-wrap items-center gap-2.5 max-reader:gap-2">
            <Button asChild size="portfolio">
              <a href="#portfolio/projects">
                Explore my work <ArrowDown aria-hidden="true" />
              </a>
            </Button>
            <Button asChild variant="outline" size="portfolio">
              <a href={profile.resume} download>
                Résumé <ArrowDown aria-hidden="true" />
              </a>
            </Button>
            <a
              className="inline-flex min-h-11 items-center justify-center gap-2 px-2.25 text-[13px] max-reader:px-1 max-reader:text-xs"
              href={`mailto:${profile.email}`}
            >
              Say hello <ArrowUpRight className="size-[15px]" aria-hidden="true" />
            </a>
          </div>
        </div>
        {heroPhoto && (
          <figure className="w-full max-w-[466px] justify-self-end max-reader:max-w-full max-reader:justify-self-start">
            <a
              className="block rounded-[4px] border-8 border-card outline-1 outline-border"
              href="#portfolio/photography"
              aria-label={`Explore ${profile.name}’s bird photography`}
            >
              <img
                className="block h-auto w-full"
                src={heroPhoto.src}
                alt={heroPhoto.alt}
                width={heroPhoto.width}
                height={heroPhoto.height}
              />
            </a>
            <figcaption className="mt-3 flex justify-between gap-3 text-[11px] text-muted-foreground max-reader:mt-[5px] max-reader:text-[10px]">
              <span className="flex min-h-9 items-center gap-[7px]">
                <i className="size-[5px] rounded-full bg-muted-foreground" aria-hidden="true" />
                Away from the keyboard
              </span>
              <a className="flex min-h-9 items-center gap-[7px]" href="#portfolio/photography">
                Bird photography <ArrowUpRight className="size-[13px]" aria-hidden="true" />
              </a>
            </figcaption>
          </figure>
        )}
      </section>
      <section className={sectionSpacing} id="projects">
        <SectionHeading number="01" label="Selected work" title="Projects">
          <p className={sectionNote}>
            Things I’ve built, from shared soundtracks <br className="max-reader:hidden" />
            to small communities.
          </p>
        </SectionHeading>
        <Projects items={projects} presentation="editorial" />
      </section>
      <section className={sectionSpacing} id="experience">
        <SectionHeading number="02" label="Along the way" title="Experience">
          <Button asChild variant="outline" size="portfolio">
            <a href={profile.resume} download>
              Download résumé (PDF) <ArrowDown aria-hidden="true" />
            </a>
          </Button>
        </SectionHeading>
        <Experience items={experience} presentation="editorial" />
      </section>
      <section className={sectionSpacing} id="photography">
        <SectionHeading number="03" label="Out in the world" title="Photography">
          <p className={sectionNote}>
            {photographyIntro.lead} <br className="max-reader:hidden" />
            {photographyIntro.detail}
          </p>
        </SectionHeading>
        <Photography items={photos} photographer={profile.name} presentation="editorial" />
      </section>
      <section className={sectionSpacing} id="about">
        <SectionHeading number="04" label="Behind the screen" title="A little about me" />
        <div className="grid grid-cols-[1.2fr_0.8fr] items-start gap-x-20 max-wide:gap-x-10 max-reader:grid-cols-1 max-reader:gap-0">
          <About presentation="editorial" />
          <Card className="gap-[26px] rounded-panel border-0 bg-secondary p-10 shadow-none max-reader:mt-7 max-reader:flex-row max-reader:items-start max-reader:gap-4.5 max-reader:p-[26px] max-[381px]:flex-col">
            <img
              className="size-[76px] rounded-full max-reader:size-12"
              src={asset('assets/fan-logo.jpg')}
              alt=""
            />
            <div>
              <h3 className="mb-4.5 font-serif text-[32px] font-normal tracking-[-0.6px] max-reader:text-[26px]">
                Stay a little longer.
              </h3>
              <p className="mb-[22px] text-sm leading-[1.75] text-muted-foreground">
                There’s a quiet room, an open window, <br className="max-reader:hidden" />
                and a fan keeping the afternoon moving.
              </p>
              <Button asChild variant="outline" size="portfolio">
                <a href="#room" onClick={onRoom}>
                  Back to the room <ArrowUpRight aria-hidden="true" />
                </a>
              </Button>
            </div>
          </Card>
        </div>
      </section>
      <footer className="flex items-center justify-between gap-5 border-t border-border pt-6 text-xs text-muted-foreground max-reader:flex-wrap max-reader:gap-x-6 max-reader:gap-y-2">
        <span>
          {profile.name} · {profile.handle}
        </span>
        <span className="max-reader:order-3 max-reader:w-full">
          Made for a slower kind of browsing.
        </span>
        <a
          className="flex min-h-11 items-center gap-2"
          href={profile.github}
          target="_blank"
          rel="noreferrer"
        >
          GitHub <ArrowUpRight className="size-3.5" aria-hidden="true" />
        </a>
      </footer>
    </main>
  );
}
