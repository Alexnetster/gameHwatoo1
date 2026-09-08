import * as THREE from 'three';
import { CardDef } from '../game/types';
import { AssetManager } from '../utils/AssetManager';

export const CARD_WIDTH = 0.7;
export const CARD_HEIGHT = 1.1;
export const CARD_DEPTH = 0.02;

export class CardMesh extends THREE.Group {
  public cardDef: CardDef;
  private mesh: THREE.Mesh;
  private frontMaterial: THREE.MeshStandardMaterial;
  private backMaterial: THREE.MeshStandardMaterial;
  private edgeMaterial: THREE.MeshStandardMaterial;
  public isFaceUp: boolean = true;

  constructor(cardDef: CardDef, isFaceUp: boolean = true) {
    super();
    this.cardDef = cardDef;
    this.isFaceUp = isFaceUp;

    const assets = AssetManager.getInstance();
    const faceTexture = assets.getCardTexture(cardDef);
    const backTexture = assets.getBackTexture();

    const geometry = new THREE.BoxGeometry(CARD_WIDTH, CARD_HEIGHT, CARD_DEPTH);

    this.edgeMaterial = new THREE.MeshStandardMaterial({
      color: 0xBF191A,
      roughness: 0.5,
      metalness: 0.1,
    });

    this.frontMaterial = new THREE.MeshStandardMaterial({
      map: faceTexture,
      roughness: 0.35,
      metalness: 0.05,
    });

    this.backMaterial = new THREE.MeshStandardMaterial({
      map: backTexture,
      roughness: 0.35,
      metalness: 0.05,
    });

    // BoxGeometry material order: [right, left, top, bottom, front, back]
    const materials: THREE.Material[] = [
      this.edgeMaterial,
      this.edgeMaterial,
      this.edgeMaterial,
      this.edgeMaterial,
      this.frontMaterial,
      this.backMaterial,
    ];

    this.mesh = new THREE.Mesh(geometry, materials);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;

    // Attach reference to userData for raycasting
    this.mesh.userData = { cardMesh: this, cardDef: this.cardDef };

    this.add(this.mesh);
    this.setFaceUp(isFaceUp);
  }

  public setFaceUp(faceUp: boolean): void {
    this.isFaceUp = faceUp;
    // When face-up, rotation.y = 0. When face-down, rotation.y = Math.PI
    this.rotation.y = faceUp ? 0 : Math.PI;
  }

  /** Scale the card inside its responsive table layout without changing its aspect ratio. */
  public setDisplayScale(scale: number): void {
    this.scale.setScalar(scale);
  }

  public setSelectState(selected: boolean, baseY: number): void {
    if (selected) {
      this.frontMaterial.emissive.setHex(0x332211);
      this.setDisplayScale(1.08);
      this.position.y = baseY + 0.35;
      this.position.z = 0.2;
    } else {
      this.frontMaterial.emissive.setHex(0x000000);
      this.setDisplayScale(1);
      this.position.y = baseY;
      this.position.z = 0.02;
    }
  }

  public setMatchHighlight(isTarget: boolean): void {
    if (isTarget) {
      this.frontMaterial.emissive.setHex(0x224422);
      this.setDisplayScale(1.04);
      this.position.z = 0.12;
    } else {
      this.frontMaterial.emissive.setHex(0x000000);
      this.setDisplayScale(1);
      this.position.z = 0.01;
    }
  }
}
