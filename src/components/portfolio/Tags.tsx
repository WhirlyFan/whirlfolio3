import { Badge } from '../ui/badge';
import { cn } from '../../lib/utils';

export type Presentation = 'compact' | 'editorial';

export function Tags({
  tags,
  presentation = 'compact',
}: {
  tags: string[];
  presentation?: Presentation;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((tag) => (
        <Badge
          key={tag}
          variant="outline"
          className={cn(
            'font-normal',
            presentation === 'editorial'
              ? 'rounded-tag px-2 py-0.75 text-[11px] leading-[1.5]'
              : 'rounded-sm px-2 py-0.5 text-[9px] text-foreground',
          )}
        >
          {tag}
        </Badge>
      ))}
    </div>
  );
}
