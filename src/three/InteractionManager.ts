import * as THREE from 'three';
import { CardMesh } from './CardMesh';
import { SceneManager } from './SceneManager';

export interface CardClickHandler {
  (cardMesh: CardMesh): void | Promise<void>;
}

export class InteractionManager {
  private sceneManager: SceneManager;
  private domElement: HTMLElement;
  private raycaster: THREE.Raycaster;
  private pointer: THREE.Vector2;
  private isPointerDown: boolean = false;
  private pointerDownPos: { x: number; y: number } = { x: 0, y: 0 };
  private onCardClickListeners: Set<CardClickHandler> = new Set();
  public enabled: boolean = true;

  constructor(sceneManager: SceneManager, domElement: HTMLElement) {
    this.sceneManager = sceneManager;
    this.domElement = domElement;
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();

    this.onPointerDown = this.onPointerDown.bind(this);
    this.onPointerUp = this.onPointerUp.bind(this);

    this.domElement.addEventListener('pointerdown', this.onPointerDown);
    this.domElement.addEventListener('pointerup', this.onPointerUp);
  }

  public onCardClick(handler: CardClickHandler): () => void {
    this.onCardClickListeners.add(handler);
    return () => this.onCardClickListeners.delete(handler);
  }

  private onPointerDown(e: PointerEvent): void {
    if (!this.enabled) return;
    this.isPointerDown = true;
    this.pointerDownPos = { x: e.clientX, y: e.clientY };
  }

  private onPointerUp(e: PointerEvent): void {
    if (!this.enabled || !this.isPointerDown) return;
    this.isPointerDown = false;

    // Reject if moved more than 10px (drag vs click)
    const dx = e.clientX - this.pointerDownPos.x;
    const dy = e.clientY - this.pointerDownPos.y;
    if (Math.hypot(dx, dy) > 10) return;

    const rect = this.domElement.getBoundingClientRect();
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.pointer, this.sceneManager.camera);
    const intersects = this.raycaster.intersectObjects(
      this.sceneManager.cardContainer.children,
      true
    );

    if (intersects.length > 0) {
      // Find the topmost CardMesh ancestor
      let targetObj: THREE.Object3D | null = intersects[0].object;
      while (targetObj && !(targetObj instanceof CardMesh) && targetObj.parent) {
        targetObj = targetObj.parent;
      }

      if (targetObj instanceof CardMesh) {
        this.notifyCardClick(targetObj);
      }
    }
  }

  private notifyCardClick(cardMesh: CardMesh): void {
    this.onCardClickListeners.forEach((handler) => {
      Promise.resolve().then(() => handler(cardMesh)).catch((err) => {
        console.error('Error in card click handler:', err);
      });
    });
  }

  public dispose(): void {
    this.domElement.removeEventListener('pointerdown', this.onPointerDown);
    this.domElement.removeEventListener('pointerup', this.onPointerUp);
    this.onCardClickListeners.clear();
  }
}
