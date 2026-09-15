import { useEffect, useMemo, useState } from 'react';
import { parseHash, toHash, type Navigation } from './app/navigation';
import { asset, profile, sections } from './content/portfolio';
import { RoomViewport } from './components/RoomViewport';
import { PortfolioContent } from './components/PortfolioContent';
import { ContentDialog } from './components/ContentDialog';
import { RoomControls } from './components/RoomControls';
import { Button } from './components/ui/button';
import { cn } from './lib/utils';
import type { RoomAction, SectionId } from './room/types';
import type { Quality } from './room/policy';

export default function App() {
  const [navigation, setNavigation] = useState<Navigation>(() => parseHash(location.hash));
  const [fanSpeed, setFanSpeed] = useState<0 | 1 | 2>(1);
  const [paused, setPaused] = useState(false);
  const [quality, setQuality] = useState<Quality>('auto');
  const [reducedMotion, setReducedMotion] = useState(
    () => matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const [notice, setNotice] = useState('');
  const [playAction, setPlayAction] = useState<RoomAction | null>(null);
  useEffect(() => {
    const onHash = () => setNavigation(parseHash(location.hash));
    window.addEventListener('hashchange', onHash);
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const onMotion = () => setReducedMotion(media.matches);
    media.addEventListener('change', onMotion);
    return () => {
      window.removeEventListener('hashchange', onHash);
      media.removeEventListener('change', onMotion);
    };
  }, []);
  useEffect(() => {
    if (navigation.mode !== 'portfolio') return;
    const section = navigation.section && document.getElementById(navigation.section);
    const destination =
      section?.querySelector<HTMLElement>('h2') ?? document.getElementById('portfolio-heading');
    if (section) section.scrollIntoView({ behavior: 'instant', block: 'start' });
    else window.scrollTo(0, 0);
    destination?.focus({ preventScroll: true });
  }, [navigation]);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 3200);
    return () => clearTimeout(timer);
  }, [notice]);
  function go(section: SectionId | null, mode = navigation.mode) {
    location.hash = toHash({ mode, section });
  }
  function onAction(action: RoomAction) {
    if (sections.some((section) => section.id === action)) go(action as SectionId, 'room');
    else if (action === 'fan') {
      setFanSpeed((current) => ((current + 1) % 3) as 0 | 1 | 2);
    } else {
      setPlayAction(action);
      setNotice(
        action === 'bird'
          ? 'Off for a little look around.'
          : action === 'guitar'
            ? 'A quiet afternoon chord. Sound stays off.'
            : 'A small moment of relief.',
      );
    }
  }
  const roomState = useMemo(
    () => ({
      fanSpeed,
      paused,
      quality,
      reducedMotion,
      activeAction: playAction,
      actionStartedAt: 0,
    }),
    [fanSpeed, paused, quality, reducedMotion, playAction],
  );
  const isRoom = navigation.mode === 'room';
  return (
    <>
      <a className="skip-link" href="#portfolio">
        Skip the room — read the portfolio
      </a>
      <header
        className={cn(
          isRoom
            ? 'room-header pointer-events-none fixed inset-x-0 top-0 z-20 flex items-start justify-between gap-3 p-4 sm:p-6'
            : 'site-header',
        )}
      >
        <a
          className={cn(
            'wordmark',
            isRoom &&
              'pointer-events-auto rounded-full border border-white/50 bg-card/95 px-3 py-2 text-xl shadow-sm sm:px-4 sm:text-2xl',
          )}
          href="#room"
          aria-label="Whirlfolio home"
        >
          <img src={asset('assets/fan-logo.jpg')} alt="" />
          <span className={isRoom ? 'max-[380px]:hidden' : undefined}>
            whirlfolio<span className="wordmark-dot">.</span>
          </span>
        </a>
        <nav
          aria-label="View"
          className={cn(
            isRoom &&
              'pointer-events-auto flex items-center gap-1 rounded-full border border-white/50 bg-card/95 p-1 shadow-sm',
          )}
        >
          <Button
            asChild
            variant={isRoom ? 'default' : 'ghost'}
            className="h-11 rounded-full px-3 text-xs sm:px-5"
          >
            <a href="#room" aria-current={isRoom ? 'page' : undefined}>
              The room
            </a>
          </Button>
          <Button
            asChild
            variant={!isRoom ? 'default' : 'ghost'}
            className="h-11 rounded-full px-3 text-xs sm:px-5"
          >
            <a href="#portfolio" aria-current={!isRoom ? 'page' : undefined}>
              The portfolio
            </a>
          </Button>
        </nav>
        {!isRoom && (
          <a className="hello-link" href={`mailto:${profile.email}`}>
            Say hello <span aria-hidden="true">↗</span>
          </a>
        )}
      </header>
      {isRoom ? (
        <main className="room-experience relative h-dvh w-full overflow-hidden bg-background">
          <section className="absolute inset-0 isolate" aria-label="Explore Michael’s room">
            <RoomViewport state={roomState} section={navigation.section} onAction={onAction} />
            <div className="scene-notice" role="status">
              {notice}
            </div>
          </section>
          <div className="room-dock pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-end justify-between gap-5 p-3 sm:p-6">
            <div className="hidden rounded-xl bg-card/95 px-5 py-4 shadow-sm lg:block">
              <h1 className="m-0 font-serif text-2xl tracking-tight">Michael Lee</h1>
              <p className="mt-1 text-xs text-muted-foreground">
                {profile.role} · {profile.company}
              </p>
              <p className="mt-2 font-serif text-sm italic">A slow summer afternoon.</p>
            </div>
            <div className="pointer-events-auto mx-auto w-full max-w-xl rounded-2xl border border-white/60 bg-card/95 p-2 shadow-lg lg:mx-0">
              <h1 className="sr-only lg:hidden">Michael Lee’s room</h1>
              <p className="flex items-center justify-center gap-2 px-2 pb-1 pt-1 text-[11px] text-muted-foreground">
                <span aria-hidden="true">↔</span>
                <span className="sm:hidden">Swipe to look around · Tap an object to explore</span>
                <span className="hidden sm:inline">
                  Drag to look around · Click an object to explore
                </span>
              </p>
              <nav className="grid grid-cols-4 gap-1" aria-label="Portfolio collections">
                {sections.map((section) => (
                  <Button
                    key={section.id}
                    variant="ghost"
                    className="h-11 min-w-0 gap-2 rounded-lg px-2 text-[11px] sm:px-4 sm:text-xs"
                    data-collection={section.id}
                    aria-label={section.title}
                    onClick={() => go(section.id, 'room')}
                  >
                    <span
                      className="hidden text-[10px] text-muted-foreground sm:inline"
                      aria-hidden="true"
                    >
                      {section.number}
                    </span>
                    {section.title}
                    <span className="hidden text-muted-foreground sm:inline" aria-hidden="true">
                      ↗
                    </span>
                  </Button>
                ))}
              </nav>
              <RoomControls
                fanSpeed={fanSpeed}
                paused={paused}
                quality={quality}
                reducedMotion={reducedMotion}
                onFan={() => onAction('fan')}
                onPause={() => setPaused((value) => !value)}
                onQuality={setQuality}
              />
            </div>
          </div>
          <ContentDialog section={navigation.section} onClose={() => go(null, 'room')} />
        </main>
      ) : (
        <main className="portfolio-page">
          <section className="portfolio-intro">
            <p className="eyebrow">Michael Lee / WhirlyFan</p>
            <h1 id="portfolio-heading" tabIndex={-1}>
              Thoughtful software.
              <br />
              <em>A curious eye.</em>
            </h1>
            <p>{profile.intro}</p>
            <a className="text-link" href="#room">
              Spend a moment in the room ↗
            </a>
          </section>
          <nav className="portfolio-nav" aria-label="Portfolio sections">
            {sections.map((section) => (
              <a key={section.id} href={`#portfolio/${section.id}`}>
                {section.title}
              </a>
            ))}
          </nav>
          {sections.map((section) => (
            <section className="portfolio-section" id={section.id} key={section.id}>
              <header>
                <span>{section.number}</span>
                <h2 tabIndex={-1}>{section.title}</h2>
              </header>
              <PortfolioContent section={section.id} />
            </section>
          ))}
        </main>
      )}
      {!isRoom && (
        <footer className="site-footer">
          <span>
            Michael Lee <span aria-hidden="true">✳</span> Whirlfolio3
          </span>
          <div>
            <a href={profile.github} target="_blank" rel="noreferrer">
              GitHub ↗
            </a>
            <a href={profile.linkedin} target="_blank" rel="noreferrer">
              LinkedIn ↗
            </a>
          </div>
          <span>Made for a slower kind of browsing.</span>
        </footer>
      )}
    </>
  );
}
