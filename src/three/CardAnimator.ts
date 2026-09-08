import * as THREE from 'three';
import { CardMesh } from './CardMesh';

export interface TweenItem {
  mesh: CardMesh;
  startPos: THREE.Vector3;
  targetPos: THREE.Vector3;
  startRot: THREE.Euler;
  targetRot: THREE.Euler;
  duration: number; // in ms
  elapsed: number;
  easing: (t: number) => number;
  onComplete?: () => void;
  resolvePromise?: () => void;
}

export class CardAnimator {
  private static instance: CardAnimator;
  private activeTweens: TweenItem[] = [];
  private lastTime: number = performance.now();

  private constructor() {
    this.tick = this.tick.bind(this);
    requestAnimationFrame(this.tick);
  }

  public static getInstance(): CardAnimator {
    if (!CardAnimator.instance) {
      CardAnimator.instance = new CardAnimator();
    }
    return CardAnimator.instance;
  }

  public moveTo(
    mesh: CardMesh,
    targetPos: { x: number; y: number; z?: number },
    targetRotZ: number = mesh.rotation.z,
    faceUp?: boolean,
    durationMs: number = 220
  ): Promise<void> {
    return new Promise((resolve) => {
      const startPos = mesh.position.clone();
      const endPos = new THREE.Vector3(targetPos.x, targetPos.y, targetPos.z ?? mesh.position.z);

      const startRot = mesh.rotation.clone();
      const endRotY = faceUp === undefined ? mesh.rotation.y : faceUp ? 0 : Math.PI;
      const endRot = new THREE.Euler(mesh.rotation.x, endRotY, targetRotZ);

      if (faceUp !== undefined) {
        mesh.isFaceUp = faceUp;
      }

      this.activeTweens.push({
        mesh,
        startPos,
        targetPos: endPos,
        startRot,
        targetRot: endRot,
        duration: Math.max(durationMs, 10),
        elapsed: 0,
        easing: this.easeOutCubic,
        resolvePromise: resolve,
      });
    });
  }

  private easeOutCubic(t: number): number {
    return 1 - Math.pow(1 - t, 3);
  }

  private tick(currentTime: number): void {
    const delta = currentTime - this.lastTime;
    this.lastTime = currentTime;

    for (let i = this.activeTweens.length - 1; i >= 0; i--) {
      const tween = this.activeTweens[i];
      tween.elapsed += delta;
      const progress = Math.min(1, tween.elapsed / tween.duration);
      const ease = tween.easing(progress);

      // Lerp Position
      tween.mesh.position.lerpVectors(tween.startPos, tween.targetPos, ease);

      // Slerp / Lerp Rotation
      tween.mesh.rotation.x = THREE.MathUtils.lerp(tween.startRot.x, tween.targetRot.x, ease);
      tween.mesh.rotation.y = THREE.MathUtils.lerp(tween.startRot.y, tween.targetRot.y, ease);
      tween.mesh.rotation.z = THREE.MathUtils.lerp(tween.startRot.z, tween.targetRot.z, ease);

      if (progress >= 1) {
        tween.mesh.position.copy(tween.targetPos);
        tween.mesh.rotation.copy(tween.targetRot);
        this.activeTweens.splice(i, 1);
        if (tween.onComplete) tween.onComplete();
        if (tween.resolvePromise) tween.resolvePromise();
      }
    }

    requestAnimationFrame(this.tick);
  }
}
