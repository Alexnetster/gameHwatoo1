import { describe, expect, it } from 'vitest';
import { getLayoutScaleForAspect } from './SceneManager';

describe('SceneManager responsive layout scale', () => {
  it('keeps desktop and tablet layouts at native scale', () => {
    expect(getLayoutScaleForAspect(0.75)).toBe(1);
    expect(getLayoutScaleForAspect(1)).toBe(1);
    expect(getLayoutScaleForAspect(1.78)).toBe(1);
  });

  it('scales narrow portrait layouts without shrinking below the floor', () => {
    expect(getLayoutScaleForAspect(0.6)).toBeCloseTo(0.8);
    expect(getLayoutScaleForAspect(0.51)).toBeCloseTo(0.68);
    expect(getLayoutScaleForAspect(0.3)).toBe(0.68);
  });
});
