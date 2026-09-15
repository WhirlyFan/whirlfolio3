import { Fan, Pause, Play } from 'lucide-react';
import type { Quality } from '../room/policy';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

interface Props {
  fanSpeed: 0 | 1 | 2;
  paused: boolean;
  quality: Quality;
  reducedMotion: boolean;
  onFan(): void;
  onPause(): void;
  onQuality(value: Quality): void;
}

export function RoomControls({
  fanSpeed,
  paused,
  quality,
  reducedMotion,
  onFan,
  onPause,
  onQuality,
}: Props) {
  const fanLabel = ['off', 'low', 'high'][fanSpeed];
  const MotionIcon = paused ? Play : Pause;
  return (
    <div className="room-settings mt-1 flex flex-wrap items-center justify-between gap-x-1 border-t border-border pt-1">
      <Button
        variant="ghost"
        className="h-11 gap-1.5 px-2 text-[11px]"
        onClick={onFan}
        aria-label={`Fan speed: ${fanLabel}`}
      >
        <Fan className="size-3.5" aria-hidden="true" /> Fan: {fanLabel}
      </Button>
      <Button
        variant={paused ? 'secondary' : 'ghost'}
        className="h-11 gap-1.5 px-2 text-[11px]"
        onClick={onPause}
        aria-pressed={paused}
      >
        <MotionIcon className="size-3.5" aria-hidden="true" />{' '}
        {paused ? 'Resume motion' : 'Pause motion'}
      </Button>
      <div className="flex items-center gap-1">
        <label className="hidden text-[10px] text-muted-foreground sm:block" htmlFor="room-detail">
          Detail
        </label>
        <Select value={quality} onValueChange={(value) => onQuality(value as Quality)}>
          <SelectTrigger
            id="room-detail"
            aria-label="Detail"
            className="min-h-11 w-[78px] border-0 bg-transparent px-2 text-[11px] shadow-none"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper" side="top" align="end">
            <SelectItem value="auto">Auto</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {reducedMotion && (
        <Badge variant="secondary" className="mx-auto mb-1 text-[10px]">
          Reduced motion
        </Badge>
      )}
    </div>
  );
}
