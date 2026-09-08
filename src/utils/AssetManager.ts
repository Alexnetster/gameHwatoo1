import * as THREE from 'three';
import { CardDef } from '../game/types';

export class AssetManager {
  private static instance: AssetManager;
  private textures: Map<string, THREE.CanvasTexture> = new Map();
  private cardImageUrls: Map<string, string> = new Map();
  private backTexture: THREE.CanvasTexture | null = null;
  private isLoaded: boolean = false;

  private constructor() {}

  public static getInstance(): AssetManager {
    if (!AssetManager.instance) {
      AssetManager.instance = new AssetManager();
    }
    return AssetManager.instance;
  }

  public async loadAll(svgUrl: string = '/cards/Hwatu_overview.svg'): Promise<void> {
    if (this.isLoaded) return;

    // Load SVG as Image
    const img = await this.loadImage(svgUrl);

    // The source sheet is arranged as 3 month blocks x 4 rows.
    // Each block contains four cards for one month, left to right.
    // Rows contain these month blocks: [1,2,3], [4,5,6], [7,8,9], [10,11,12].
    const COL_CENTERS = [51.6, 160.15, 269.35, 377.9, 498.8, 607.35, 716.55, 825.1, 947.3, 1055.8, 1165, 1273.6];
    const ROW_CENTERS = [84.1, 270.4, 457.85, 647.6];
    const MONTH_SPRITE_BLOCK: Record<number, { block: number; row: number }> = {
      1: { block: 0, row: 0 },
      2: { block: 1, row: 0 },
      3: { block: 2, row: 0 },
      4: { block: 0, row: 1 },
      5: { block: 1, row: 1 },
      6: { block: 2, row: 1 },
      7: { block: 0, row: 2 },
      8: { block: 1, row: 2 },
      9: { block: 2, row: 2 },
      10: { block: 0, row: 3 },
      11: { block: 1, row: 3 },
      12: { block: 2, row: 3 },
    };
    const HALF_W = 51.6;
    const HALF_H = 84.1;
    const CARD_W = 103.2;
    const CARD_H = 168.2;

    // Scale up for high-resolution crisp textures on mobile screens (2.5x)
    const SCALE = 2.5;
    const svgWidth = 1326;
    const svgHeight = 732;

    const masterCanvas = document.createElement('canvas');
    masterCanvas.width = svgWidth * SCALE;
    masterCanvas.height = svgHeight * SCALE;
    const masterCtx = masterCanvas.getContext('2d');
    if (!masterCtx) throw new Error('Failed to get 2d context for master canvas');

    masterCtx.imageSmoothingEnabled = true;
    masterCtx.imageSmoothingQuality = 'high';
    masterCtx.drawImage(img, 0, 0, masterCanvas.width, masterCanvas.height);

    const outW = Math.round(CARD_W * SCALE);
    const outH = Math.round(CARD_H * SCALE);

    // Inner window dimensions (from SVG id="b" path: 90.6 x 153.8, corner radius ~ 7)
    const innerW = 90.6 * SCALE;
    const innerH = 153.8 * SCALE;
    const innerR = 7 * SCALE;
    const innerX = (outW - innerW) / 2;
    const innerY = (outH - innerH) / 2;

    // Slice all 48 cards from the actual 3-block x 4-row source layout.
    for (let month = 1; month <= 12; month++) {
      const source = MONTH_SPRITE_BLOCK[month];
      for (let row = 0; row < 4; row++) {
        const sourceCol = source.block * 4 + row;
        const sx = Math.max(0, (COL_CENTERS[sourceCol] - HALF_W) * SCALE);
        const sy = Math.max(0, (ROW_CENTERS[source.row] - HALF_H) * SCALE);
        const sw = CARD_W * SCALE;
        const sh = CARD_H * SCALE;

        const cardCanvas = document.createElement('canvas');
        cardCanvas.width = outW;
        cardCanvas.height = outH;
        const cardCtx = cardCanvas.getContext('2d');
        if (!cardCtx) continue;

        // 1. Fill entire card background with the red border color (#EF1D1E)
        // This ensures the rounded corners and edges have zero white bleed
        cardCtx.fillStyle = '#EF1D1E';
        cardCtx.fillRect(0, 0, outW, outH);

        // 2. Fill the inner window where the illustration goes with pure white (#FFFFFF)
        cardCtx.fillStyle = '#FFFFFF';
        this.drawRoundedRect(cardCtx, innerX, innerY, innerW, innerH, innerR);
        cardCtx.fill();

        // 3. Draw the SVG card layer on top
        cardCtx.imageSmoothingEnabled = true;
        cardCtx.imageSmoothingQuality = 'high';
        cardCtx.drawImage(masterCanvas, sx, sy, sw, sh, 0, 0, outW, outH);

        const texture = new THREE.CanvasTexture(cardCanvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;

        const monthStr = month.toString().padStart(2, '0');
        const cardStr = (row + 1).toString().padStart(2, '0');
        const cardId = `${monthStr}_${cardStr}`;

        this.textures.set(cardId, texture);
        this.cardImageUrls.set(cardId, cardCanvas.toDataURL('image/png'));
      }
    }

    // Generate Card Back texture (Classic Korean Hwatu Crimson Back with subtle pattern)
    this.backTexture = this.createBackTexture(outW, outH);
    this.isLoaded = true;
  }

  private createBackTexture(width: number, height: number): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get context for card back');

    // Base deep red / crimson
    ctx.fillStyle = '#A31314';
    ctx.fillRect(0, 0, width, height);

    // Subtle dark border
    ctx.lineWidth = Math.max(2, Math.round(width * 0.04));
    ctx.strokeStyle = '#73090A';
    ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, width - ctx.lineWidth, height - ctx.lineWidth);

    // Embossed inner border
    ctx.lineWidth = Math.max(1, Math.round(width * 0.015));
    ctx.strokeStyle = '#C92A2B';
    const inset = width * 0.08;
    ctx.strokeRect(inset, inset, width - inset * 2, height - inset * 2);

    // Diamond grid pattern
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;
    const step = width * 0.12;
    for (let x = -height; x < width + height; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + height, height);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(x, height);
      ctx.lineTo(x + height, 0);
      ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  public getCardTexture(card: CardDef): THREE.CanvasTexture | undefined {
    return this.textures.get(card.id);
  }

  public getBackTexture(): THREE.CanvasTexture {
    if (!this.backTexture) {
      throw new Error('AssetManager: Assets not loaded yet. Call loadAll() first.');
    }
    return this.backTexture;
  }

  public getCardImageUrl(card: CardDef): string {
    return this.cardImageUrls.get(card.id) ?? '';
  }

  private drawRoundedRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  private loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = (err) => reject(err);
      img.src = src;
    });
  }
}
