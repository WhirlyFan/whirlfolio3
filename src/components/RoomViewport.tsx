import { useEffect, useRef, useState } from 'react';
import type { RoomAction, SectionId } from '../room/types';
import type { RoomRuntime, RuntimeState } from '../room/pixi/runtime';

interface Props {
  state: RuntimeState;
  section: SectionId | null;
  onAction(action: RoomAction): void;
}
export function RoomViewport({ state, section, onAction }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const runtime = useRef<RoomRuntime | null>(null);
  const latest = useRef({ state, section, onAction });
  latest.current = { state, section, onAction };
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let canceled = false;
    const controller = new AbortController();
    import('../room/pixi/runtime')
      .then(async ({ mountRoom }) => {
        if (canceled || !host.current) return;
        const instance = await mountRoom(host.current, {
          signal: controller.signal,
          initialState: latest.current.state,
          onAction: (action) => latest.current.onAction(action),
          onReady: () => {
            if (!canceled) setReady(true);
          },
          onError: (message) => {
            if (canceled) return;
            setError(message);
            setReady(false);
          },
        });
        if (canceled) {
          instance.dispose();
          return;
        }
        runtime.current = instance;
        instance.setState(latest.current.state);
        instance.focus(latest.current.section);
      })
      .catch(() => {
        if (!canceled) setError('The room couldn’t open on this device.');
      });
    return () => {
      canceled = true;
      controller.abort();
      runtime.current?.dispose();
      runtime.current = null;
    };
  }, []);
  useEffect(() => {
    runtime.current?.setState(state);
  }, [state]);
  useEffect(() => {
    runtime.current?.focus(section);
  }, [section]);
  return (
    <div className="room-stage" data-testid="room-stage" data-ready={ready}>
      <div className="room-canvas-host" ref={host} />
      {!ready && !error && (
        <div className="room-loading" role="status">
          <span className="loading-fan">✳</span>
          <p>Opening the window…</p>
          <a href="#portfolio">Read the portfolio while the room opens</a>
        </div>
      )}
      {error && (
        <div className="room-loading room-error" role="status">
          <p>{error}</p>
          <span>Everything is still here in the reading view.</span>
          <a className="primary-link" href="#portfolio">
            Read the portfolio
          </a>
        </div>
      )}
    </div>
  );
}
