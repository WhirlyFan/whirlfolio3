import * as React from 'react';

const RIPPLE_LIFETIME_MS = 600;
const MAX_RIPPLES = 4;
interface Ripple {
  id: number;
  x: number;
  y: number;
  diameter: number;
}

/** Decoration only: native button/link semantics and activation timing stay untouched. */
export function useButtonRipple() {
  const [ripples, setRipples] = React.useState<Ripple[]>([]);
  const sequence = React.useRef(0);
  const remove = React.useCallback((id: number) => {
    setRipples((current) => current.filter((ripple) => ripple.id !== id));
  }, []);

  function add(element: HTMLElement, clientPoint?: { x: number; y: number }) {
    if (
      element.matches(':disabled, [aria-disabled="true"]') ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    )
      return;
    const bounds = element.getBoundingClientRect();
    const width = element.clientWidth;
    const height = element.clientHeight;
    if (!bounds.width || !bounds.height) return;
    const x = clientPoint
      ? ((clientPoint.x - bounds.left) * element.offsetWidth) / bounds.width - element.clientLeft
      : width / 2;
    const y = clientPoint
      ? ((clientPoint.y - bounds.top) * element.offsetHeight) / bounds.height - element.clientTop
      : height / 2;
    const diameter = 2 * Math.hypot(Math.max(x, width - x), Math.max(y, height - y));
    const ripple = { id: ++sequence.current, x, y, diameter };
    setRipples((current) => [...current.slice(-(MAX_RIPPLES - 1)), ripple]);
  }

  return {
    pointerDown(event: React.PointerEvent<HTMLElement>) {
      if (!event.defaultPrevented && event.button === 0 && event.isPrimary)
        add(event.currentTarget, { x: event.clientX, y: event.clientY });
    },
    click(event: React.MouseEvent<HTMLElement>) {
      // Native keyboard/assistive activation has no pointer position. Avoid a second ripple after a pointer press.
      if (!event.defaultPrevented && event.detail === 0) add(event.currentTarget);
    },
    cancel() {
      setRipples([]);
    },
    layer: (
      <span aria-hidden="true" className="button-ripple-clip">
        {ripples.map((ripple) => (
          <ButtonRipple key={ripple.id} ripple={ripple} remove={remove} />
        ))}
      </span>
    ),
  };
}

function ButtonRipple({ ripple, remove }: { ripple: Ripple; remove(id: number): void }) {
  React.useEffect(() => {
    // animationend is not delivered when motion preference changes or an animation is cancelled.
    const timer = window.setTimeout(() => remove(ripple.id), RIPPLE_LIFETIME_MS);
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const stop = () => {
      if (media.matches) remove(ripple.id);
    };
    media.addEventListener('change', stop);
    return () => {
      window.clearTimeout(timer);
      media.removeEventListener('change', stop);
    };
  }, [ripple.id, remove]);

  return (
    <span
      data-button-ripple=""
      className="button-ripple"
      style={{
        left: ripple.x,
        top: ripple.y,
        width: ripple.diameter,
        height: ripple.diameter,
        animationDuration: `${RIPPLE_LIFETIME_MS}ms`,
      }}
      onAnimationEnd={() => remove(ripple.id)}
    />
  );
}
