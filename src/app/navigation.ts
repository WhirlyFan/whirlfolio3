import type { SectionId } from '../room/types';
export interface Navigation {
  mode: 'room' | 'portfolio';
  section: SectionId | null;
}
const sections = new Set<SectionId>(['projects', 'experience', 'photography', 'about']);
export function parseHash(hash: string): Navigation {
  const [mode, section, extra] = hash.replace(/^#/, '').split('/');
  if (
    (mode !== 'room' && mode !== 'portfolio') ||
    extra !== undefined ||
    (section !== undefined && !sections.has(section as SectionId))
  ) {
    return { mode: 'room', section: null };
  }
  return { mode, section: (section as SectionId) ?? null };
}
export function toHash({ mode, section }: Navigation): string {
  return `#${mode}${section ? `/${section}` : ''}`;
}
