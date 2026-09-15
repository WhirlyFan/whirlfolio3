import { experience, photographyIntro, photos, profile, projects } from '../content/portfolio';
import type { SectionId } from '../room/types';
import { Projects } from './portfolio/Projects';
import { Experience } from './portfolio/Experience';
import { Photography } from './portfolio/Photography';
import { About } from './portfolio/About';

/** The room composes the same content components in their compact presentation. */
export function PortfolioContent({ section }: { section: SectionId }) {
  switch (section) {
    case 'projects':
      return <Projects items={projects} />;
    case 'experience':
      return (
        <>
          <p className="mb-7">
            <a className="text-link" href={profile.resume} download>
              Download résumé (PDF) ↓
            </a>
          </p>
          <Experience items={experience} />
        </>
      );
    case 'photography':
      return (
        <>
          <p className="mb-[25px] font-serif text-[23px] italic leading-[1.4] text-photo-intro">
            {photographyIntro.lead} {photographyIntro.detail}
          </p>
          <Photography items={photos} photographer={profile.name} />
          {photos.length > 0 && (
            <p className="mt-6 text-[11px] leading-[1.6] text-muted-foreground">
              Photographs by {profile.name}. Open an image to see it in full.
            </p>
          )}
        </>
      );
    case 'about':
      return <About />;
  }
}
