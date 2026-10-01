import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { CardMesh } from './CardMesh';
import { CardAnimator } from './CardAnimator';

describe('CardAnimator cancellation', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('resolves a canceled tween without moving its card', async () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    });
    const animator = CardAnimator.getInstance();
    const mesh = {
      position: new THREE.Vector3(),
      rotation: new THREE.Euler(),
      isFaceUp: true,
    } as CardMesh;

    const animation = animator.moveTo(mesh, { x: 5, y: 2, z: 1 });
    animator.cancel(mesh);
    await expect(animation).resolves.toBeUndefined();

    frames[0](performance.now() + 500);
    expect(mesh.position.toArray()).toEqual([0, 0, 0]);
  });
});
