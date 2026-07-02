import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { ArService } from '../services/ar.service';
import { ActivatedRoute, Router } from '@angular/router';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

declare const THREE: any;

type SurfaceMode = 'floor' | 'wall';

interface Surface {
  mode: SurfaceMode;
  puntos: any[];
  solidMesh: any;
  gridMesh: any;
  edgeMesh: any;
  wallIndex?: number; // para paredes: índice de orientación
}

@Component({
  selector: 'app-scan-room',
  templateUrl: './scan-room.page.html',
  styleUrls: ['./scan-room.page.scss'],
})
export class ScanRoomPage implements OnInit {
  @ViewChild('arContainer', { static: true }) arContainer!: ElementRef;
  @ViewChild('cameraVideo', { static: true }) cameraVideo!: ElementRef;

  // Modo actual: suelo o pared
  surfaceMode: SurfaceMode = 'floor';

  // Puntos del trazo actual
  puntos: any[] = [];
  medidas: { id: number; distancia: string }[] = [];

  // Superficies completadas
  surfaces: Surface[] = [];

  isSupported = true;
  isSessionActive = false;
  raycaster = new THREE.Raycaster();

  reticle: any;

  // Plano de suelo virtual (Y=0)
  floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  // Plano de pared virtual (Z = distancia frontal estimada)
  wallDistance = 2.0; // metros al frente
  wallPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -this.wallDistance);

  // ── Nuevas variables para WebXR y Modo Foto ────────────────────────────
  activeMode: 'ar' | 'photo' = 'ar';
  webXRAvailable = false;
  isWebXRActive = false;

  // Onboarding
  showOnboarding = true;

  // Modo Foto 2D
  photoUrl: string | null = null;
  photoPoints: { x: number; y: number }[] = [];
  photoScale: number = 0.02; // Escala automática por defecto (2 cm por píxel)
  photoSurfaces: { points: { x: number; y: number }[] }[] = [];

  // Resultados Foto 2D
  photoArea: number = 0;
  photoPerimeter: number = 0;
  photoVolume: number = 0;
  photoShowResults = false;

  arVolume: number = 0;
  arSurface: number = 0;
  arPerimeter: number = 0;
  showResults: boolean = false;

  constructor(public arService: ArService, private router: Router, private route: ActivatedRoute) {}

  async ngOnInit() {
    this.webXRAvailable = await this.arService.isWebXRSupported();
    this.route.queryParams.subscribe(params => {
      if (params['mode'] === 'photo') {
        this.setWorkMode('photo');
        this.selectPhoto();
      }
    });
  }

  ionViewDidEnter() {
    if (this.activeMode === 'ar') {
      this.startAR();
    }
  }

  async startAR() {
    if (this.isSessionActive) return;
    try {
      await Camera.requestPermissions();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      this.cameraVideo.nativeElement.srcObject = stream;
      this.cameraVideo.nativeElement.style.display = 'block';

      this.arService.init(this.arContainer.nativeElement);

      // Reticle para suelo: anillo horizontal
      const reticleGeo = new THREE.RingGeometry(0.15, 0.2, 32).rotateX(-Math.PI / 2);
      const reticleMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      this.reticle = new THREE.Mesh(reticleGeo, reticleMat);
      this.reticle.visible = false;
      this.arService.scene.add(this.reticle);

      this.arService.setupRenderLoop(this.onRenderFrame.bind(this));
      this.isSessionActive = true;

    } catch (error) {
      alert('No se pudo acceder a la cámara: ' + error);
    }
  }

  async toggleWebXR() {
    if (this.isWebXRActive) {
      if (this.arService.xrSession) {
        this.arService.xrSession.end();
      }
    } else {
      const overlay = document.querySelector('.ar-ui-overlay') as HTMLElement;
      await this.arService.startWebXRSession(
        overlay,
        () => {
          this.isWebXRActive = true;
          this.isSessionActive = true;
          this.cameraVideo.nativeElement.style.display = 'none';
        },
        () => {
          this.isWebXRActive = false;
          this.cameraVideo.nativeElement.style.display = 'block';
          if (this.reticle) {
            this.reticle.visible = false;
          }
        }
      );
    }
  }

  onRenderFrame(time?: number, frame?: any) {
    if (!this.isSessionActive || !this.reticle) return;

    if (this.isWebXRActive && frame) {
      const pose = this.arService.getHitTestResult(frame);
      if (pose) {
        this.reticle.matrix.fromArray(pose.transform.matrix);
        this.reticle.matrix.decompose(this.reticle.position, this.reticle.quaternion, this.reticle.scale);
        this.reticle.visible = true;
      } else {
        this.reticle.visible = false;
      }
    } else {
      this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.arService.camera);

      const target = new THREE.Vector3();

      if (this.surfaceMode === 'floor') {
        // Intersección con plano horizontal (suelo)
        const intersect = this.raycaster.ray.intersectPlane(this.floorPlane, target);
        if (intersect) {
          this.reticle.position.copy(target);
          this.reticle.rotation.set(-Math.PI / 2, 0, 0);
          this.reticle.visible = true;
        } else {
          this.reticle.visible = false;
        }
      } else {
        // Intersección con plano vertical (pared frontal)
        const camDir = new THREE.Vector3();
        this.arService.camera.getWorldDirection(camDir);
        camDir.y = 0;
        camDir.normalize();

        const camPos = this.arService.camera.position.clone();
        const wallNormal = camDir.clone().negate();
        const wallPoint = camPos.clone().add(camDir.clone().multiplyScalar(this.wallDistance));

        const dynamicWallPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(wallNormal, wallPoint);
        const intersect = this.raycaster.ray.intersectPlane(dynamicWallPlane, target);

        if (intersect) {
          this.reticle.position.copy(target);
          this.reticle.rotation.set(0, Math.atan2(camDir.x, camDir.z), 0);
          this.reticle.visible = true;
        } else {
          this.reticle.visible = false;
        }
      }
    }
  }

  setSurfaceMode(mode: SurfaceMode) {
    this.surfaceMode = mode;
  }

  setWorkMode(mode: 'ar' | 'photo') {
    this.activeMode = mode;
    if (mode === 'photo') {
      // Detener cámara AR y WebGL
      this.isSessionActive = false;
      if (this.arService.xrSession) {
        this.arService.xrSession.end();
      }
      if (this.cameraVideo && this.cameraVideo.nativeElement.srcObject) {
        const stream = this.cameraVideo.nativeElement.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
        this.cameraVideo.nativeElement.srcObject = null;
      }
      this.cameraVideo.nativeElement.style.display = 'none';
    } else {
      this.startAR();
    }
  }

  // ── Métodos del Modo Foto 2D ──────────────────────────────────────────
  async selectPhoto() {
    try {
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Photos
      });
      if (image && image.dataUrl) {
        this.photoUrl = image.dataUrl;
        this.resetPhotoScan();
      }
    } catch (err) {
      console.log('Error selecting photo via Capacitor, trying file input:', err);
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = 'image/*';
      fileInput.onchange = (e: any) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (event: any) => {
            this.photoUrl = event.target.result;
            this.resetPhotoScan();
          };
          reader.readAsDataURL(file);
        }
      };
      fileInput.click();
    }
  }

  getSortedPhotoPoints(): { x: number; y: number }[] {
    if (this.photoPoints.length < 3) return this.photoPoints;

    // Calculate centroid
    let cx = 0, cy = 0;
    this.photoPoints.forEach(p => {
      cx += p.x;
      cy += p.y;
    });
    cx /= this.photoPoints.length;
    cy /= this.photoPoints.length;

    // Sort by angle relative to centroid
    return [...this.photoPoints].sort((a, b) => {
      const angleA = Math.atan2(a.y - cy, a.x - cx);
      const angleB = Math.atan2(b.y - cy, b.x - cx);
      return angleA - angleB;
    });
  }

  onPhotoClick(event: MouseEvent) {
    const container = event.currentTarget as HTMLElement;
    const rect = container.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    this.photoPoints.push({ x, y });
    this.recalculatePhotoMetrics();
  }

  recalculatePhotoMetrics() {
    let totalArea = 0;
    let totalPerimeter = 0;

    // Calculate for all saved surfaces
    this.photoSurfaces.forEach(surf => {
      const pts = surf.points;
      const n = pts.length;
      for (let i = 0; i < n; i++) {
        const p1 = pts[i];
        const p2 = pts[(i + 1) % n];
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        totalPerimeter += Math.sqrt(dx * dx + dy * dy);
      }

      let areaPx = 0;
      for (let i = 0; i < n; i++) {
        const pCurrent = pts[i];
        const pNext = pts[(i + 1) % n];
        areaPx += (pCurrent.x * pNext.y) - (pNext.x * pCurrent.y);
      }
      totalArea += Math.abs(areaPx) / 2;
    });

    // Calculate for active points (sorted)
    if (this.photoPoints.length >= 2) {
      const activePts = this.getSortedPhotoPoints();
      const n = activePts.length;

      for (let i = 0; i < n; i++) {
        if (i === n - 1 && n < 3) continue;
        const p1 = activePts[i];
        const p2 = activePts[(i + 1) % n];
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        totalPerimeter += Math.sqrt(dx * dx + dy * dy);
      }

      if (n >= 3) {
        let areaPx = 0;
        for (let i = 0; i < n; i++) {
          const pCurrent = activePts[i];
          const pNext = activePts[(i + 1) % n];
          areaPx += (pCurrent.x * pNext.y) - (pNext.x * pCurrent.y);
        }
        totalArea += Math.abs(areaPx) / 2;
      }
    }

    this.photoPerimeter = totalPerimeter * this.photoScale;
    this.photoArea = totalArea * (this.photoScale * this.photoScale);
    this.photoVolume = this.photoArea * 0.2;
  }

  borrarUltimoPuntoPhoto() {
    this.photoPoints.pop();
    this.recalculatePhotoMetrics();
  }

  guardarAreaActualPhoto() {
    if (this.photoPoints.length < 3) {
      alert("Necesitas al menos 3 puntos para guardar esta área.");
      return;
    }
    const sortedPoints = this.getSortedPhotoPoints();
    this.photoSurfaces.push({ points: sortedPoints });
    this.photoPoints = [];
    this.recalculatePhotoMetrics();
    alert("Área guardada con éxito. Puedes trazar una nueva área sobre la misma foto.");
  }

  resetPhotoScan() {
    this.photoPoints = [];
    this.photoSurfaces = [];
    this.photoShowResults = false;
    this.photoArea = 0;
    this.photoPerimeter = 0;
    this.photoVolume = 0;
  }

  finalizarEscaneoPhoto() {
    if (this.photoPoints.length < 3 && this.photoSurfaces.length === 0) {
      alert("Necesitas al menos un área trazada con 3 puntos para finalizar.");
      return;
    }
    this.photoShowResults = true;
  }

  getSvgPointsString(): string {
    return this.getSortedPhotoPoints().map(p => `${p.x},${p.y}`).join(' ');
  }

  getSvgPointsStringForPoints(points: { x: number; y: number }[]): string {
    return points.map(p => `${p.x},${p.y}`).join(' ');
  }

  getSegmentMidpoint(idx: number): { x: number; y: number } {
    const sorted = this.getSortedPhotoPoints();
    const p1 = sorted[idx];
    const p2 = sorted[(idx + 1) % sorted.length];
    return {
      x: (p1.x + p2.x) / 2,
      y: (p1.y + p2.y) / 2
    };
  }

  getSegmentLength(idx: number): number {
    if (!this.photoScale) return 0;
    const sorted = this.getSortedPhotoPoints();
    const p1 = sorted[idx];
    const p2 = sorted[(idx + 1) % sorted.length];
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const distPixels = Math.sqrt(dx * dx + dy * dy);
    return distPixels * this.photoScale;
  }

  closeOnboarding() {
    this.showOnboarding = false;
  }

  openOnboarding() {
    this.showOnboarding = true;
  }

  agregarPunto() {
    if (!this.isSessionActive || !this.reticle || !this.reticle.visible) {
      alert(this.surfaceMode === 'floor'
        ? 'Apunta hacia el suelo (círculo blanco en pantalla)'
        : 'Apunta hacia la pared frontal');
      return;
    }

    const posicion = new THREE.Vector3().copy(this.reticle.position);
    this.puntos.push(posicion);

    // Nodo esférico blanco
    const sphereGeom = new THREE.SphereGeometry(0.04, 32, 32);
    const sphereMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const sphere = new THREE.Mesh(sphereGeom, sphereMat);
    sphere.position.copy(posicion);
    this.arService.scene.add(sphere);

    if (this.puntos.length > 1) {
      const p1 = this.puntos[this.puntos.length - 2];
      const p2 = this.puntos[this.puntos.length - 1];

      // Tubo conector
      const path = new THREE.LineCurve3(p1, p2);
      const tubeGeom = new THREE.TubeGeometry(path, 20, 0.015, 8, false);
      const tubeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const tube = new THREE.Mesh(tubeGeom, tubeMat);
      this.arService.scene.add(tube);

      const distancia = p1.distanceTo(p2);
      this.medidas.push({ id: this.medidas.length, distancia: distancia.toFixed(2) + ' m' });

      // Etiqueta CSS2D
      const div = document.createElement('div');
      div.className = 'label-3d';
      div.textContent = distancia.toFixed(2) + ' m';
      const midPoint = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
      const label = new THREE.CSS2DObject(div);
      label.position.copy(midPoint);
      this.arService.scene.add(label);
    }

    this.dibujarMallaActual();
  }

  // Meshes del trazo actual (se reemplazan en cada punto nuevo)
  mallaSolidMesh: any = null;
  mallaGridMesh: any = null;
  mallaEdgeMesh: any = null;

  dibujarMallaActual() {
    if (this.puntos.length < 3) return;
    this.limpiarMallaActual();
    this.buildSurfaceMeshes(this.puntos, this.surfaceMode);
  }

  limpiarMallaActual() {
    if (this.mallaSolidMesh) { this.arService.scene.remove(this.mallaSolidMesh); this.mallaSolidMesh = null; }
    if (this.mallaGridMesh) { this.arService.scene.remove(this.mallaGridMesh); this.mallaGridMesh = null; }
    if (this.mallaEdgeMesh) { this.arService.scene.remove(this.mallaEdgeMesh); this.mallaEdgeMesh = null; }
  }

  /**
   * Construye los tres meshes de una superficie (solid + grid + edge)
   * y los asigna a this.mallaSolidMesh / mallaGridMesh / mallaEdgeMesh
   */
  /**
   * Construye los tres meshes de una superficie (solid + grid + edge)
   * y los asigna a this.mallaSolidMesh / mallaGridMesh / mallaEdgeMesh
   */
  buildSurfaceMeshes(puntos: any[], mode: SurfaceMode) {
    const p0 = puntos[0];

    // Newell's method for normal vector calculation
    const normal = new THREE.Vector3();
    if (mode === 'floor') {
      normal.set(0, 1, 0);
    } else {
      if (puntos.length >= 3) {
        for (let i = 0; i < puntos.length; i++) {
          const pCurrent = puntos[i];
          const pNext = puntos[(i + 1) % puntos.length];
          normal.x += (pCurrent.y - pNext.y) * (pCurrent.z + pNext.z);
          normal.y += (pCurrent.z - pNext.z) * (pCurrent.x + pNext.x);
          normal.z += (pCurrent.x - pNext.x) * (pCurrent.y + pNext.y);
        }
        normal.normalize();
      } else {
        normal.set(0, 0, 1);
      }
    }

    const xAxis = new THREE.Vector3().subVectors(puntos[1], p0).normalize();
    if (xAxis.lengthSq() < 0.0001) xAxis.set(1, 0, 0);
    const yAxis = new THREE.Vector3().crossVectors(normal, xAxis).normalize();
    xAxis.crossVectors(yAxis, normal).normalize();

    // ── Proyección a 2D ───────────────────────────────────────────────────
    const pts2D = puntos.map(p => {
      const v = new THREE.Vector3().subVectors(p, p0);
      return new THREE.Vector2(v.dot(xAxis), v.dot(yAxis));
    });

    // ── Solid (fondo blanco muy translúcido, triangulado con Earcut) ──────
    const shape = new THREE.Shape();
    shape.moveTo(pts2D[0].x, pts2D[0].y);
    for (let i = 1; i < pts2D.length; i++) {
      shape.lineTo(pts2D[i].x, pts2D[i].y);
    }
    shape.closePath();

    const solidGeo = new THREE.ShapeGeometry(shape);
    // Aplicar matriz de transformación local a mundial
    const matrix = new THREE.Matrix4().makeBasis(xAxis, yAxis, normal).setPosition(p0);
    solidGeo.applyMatrix4(matrix);
    solidGeo.computeVertexNormals();

    this.mallaSolidMesh = new THREE.Mesh(solidGeo, new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0.08, side: THREE.DoubleSide
    }));
    this.arService.scene.add(this.mallaSolidMesh);

    // ── Ejes locales para cuadrícula ──────────────────────────────────────
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    pts2D.forEach(pt => {
      minX = Math.min(minX, pt.x); maxX = Math.max(maxX, pt.x);
      minY = Math.min(minY, pt.y); maxY = Math.max(maxY, pt.y);
    });

    const gridSize = 0.2; // 20 cm
    const gridVerts3D: number[] = [];

    for (let x = Math.floor(minX / gridSize) * gridSize; x <= maxX + 0.001; x += gridSize) {
      const v1 = p0.clone().add(xAxis.clone().multiplyScalar(x)).add(yAxis.clone().multiplyScalar(minY));
      const v2 = p0.clone().add(xAxis.clone().multiplyScalar(x)).add(yAxis.clone().multiplyScalar(maxY));
      gridVerts3D.push(v1.x, v1.y, v1.z, v2.x, v2.y, v2.z);
    }
    for (let y = Math.floor(minY / gridSize) * gridSize; y <= maxY + 0.001; y += gridSize) {
      const v1 = p0.clone().add(xAxis.clone().multiplyScalar(minX)).add(yAxis.clone().multiplyScalar(y));
      const v2 = p0.clone().add(xAxis.clone().multiplyScalar(maxX)).add(yAxis.clone().multiplyScalar(y));
      gridVerts3D.push(v1.x, v1.y, v1.z, v2.x, v2.y, v2.z);
    }

    const gridGeo = new THREE.BufferGeometry();
    gridGeo.setAttribute('position', new THREE.Float32BufferAttribute(gridVerts3D, 3));
    this.mallaGridMesh = new THREE.LineSegments(gridGeo, new THREE.LineBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0.45
    }));
    this.arService.scene.add(this.mallaGridMesh);

    // ── Borde perimetral brillante ─────────────────────────────────────────
    const borderVerts: number[] = [];
    for (let i = 0; i < puntos.length; i++) {
      const curr = puntos[i];
      const next = puntos[(i + 1) % puntos.length];
      borderVerts.push(curr.x, curr.y, curr.z, next.x, next.y, next.z);
    }
    const borderGeo = new THREE.BufferGeometry();
    borderGeo.setAttribute('position', new THREE.Float32BufferAttribute(borderVerts, 3));
    this.mallaEdgeMesh = new THREE.LineSegments(borderGeo, new THREE.LineBasicMaterial({
      color: 0xffffff, transparent: false, linewidth: 2
    }));
    this.arService.scene.add(this.mallaEdgeMesh);
  }

  /**
   * Cierra la superficie actual, la guarda en el array y resetea el trazo
   */
  cerrarSuperficieActual() {
    if (this.puntos.length < 3) {
      alert('Necesitas al menos 3 puntos para cerrar la superficie.');
      return;
    }

    // Tubo de cierre
    const p1 = this.puntos[this.puntos.length - 1];
    const p2 = this.puntos[0];
    const path = new THREE.LineCurve3(p1, p2);
    const tubeGeom = new THREE.TubeGeometry(path, 20, 0.015, 8, false);
    const tube = new THREE.Mesh(tubeGeom, new THREE.MeshBasicMaterial({ color: 0xffffff }));
    this.arService.scene.add(tube);

    // Guardar meshes actuales como superficie permanente
    this.surfaces.push({
      mode: this.surfaceMode,
      puntos: [...this.puntos],
      solidMesh: this.mallaSolidMesh,
      gridMesh: this.mallaGridMesh,
      edgeMesh: this.mallaEdgeMesh
    });

    // Limpiar referencias del trazo actual sin remover de la escena
    this.mallaSolidMesh = null;
    this.mallaGridMesh = null;
    this.mallaEdgeMesh = null;
    this.puntos = [];
    this.medidas = [];
  }

  calcularAreaSuperficie(pts: any[], mode: SurfaceMode): number {
    if (pts.length < 3) return 0;

    const normal = new THREE.Vector3();
    if (mode === 'floor') {
      normal.set(0, 1, 0);
    } else {
      for (let i = 0; i < pts.length; i++) {
        const pCurrent = pts[i];
        const pNext = pts[(i + 1) % pts.length];
        normal.x += (pCurrent.y - pNext.y) * (pCurrent.z + pNext.z);
        normal.y += (pCurrent.z - pNext.z) * (pCurrent.x + pNext.x);
        normal.z += (pCurrent.x - pNext.x) * (pCurrent.y + pNext.y);
      }
      normal.normalize();
    }

    const origin = pts[0];
    const xAxis = new THREE.Vector3().subVectors(pts[1], origin).normalize();
    if (xAxis.lengthSq() < 0.0001) xAxis.set(1, 0, 0);
    const yAxis = new THREE.Vector3().crossVectors(normal, xAxis).normalize();
    xAxis.crossVectors(yAxis, normal).normalize();

    // Proyectar puntos a 2D
    const pts2D = pts.map(p => {
      const v = new THREE.Vector3().subVectors(p, origin);
      return { x: v.dot(xAxis), y: v.dot(yAxis) };
    });

    // Fórmula de Gauss (Shoelace)
    let area = 0;
    const n = pts2D.length;
    for (let i = 0; i < n; i++) {
      const pCurrent = pts2D[i];
      const pNext = pts2D[(i + 1) % n];
      area += (pCurrent.x * pNext.y) - (pNext.x * pCurrent.y);
    }
    return Math.abs(area) / 2;
  }

  generatePlan() {
    // Cerrar el trazo activo si tiene puntos
    if (this.puntos.length >= 3) {
      this.cerrarSuperficieActual();
    }

    if (this.surfaces.length === 0) {
      alert('Necesitas al menos una superficie cerrada.');
      return;
    }

    // Calcular métricas totales de todas las superficies
    let totalArea = 0;
    let totalPerimetro = 0;

    this.surfaces.forEach(surf => {
      const pts = surf.puntos;
      totalArea += this.calcularAreaSuperficie(pts, surf.mode);

      // Perímetro
      for (let i = 0; i < pts.length; i++) {
        totalPerimetro += pts[i].distanceTo(pts[(i + 1) % pts.length]);
      }
    });

    this.arSurface = totalArea;
    this.arPerimeter = totalPerimetro;
    this.arVolume = totalArea * 0.2;
    this.showResults = true;
  }

  getDynamicFloorplanSvgPoints(mode: 'ar' | 'photo'): string {
    let pts: { x: number, y: number }[] = [];

    if (mode === 'ar') {
      if (this.surfaces.length > 0) {
        pts = this.surfaces[0].puntos.map(p => ({ x: p.x, y: p.z }));
      } else if (this.puntos.length > 0) {
        pts = this.puntos.map(p => ({ x: p.x, y: p.z }));
      }
    } else {
      pts = this.photoPoints;
    }

    if (pts.length === 0) return '';

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    pts.forEach(p => {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    });

    const w = maxX - minX;
    const h = maxY - minY;
    const maxDim = Math.max(w, h, 0.0001);

    const targetSize = 80;
    const scale = targetSize / maxDim;

    const offsetX = 10 + (targetSize - w * scale) / 2;
    const offsetY = 10 + (targetSize - h * scale) / 2;

    const normPts = pts.map(p => {
      const nx = offsetX + (p.x - minX) * scale;
      const ny = offsetY + (p.y - minY) * scale;
      return `${nx.toFixed(1)},${ny.toFixed(1)}`;
    });

    return normPts.join(' ');
  }

  cerrar() {
    this.router.navigate(['/tabs/tab2']);
  }
}
