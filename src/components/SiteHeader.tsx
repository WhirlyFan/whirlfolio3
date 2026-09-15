import { asset, sections } from '../content/portfolio';
import { toHash, type Navigation } from '../app/navigation';
import { Button } from './ui/button';

interface Props {
  navigation: Navigation;
  onRoom(): void;
  onPortfolio(): void;
}

const surface = 'border border-border bg-card rounded-full shadow-navigation';

/** Both views share the same anchors and placement at every breakpoint. */
export function SiteHeader({ navigation, onRoom, onPortfolio }: Props) {
  const isRoom = navigation.mode === 'room';
  return (
    <header className="layout-header pointer-events-none fixed inset-x-6 top-6 z-30 grid h-13.5 grid-cols-[1fr_auto_1fr] items-start gap-4.5 max-wide:grid-cols-2 max-reader:inset-x-4 max-reader:top-3.5 max-reader:gap-3">
      <a
        href="#room"
        className={`${surface} pointer-events-auto flex h-13.5 items-center justify-self-start gap-2 py-1.5 pr-4 pl-2.25 font-serif text-2xl leading-[normal] tracking-[-1px] whitespace-nowrap max-reader:h-12.5 max-reader:gap-1.5 max-reader:py-[5px] max-reader:pr-3 max-reader:pl-[7px] max-reader:text-xl max-[381px]:p-2`}
        aria-label="Whirlfolio home"
        onClick={onRoom}
      >
        <img
          className="size-9 rounded-full object-cover max-reader:size-7.5"
          src={asset('assets/fan-logo.jpg')}
          alt=""
        />
        <span className="max-[381px]:hidden">
          whirlfolio<span className="text-ring">.</span>
        </span>
      </a>
      <nav
        aria-label="Portfolio sections"
        className={`${surface} pointer-events-auto flex h-13.5 items-center px-2 py-1 max-wide:fixed max-wide:bottom-[max(16px,env(safe-area-inset-bottom))] max-wide:left-1/2 max-wide:w-max max-wide:-translate-x-1/2 max-reader:w-[calc(100%-32px)] max-reader:max-w-[500px] max-reader:justify-between max-reader:p-1`}
      >
        {sections.map((section) => (
          <Button
            key={section.id}
            asChild
            variant="ghost"
            size="navigation"
            className="px-4 text-[13px] aria-[current=location]:bg-secondary max-reader:flex-1 max-reader:px-[7px] max-reader:text-xs max-[381px]:px-1 max-[381px]:text-[11px]"
          >
            <a
              href={toHash({ mode: navigation.mode, section: section.id })}
              data-collection={section.id}
              aria-current={navigation.section === section.id ? 'location' : undefined}
            >
              {section.title}
            </a>
          </Button>
        ))}
      </nav>
      <nav
        aria-label="View"
        className={`${surface} layout-view-nav pointer-events-auto flex h-13.5 items-center justify-self-end p-1 max-reader:h-12.5 max-reader:p-0.5`}
      >
        <Button
          asChild
          variant={isRoom ? 'default' : 'ghost'}
          size="navigation"
          className="w-[105px] px-[17px] text-xs max-reader:w-[94px] max-reader:px-[11px] max-reader:text-[11px]"
        >
          <a href="#room" aria-current={isRoom ? 'page' : undefined} onClick={onRoom}>
            The room
          </a>
        </Button>
        <Button
          asChild
          variant={isRoom ? 'ghost' : 'default'}
          size="navigation"
          className="w-[105px] px-[17px] text-xs max-reader:w-[94px] max-reader:px-[11px] max-reader:text-[11px]"
        >
          <a href="#portfolio" aria-current={!isRoom ? 'page' : undefined} onClick={onPortfolio}>
            The portfolio
          </a>
        </Button>
      </nav>
    </header>
  );
}
