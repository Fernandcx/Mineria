import { Injectable } from '@angular/core';

declare const THREE: any;

@Injectable({
  providedIn: 'root'
})
export class ArService {
  public scene: any;
  public camera: any;
  public renderer: any;
  public cssRenderer: any; // Para etiquetas flotantes
  public controls: any; // Giroscopio

  constructor() {}

  init(container: HTMLElement) {
    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(
      60, // Ajustado de 75 a 60 para igualar mejor el lente físico de celulares
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    // Posicionar la cámara a la altura típica del celular (~1.5m)
    this.camera.position.set(0, 1.5, 0);

    // Controles de Giroscopio
    if (typeof THREE.DeviceOrientationControls !== 'undefined') {
      this.controls = new THREE.DeviceOrientationControls(this.camera);
    }

    // WebGL Renderer Transparente para ver el video debajo
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setClearColor(0x000000, 0); // Totalmente transparente
    this.renderer.domElement.style.position = 'absolute';
    this.renderer.domElement.style.top = '0';
    this.renderer.domElement.style.zIndex = '10';
    this.renderer.xr.enabled = false; // Deshabilitar WebXR para usar AR Simulado
    container.appendChild(this.renderer.domElement);

    // CSS2D Renderer
    this.cssRenderer = new THREE.CSS2DRenderer();
    this.cssRenderer.setSize(window.innerWidth, window.innerHeight);
    this.cssRenderer.domElement.style.position = 'absolute';
    this.cssRenderer.domElement.style.top = '0px';
    this.cssRenderer.domElement.style.zIndex = '11';
    this.cssRenderer.domElement.style.pointerEvents = 'none';
    container.appendChild(this.cssRenderer.domElement);

    // Luces
    const light = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
    light.position.set(0, 20, 0);
    this.scene.add(light);

    window.addEventListener('resize', () => this.onWindowResize(), false);
  }

  private onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.cssRenderer.setSize(window.innerWidth, window.innerHeight);
  }

  setupRenderLoop(customLoop?: (time: number, frame: any) => void) {
    this.renderer.setAnimationLoop((time: number, frame: any) => {
      if (this.controls) {
        this.controls.update(); // Actualizar giroscopio SIEMPRE
      }
      if (customLoop) {
        customLoop(time, frame);
      }
      this.renderer.render(this.scene, this.camera);
      this.cssRenderer.render(this.scene, this.camera);
    });
  }
}
