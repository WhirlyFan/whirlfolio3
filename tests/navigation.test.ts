import { describe, expect, it } from 'vitest';
import { parseHash, toHash } from '../src/app/navigation';

describe('portfolio navigation', () => {
  it('opens a directly linked room collection', () => {
    expect(parseHash('#room/photography')).toEqual({ mode: 'room', section: 'photography' });
  });
  it('keeps conventional portfolio links separate from room dialogs', () => {
    expect(parseHash('#portfolio/experience')).toEqual({
      mode: 'portfolio',
      section: 'experience',
    });
    expect(parseHash('#portfolio')).toEqual({ mode: 'portfolio', section: null });
  });
  it('recovers unknown and malformed links without opening arbitrary content', () => {
    for (const hash of ['#unknown', '#room/%ZZ', '#room/projects/extra', '#portfolio/<script>']) {
      expect(parseHash(hash)).toEqual({ mode: 'room', section: null });
    }
  });
  it('keeps collection links shareable', () => {
    expect(toHash({ mode: 'room', section: 'projects' })).toBe('#room/projects');
    expect(toHash({ mode: 'portfolio', section: null })).toBe('#portfolio');
  });
});
