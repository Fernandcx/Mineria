import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { ArService } from '../services/ar.service';
import { Router } from '@angular/router';
import { Camera } from '@capacitor/camera';

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

  constructor(public arService: ArService, private router: Router) {}

  ngOnInit() {}

  ionViewDidEnter() {
    this.startAR();
  }

  async startAR() {
    if (this.isSessionActive) return;
    try {
      await Camera.requestPermissions();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      this.cameraVideo.nativeElement.srcObject = stream;

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

  onRenderFrame() {
    if (!this.isSessionActive || !this.reticle) return;

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
      // Actualizar el plano de pared basado en la dirección de la cámara
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
        // Rotar el reticle para que sea vertical (perpendicular a la pared)
        this.reticle.rotation.set(0, Math.atan2(camDir.x, camDir.z), 0);
        this.reticle.visible = true;
      } else {
        this.reticle.visible = false;
      }
    }
  }

  setSurfaceMode(mode: SurfaceMode) {
    this.surfaceMode = mode;
  }

  arVolume: number = 0;
  arSurface: number = 0;
  arPerimeter: number = 0;
  showResults: boolean = false;

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
  buildSurfaceMeshes(puntos: any[], mode: SurfaceMode) {
    const p0 = puntos[0];

    // ── Solid (fondo blanco muy translúcido) ──────────────────────────────
    const vertices: number[] = [];
    for (let i = 1; i < puntos.length - 1; i++) {
      vertices.push(p0.x, p0.y, p0.z);
      vertices.push(puntos[i].x, puntos[i].y, puntos[i].z);
      vertices.push(puntos[i + 1].x, puntos[i + 1].y, puntos[i + 1].z);
    }
    const solidGeo = new THREE.BufferGeometry();
    solidGeo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    solidGeo.computeVertexNormals();
    this.mallaSolidMesh = new THREE.Mesh(solidGeo, new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0.08, side: THREE.DoubleSide
    }));
    this.arService.scene.add(this.mallaSolidMesh);

    // ── Ejes locales para cuadrícula ──────────────────────────────────────
    const XAxis = new THREE.Vector3().subVectors(puntos[1], p0).normalize();
    const tempVec = new THREE.Vector3().subVectors(puntos[2], p0);
    const ZAxis = new THREE.Vector3().crossVectors(XAxis, tempVec).normalize();
    // YAxis perpendicular al plano local
    const YAxis = new THREE.Vector3().crossVectors(ZAxis, XAxis).normalize();

    let minX = 0, maxX = 0, minY = 0, maxY = 0;
    puntos.forEach(p => {
      const v = new THREE.Vector3().subVectors(p, p0);
      const x = v.dot(XAxis);
      const y = v.dot(YAxis);
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    });

    const gridSize = 0.2; // 20 cm
    const gridVerts3D: number[] = [];

    for (let x = minX; x <= maxX + 0.001; x += gridSize) {
      const v1 = p0.clone().add(XAxis.clone().multiplyScalar(x)).add(YAxis.clone().multiplyScalar(minY));
      const v2 = p0.clone().add(XAxis.clone().multiplyScalar(x)).add(YAxis.clone().multiplyScalar(maxY));
      gridVerts3D.push(v1.x, v1.y, v1.z, v2.x, v2.y, v2.z);
    }
    for (let y = minY; y <= maxY + 0.001; y += gridSize) {
      const v1 = p0.clone().add(XAxis.clone().multiplyScalar(minX)).add(YAxis.clone().multiplyScalar(y));
      const v2 = p0.clone().add(XAxis.clone().multiplyScalar(maxX)).add(YAxis.clone().multiplyScalar(y));
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

      // Área (triangle fan)
      let area = 0;
      for (let i = 0; i < pts.length - 2; i++) {
        const v1 = new THREE.Vector3().subVectors(pts[i + 1], pts[0]);
        const v2 = new THREE.Vector3().subVectors(pts[i + 2], pts[0]);
        area += new THREE.Vector3().crossVectors(v1, v2).length() / 2;
      }
      totalArea += area;

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

  cerrar() {
    this.router.navigate(['/tabs/tab2']);
  }
}
