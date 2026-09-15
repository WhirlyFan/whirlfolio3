export type SectionId = 'projects' | 'experience' | 'photography' | 'about';
export type RoomAction = SectionId | 'fan' | 'bird' | 'guitar' | 'stressball';
export interface RoomAnimationState {
  fanSpeed: 0 | 1 | 2;
  reducedMotion: boolean;
  activeAction: RoomAction | null;
  actionStartedAt: number;
}
