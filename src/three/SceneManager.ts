import * as THREE from 'three';

export function getLayoutScaleForAspect(aspect: number): number {
  return aspect < 0.75 ? Math.max(0.68, aspect / 0.75) : 1;
}

export class SceneManager {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  public cardContainer: THREE.Group;
  public layoutScale = 1;
  private tableMesh: THREE.Mesh;
  private readonly container: HTMLElement;
  private readonly handleResize: () => void;
  private animationFrameId: number | null = null;
  private disposed = false;

  constructor(container: HTMLElement) {
    this.container = container;
    this.handleResize = () => this.onResize(container);
    // 1. Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1B2A22); // Deep modern green table environment

    // 2. Camera (2.5D slightly tilted perspective view)
    const aspect = container.clientWidth / container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(40, aspect, 0.1, 100);
    this.updateCameraForAspect(aspect);

    // 3. Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    container.appendChild(this.renderer.domElement);

    // 4. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xfff7ea, 1.2);
    dirLight.position.set(3, 5, 8);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 25;
    dirLight.shadow.bias = -0.001;
    this.scene.add(dirLight);

    // 5. Game Table (Felt mat)
    const tableGeo = new THREE.PlaneGeometry(16, 24);
    const tableMat = new THREE.MeshStandardMaterial({
      color: 0x1E382B,
      roughness: 0.85,
      metalness: 0.05,
    });
    this.tableMesh = new THREE.Mesh(tableGeo, tableMat);
    this.tableMesh.receiveShadow = true;
    this.tableMesh.position.z = -0.01;
    this.scene.add(this.tableMesh);

    // 6. Card Container Group
    this.cardContainer = new THREE.Group();
    this.cardContainer.scale.setScalar(this.layoutScale);
    this.scene.add(this.cardContainer);

    // 7. Resize handling
    window.addEventListener('resize', this.handleResize);

    // 8. Start render loop
    this.render();
  }

  private updateCameraForAspect(aspect: number): void {
    // For mobile portrait (aspect < 0.6), camera sits slightly further away
    if (aspect < 0.6) {
      this.camera.position.set(0, -0.4, 9.5);
    } else if (aspect < 1.2) {
      this.camera.position.set(0, -0.25, 9.8);
    } else {
      this.camera.position.set(0, -0.2, 8.5);
    }
    // Keep the complete 10-card hand inside the narrowest phone viewport.
    this.layoutScale = getLayoutScaleForAspect(aspect);
    if (this.cardContainer) this.cardContainer.scale.setScalar(this.layoutScale);
    this.camera.lookAt(0, 0, 0);
  }

  public onResize(container: HTMLElement): void {
    const width = container.clientWidth;
    const height = container.clientHeight;
    const aspect = width / height;

    this.camera.aspect = aspect;
    this.updateCameraForAspect(aspect);
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  }

  public render = (): void => {
    if (this.disposed) return;
    this.animationFrameId = requestAnimationFrame(this.render);
    this.renderer.render(this.scene, this.camera);
  };

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    window.removeEventListener('resize', this.handleResize);
    if (this.animationFrameId !== null) cancelAnimationFrame(this.animationFrameId);

    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => material.dispose());
      }
    });
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
    this.container.replaceChildren();
  }
}
