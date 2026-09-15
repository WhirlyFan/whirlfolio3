import { education, experience, photos, profile, projects, research } from '../content/portfolio';
import type { SectionId } from '../room/types';
import { Badge } from './ui/badge';
import { Card } from './ui/card';

function Tags({ tags }: { tags: string[] }) {
  return (
    <div className="tags">
      {tags.map((tag) => (
        <Badge key={tag} variant="outline" className="rounded-sm text-[9px] font-normal">
          {tag}
        </Badge>
      ))}
    </div>
  );
}
export function PortfolioContent({ section }: { section: SectionId }) {
  if (section === 'projects')
    return (
      <div className="project-list">
        {projects.map((project, index) => (
          <Card role="article" className="project-card gap-0 py-0 shadow-none" key={project.id}>
            <div className={`project-art project-art-${project.id}`} aria-hidden="true">
              {project.id === 'music' ? (
                <div className="record">
                  <span>m.</span>
                </div>
              ) : project.id === 'lister' ? (
                <div className="mini-books">
                  <i />
                  <i />
                  <i />
                </div>
              ) : (
                <span className="breezy-mark">≈</span>
              )}
              <span className="project-index">0{index + 1}</span>
            </div>
            <div className="project-copy">
              <p className="eyebrow">{project.eyebrow}</p>
              <h3>{project.name}</h3>
              <p>{project.description}</p>
              <Tags tags={project.tags} />
              <details>
                <summary>Behind the project</summary>
                <ul>
                  {project.details.map((detail) => (
                    <li key={detail}>{detail}</li>
                  ))}
                </ul>
              </details>
              {project.url && (
                <a className="text-link" href={project.url} target="_blank" rel="noreferrer">
                  View project on GitHub <span aria-hidden="true">↗</span>
                </a>
              )}
            </div>
          </Card>
        ))}
      </div>
    );
  if (section === 'experience')
    return (
      <div className="timeline">
        <p className="resume-link">
          <a className="text-link" href={profile.resume} download>
            Download résumé (PDF) ↓
          </a>
        </p>
        {experience.map((item) => (
          <article className="job" key={item.id}>
            <div className="job-period">
              {item.current && <span className="status-dot" />}
              {item.period}
            </div>
            <h3>{item.company}</h3>
            <p className="job-role">{item.role}</p>
            <p>{item.description}</p>
            <Tags tags={item.tags} />
          </article>
        ))}
      </div>
    );
  if (section === 'photography')
    return (
      <div>
        <p className="section-intro">Usually birds. Always worth slowing down for.</p>
        <div className="photo-grid">
          {photos.map((photo) => (
            <figure key={photo.id}>
              <a
                href={photo.src}
                target="_blank"
                rel="noreferrer"
                aria-label={`Open ${photo.title} photograph`}
              >
                <img src={photo.src} alt={photo.alt} loading="lazy" width="1920" height="1280" />
              </a>
              <figcaption>
                <span>{photo.title}</span>
                <span>Michael Lee ↗</span>
              </figcaption>
            </figure>
          ))}
        </div>
        <p className="quiet-note">Photographs by Michael Lee. Open an image to see it in full.</p>
      </div>
    );
  return (
    <div className="about-content">
      <p className="large-copy">
        Engineer, bird watcher,
        <br />
        occasional longboarder.
      </p>
      <p>
        {profile.intro} This little room brings a few of those interests together: a camera, a
        guitar, a longboard, and a fan keeping the afternoon moving.
      </p>
      <h3>Education</h3>
      {education.map((item) => (
        <div className="education" key={item.institution}>
          <span>{item.period}</span>
          <h4>{item.institution}</h4>
          <p>{item.degree}</p>
        </div>
      ))}
      <h3>Research</h3>
      <h4>{research.title}</h4>
      <p>{research.description}</p>
      <Card className="contact-card gap-0 border-0 shadow-none">
        <p className="eyebrow">Say hello</p>
        <a href={`mailto:${profile.email}`}>{profile.email} ↗</a>
        <div>
          <a href={profile.github} target="_blank" rel="noreferrer">
            GitHub ↗
          </a>
          <a href={profile.linkedin} target="_blank" rel="noreferrer">
            LinkedIn ↗
          </a>
        </div>
      </Card>
    </div>
  );
}
