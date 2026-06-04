import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { ArService } from '../services/ar.service';
import { Router } from '@angular/router';
import { Camera } from '@capacitor/camera';

declare const THREE: any;

@Component({
  selector: 'app-scan-room',
  templateUrl: './scan-room.page.html',
  styleUrls: ['./scan-room.page.scss'],
})
export class ScanRoomPage implements OnInit {
  @ViewChild('arContainer', { static: true }) arContainer!: ElementRef;
  @ViewChild('cameraVideo', { static: true }) cameraVideo!: ElementRef;

  puntos: any[] = [];
  medidas: { id: number; distancia: string }[] = [];
  
  isSupported = true; // HTML5 Video es universal
  isSessionActive = false;
  raycaster = new THREE.Raycaster();
  
  reticle: any;
  floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); // Suelo virtual en Y=0

  constructor(public arService: ArService, private router: Router) {}

  ngOnInit() {
  }

  ionViewDidEnter() {
    this.startAR(); // Iniciar automáticamente al entrar a la página
  }

  async startAR() {
    if (this.isSessionActive) return;
    try {
      // 1. Iniciar Cámara de Celular HTML5 (restaurado)
      await Camera.requestPermissions();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      this.cameraVideo.nativeElement.srcObject = stream;

      // 2. Iniciar Three.js Canvas
      this.arService.init(this.arContainer.nativeElement);

      // Crear retículo para plane-detection simulado matemáticamente
      const reticleGeo = new THREE.RingGeometry(0.15, 0.2, 32).rotateX(-Math.PI / 2);
      const reticleMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      this.reticle = new THREE.Mesh(reticleGeo, reticleMat);
      this.reticle.visible = false;
      this.arService.scene.add(this.reticle);

      // Iniciar el ciclo de renderizado continuo
      this.arService.setupRenderLoop(this.onRenderFrame.bind(this));
      this.isSessionActive = true;
      
    } catch (error) {
      alert("No se pudo acceder a la cámara: " + error);
    }
  }

  onRenderFrame() {
    if (!this.isSessionActive || !this.reticle) return;

    // Trazar un rayo desde el centro exacto de la cámara
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.arService.camera);
    
    const target = new THREE.Vector3();
    const intersect = this.raycaster.ray.intersectPlane(this.floorPlane, target);
    
    if (intersect) {
      // Si el rayo choca con el suelo (mirando hacia abajo/frente)
      this.reticle.position.copy(target);
      this.reticle.visible = true;
    } else {
      // Si mira al cielo, ocultarlo
      this.reticle.visible = false;
    }
  }

  arVolume: number = 0;
  arSurface: number = 0;
  arPerimeter: number = 0;
  showResults: boolean = false;

  agregarPunto() {
    if (!this.isSessionActive || !this.reticle || !this.reticle.visible) {
      alert("Apunta hacia el suelo (círculo blanco en pantalla)");
      return;
    }

    // Tomar la posición del retículo sobre el suelo virtual matemático
    const posicion = new THREE.Vector3().copy(this.reticle.position);

    this.puntos.push(posicion);

    // Esfera blanca impecable (Nodo)
    const sphereGeom = new THREE.SphereGeometry(0.04, 32, 32);
    const sphereMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const sphere = new THREE.Mesh(sphereGeom, sphereMat);
    sphere.position.copy(posicion);
    this.arService.scene.add(sphere);

    if (this.puntos.length > 1) {
      const p1 = this.puntos[this.puntos.length - 2];
      const p2 = this.puntos[this.puntos.length - 1];

      // Tubo perimetral conectando los nodos
      const path = new THREE.LineCurve3(p1, p2);
      const tubeGeom = new THREE.TubeGeometry(path, 20, 0.015, 8, false);
      const tubeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const tube = new THREE.Mesh(tubeGeom, tubeMat);
      this.arService.scene.add(tube);
      
      const distancia = p1.distanceTo(p2);
      this.medidas.push({
        id: this.medidas.length,
        distancia: distancia.toFixed(2) + ' m'
      });

      // Etiqueta
      const div = document.createElement('div');
      div.className = 'label-3d';
      div.style.background = 'rgba(0,0,0,0.6)';
      div.style.color = '#fff';
      div.style.padding = '4px 10px';
      div.style.borderRadius = '8px';
      div.style.fontWeight = 'bold';
      div.style.fontSize = '14px';
      div.textContent = distancia.toFixed(2) + ' m';
      
      const midPoint = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
      const label = new THREE.CSS2DObject(div);
      label.position.copy(midPoint);
      this.arService.scene.add(label);
    }

    // A partir de 3 puntos, rellenar el área con Malla
    this.dibujarMallaLibre();
  }

  mallaSolidMesh: any = null;
  mallaGridMesh: any = null;

  dibujarMallaLibre() {
    if (this.puntos.length < 3) return;

    if (this.mallaSolidMesh) this.arService.scene.remove(this.mallaSolidMesh);
    if (this.mallaGridMesh) this.arService.scene.remove(this.mallaGridMesh);

    // Triangle Fan para el fondo sólido translúcido
    const vertices = [];
    const p0 = this.puntos[0];
    for (let i = 1; i < this.puntos.length - 1; i++) {
      const p1 = this.puntos[i];
      const p2 = this.puntos[i + 1];
      vertices.push(p0.x, p0.y, p0.z);
      vertices.push(p1.x, p1.y, p1.z);
      vertices.push(p2.x, p2.y, p2.z);
    }

    const solidGeo = new THREE.BufferGeometry();
    solidGeo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    
    // Calcular normales automáticamente para que se vea bien de ambos lados
    solidGeo.computeVertexNormals();

    const solidMat = new THREE.MeshBasicMaterial({ 
      color: 0x000000, 
      transparent: true, 
      opacity: 0.6,
      side: THREE.DoubleSide
    });
    this.mallaSolidMesh = new THREE.Mesh(solidGeo, solidMat);
    this.arService.scene.add(this.mallaSolidMesh);

    // Sistema de Ejes Locales para dibujar la cuadrícula interna perfectamente alineada
    const XAxis = new THREE.Vector3().subVectors(this.puntos[1], p0).normalize();
    const tempVec = new THREE.Vector3().subVectors(this.puntos[2], p0);
    const ZAxis = new THREE.Vector3().crossVectors(XAxis, tempVec).normalize();
    const YAxis = new THREE.Vector3().crossVectors(ZAxis, XAxis).normalize();

    // Proyectar todos los puntos a 2D para encontrar el bounding box local
    let minX = 0, maxX = 0, minY = 0, maxY = 0;
    const pts2D = this.puntos.map((p) => {
      const vec = new THREE.Vector3().subVectors(p, p0);
      const x = vec.dot(XAxis);
      const y = vec.dot(YAxis);
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      return { x, y };
    });

    // Crear la cuadrícula 2D (cada 20cm = 0.2m)
    const gridSize = 0.2;
    const gridVerts = [];
    
    for (let x = minX; x <= maxX; x += gridSize) {
      gridVerts.push(x, minY, x, maxY);
    }
    for (let y = minY; y <= maxY; y += gridSize) {
      gridVerts.push(minX, y, maxX, y);
    }

    // Convertir de nuevo a 3D
    const gridVerts3D = [];
    for (let i = 0; i < gridVerts.length; i += 4) {
      const x1 = gridVerts[i], y1 = gridVerts[i+1];
      const x2 = gridVerts[i+2], y2 = gridVerts[i+3];
      
      const v1 = new THREE.Vector3().copy(p0)
        .add(XAxis.clone().multiplyScalar(x1))
        .add(YAxis.clone().multiplyScalar(y1));
      const v2 = new THREE.Vector3().copy(p0)
        .add(XAxis.clone().multiplyScalar(x2))
        .add(YAxis.clone().multiplyScalar(y2));
        
      gridVerts3D.push(v1.x, v1.y, v1.z);
      gridVerts3D.push(v2.x, v2.y, v2.z);
    }

    const gridGeo = new THREE.BufferGeometry();
    gridGeo.setAttribute('position', new THREE.Float32BufferAttribute(gridVerts3D, 3));
    this.mallaGridMesh = new THREE.LineSegments(gridGeo, new THREE.LineBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.8
    }));
    this.arService.scene.add(this.mallaGridMesh);
  }

  generatePlan() {
    if (this.puntos.length > 2) {
      // Auto-cerrar el polígono libre conectando el último con el primero
      const p1 = this.puntos[this.puntos.length - 1];
      const p2 = this.puntos[0]; 
      
      const path = new THREE.LineCurve3(p1, p2);
      const tubeGeom = new THREE.TubeGeometry(path, 20, 0.015, 8, false);
      const tubeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const tube = new THREE.Mesh(tubeGeom, tubeMat);
      this.arService.scene.add(tube);
      
      // Cálculo aproximado de área en 3D (Teorema de Stokes simplificado)
      let area = 0;
      for (let i = 0; i < this.puntos.length - 2; i++) {
        const v1 = new THREE.Vector3().subVectors(this.puntos[i+1], this.puntos[0]);
        const v2 = new THREE.Vector3().subVectors(this.puntos[i+2], this.puntos[0]);
        area += new THREE.Vector3().crossVectors(v1, v2).length() / 2;
      }
      
      let perimetro = 0;
      for (let i = 0; i < this.puntos.length; i++) {
        const next = (i + 1) % this.puntos.length;
        perimetro += this.puntos[i].distanceTo(this.puntos[next]);
      }
      
      this.arSurface = area;
      this.arPerimeter = perimetro;
      this.arVolume = area * 0.2; // Volumen aproximado de una pared de 20cm

      this.showResults = true;
    } else {
      alert("Necesitas al menos 3 puntos para cerrar la malla.");
    }
  }

  cerrar() {
    this.router.navigate(['/tabs/tab2']);
  }
}
