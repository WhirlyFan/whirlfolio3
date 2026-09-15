import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { MoveHorizontal } from 'lucide-react';
import { parseHash, toHash, type Navigation } from './app/navigation';
import { formatRole, profile, sections } from './content/portfolio';
import { RoomViewport } from './components/RoomViewport';
import { PortfolioPage } from './components/PortfolioPage';
import { ContentDialog } from './components/ContentDialog';
import { SiteHeader } from './components/SiteHeader';
import type { RuntimeState } from './room/pixi/runtime';
import type { RoomAction, SectionId } from './room/types';

export default function App() {
  const [navigation, setNavigation] = useState<Navigation>(() => parseHash(location.hash));
  const [fanSpeed, setFanSpeed] = useState<0 | 1 | 2>(1);
  const [reducedMotion, setReducedMotion] = useState(
    () => matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const [notice, setNotice] = useState('');
  const [playAction, setPlayAction] = useState<RoomAction | null>(null);
  const readingPosition = useRef(0);
  const isRoom = navigation.mode === 'room';
  const fanLabel = ['off', 'low', 'high'][fanSpeed];

  useEffect(() => {
    const onHash = () => setNavigation(parseHash(location.hash));
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const onMotion = () => setReducedMotion(media.matches);
    window.addEventListener('hashchange', onHash);
    media.addEventListener('change', onMotion);
    return () => {
      window.removeEventListener('hashchange', onHash);
      media.removeEventListener('change', onMotion);
    };
  }, []);

  useLayoutEffect(() => {
    if (isRoom) {
      window.scrollTo({ top: 0, behavior: 'instant' });
      return;
    }
    const section = navigation.section && document.getElementById(navigation.section);
    if (section) {
      section.scrollIntoView({ block: 'start', behavior: 'instant' });
      section.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true });
    } else if (readingPosition.current > 0) {
      window.scrollTo({ top: readingPosition.current, behavior: 'instant' });
      // The persistent view link stays visible at any restored reading position.
      document
        .querySelector<HTMLElement>('.layout-view-nav a[href="#portfolio"]')
        ?.focus({ preventScroll: true });
    } else {
      window.scrollTo({ top: 0, behavior: 'instant' });
      document.getElementById('portfolio-heading')?.focus({ preventScroll: true });
    }
  }, [navigation, isRoom]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 3200);
    return () => clearTimeout(timer);
  }, [notice]);

  function rememberReading() {
    if (!isRoom) readingPosition.current = window.scrollY;
  }
  function onPortfolio() {
    if (!isRoom) readingPosition.current = 0;
  }
  function go(section: SectionId | null) {
    location.hash = toHash({ mode: 'room', section });
  }
  function onAction(action: RoomAction) {
    if (sections.some((section) => section.id === action)) go(action as SectionId);
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
  const roomState = useMemo<RuntimeState>(
    () => ({
      fanSpeed,
      paused: false,
      quality: 'auto',
      reducedMotion,
      activeAction: playAction,
      actionStartedAt: 0,
    }),
    [fanSpeed, reducedMotion, playAction],
  );

  return (
    <div className="layout-shell">
      <a
        className="skip-link"
        href="#portfolio"
        onClick={() => {
          readingPosition.current = 0;
        }}
      >
        Skip the room — read the portfolio
      </a>
      <SiteHeader navigation={navigation} onRoom={rememberReading} onPortfolio={onPortfolio} />
      {isRoom ? (
        <main className="layout-room" aria-label={`Explore ${profile.name}’s room`}>
          <h1 className="sr-only">{profile.name}’s room</h1>
          <RoomViewport state={roomState} section={navigation.section} onAction={onAction} />
          <div className="scene-notice" role="status">
            {notice}
          </div>
          <p className="sr-only" role="status" aria-label="Fan setting">
            Fan speed: {fanLabel}
          </p>
          <aside className="layout-room-note layout-surface">
            <h2>{profile.name}</h2>
            <p>
              {formatRole(profile.role)} · {profile.company}
            </p>
            <span>A slow summer afternoon.</span>
          </aside>
          <p className="layout-room-hint">
            <MoveHorizontal aria-hidden="true" />
            <span>Drag or swipe to look around</span>
          </p>
          <ContentDialog section={navigation.section} onClose={() => go(null)} />
        </main>
      ) : (
        <PortfolioPage onRoom={rememberReading} />
      )}
    </div>
  );
}
