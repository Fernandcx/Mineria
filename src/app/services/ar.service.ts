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

  // WebXR Properties
  public xrSession: any = null;
  public hitTestSource: any = null;
  public localReferenceSpace: any = null;
  public hitTestSourceRequested: boolean = false;

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
    this.renderer.xr.enabled = false; // Deshabilitar WebXR por defecto, se habilita al iniciar sesión WebXR
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

  async isWebXRSupported(): Promise<boolean> {
    if ('xr' in navigator) {
      try {
        return await (navigator as any).xr.isSessionSupported('immersive-ar');
      } catch (e) {
        return false;
      }
    }
    return false;
  }

  async startWebXRSession(overlayElement: HTMLElement, onSessionStart: () => void, onSessionEnd: () => void) {
    if (!('xr' in navigator)) return;

    const sessionInit = {
      requiredFeatures: ['hit-test'],
      optionalFeatures: ['dom-overlay'],
      domOverlay: { root: overlayElement }
    };

    try {
      const session = await (navigator as any).xr.requestSession('immersive-ar', sessionInit);
      this.renderer.xr.enabled = true;
      await this.renderer.xr.setSession(session);
      this.xrSession = session;
      this.hitTestSource = null;
      this.hitTestSourceRequested = false;

      session.addEventListener('end', () => {
        this.xrSession = null;
        this.hitTestSource = null;
        this.hitTestSourceRequested = false;
        this.renderer.xr.enabled = false;
        onSessionEnd();
      });

      onSessionStart();
    } catch (err) {
      console.error('Error starting WebXR session:', err);
      alert('No se pudo iniciar la sesión WebXR: ' + err);
    }
  }

  getHitTestResult(frame: any): any {
    if (!this.xrSession || !frame) return null;

    if (!this.hitTestSourceRequested) {
      const session = this.renderer.xr.getSession();
      session.requestReferenceSpace('viewer').then((referenceSpace: any) => {
        session.requestHitTestSource({ space: referenceSpace }).then((source: any) => {
          this.hitTestSource = source;
        });
      });
      session.requestReferenceSpace('local').then((space: any) => {
        this.localReferenceSpace = space;
      });
      this.hitTestSourceRequested = true;
    }

    if (this.hitTestSource && this.localReferenceSpace) {
      const hitTestResults = frame.getHitTestResults(this.hitTestSource);
      if (hitTestResults.length > 0) {
        const hit = hitTestResults[0];
        const pose = hit.getPose(this.localReferenceSpace);
        return pose;
      }
    }
    return null;
  }

  setupRenderLoop(customLoop?: (time: number, frame: any) => void) {
    this.renderer.setAnimationLoop((time: number, frame: any) => {
      if (this.controls && !this.xrSession) {
        this.controls.update(); // Actualizar giroscopio SIEMPRE en AR Simulado
      }
      if (customLoop) {
        customLoop(time, frame);
      }
      this.renderer.render(this.scene, this.camera);
      this.cssRenderer.render(this.scene, this.camera);
    });
  }
}
