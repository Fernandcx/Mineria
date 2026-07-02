import { Component, ElementRef, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { ApiService } from '../services/api.service';

@Component({
  selector: 'app-tab2',
  templateUrl: 'tab2.page.html',
  styleUrls: ['tab2.page.scss']
})
export class Tab2Page {
  inputType: string = 'camera';
  isModalOpen: boolean = false;
  selectedModalType: string = '';

  typeDropdownOpen = false;
  materialDropdownOpen = false;
  
  // Form fields
  nombreProyecto: string = '';
  selectedType: string = '';
  selectedMaterial: string = '';
  pisos: number | null = null;
  area: number | null = null;

  // Store the preview image or file
  previewImage: string | null = null;
  selectedFileName: string | null = null;
  
  // Flag to simulate the "Analysis" state with lines
  isAnalyzing: boolean = false;
  isSubmitting: boolean = false;

  // Dynamic calculations for AR UI
  arVolume: number = 0;
  arSurface: number = 0;
  arPerimeter: number = 0;
  arWidth: number = 0;
  arLength: number = 0;
  arHeight: number = 2.8;

  // Dynamic AR Perspective Points
  cornerX: number = 30; // 0-100%
  ceilingY: number = 20; // 0-100%
  floorY: number = 80; // 0-100%
  
  cutout = { x: 55, y: 30, w: 20, h: 40 }; // Door/Window hole

  @ViewChild('fileInput', { static: false }) fileInput!: ElementRef;

  constructor(private apiService: ApiService, private router: Router) {}

  selectType(type: string) {
    this.selectedType = type;
    this.typeDropdownOpen = false;
  }

  selectMaterial(material: string) {
    this.selectedMaterial = material;
    this.materialDropdownOpen = false;
  }

  openModal(type: string) {
    this.selectedModalType = type;
    this.isModalOpen = true;
  }

  closeModal() {
    this.isModalOpen = false;
  }

  async confirmSelection() {
    this.inputType = this.selectedModalType;
    this.closeModal();

    this.previewImage = null;
    this.selectedFileName = null;
    this.isAnalyzing = false;

    try {
      if (this.inputType === 'camera') {
        // Redirigir al nuevo Escáner WebXR
        this.router.navigate(['/scan-room']);
      } else if (this.inputType === 'images') {
        this.router.navigate(['/scan-room'], { queryParams: { mode: 'photo' } });
      } else if (this.inputType === 'plans') {
        if (this.fileInput) {
          this.fileInput.nativeElement.click();
        }
      }
    } catch (error) {
      console.log('Error o cancelación:', error);
    }
  }

  handleFileInput(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.selectedFileName = file.name;
      this.isAnalyzing = false;
    }
  }

  // Superficies detectadas automáticamente
  detectedSurfaces: {
    leftWall: boolean;
    rightWall: boolean;
    floor: boolean;
    ceiling: boolean;
    hasDoorway: boolean;
  } = { leftWall: true, rightWall: true, floor: true, ceiling: false, hasDoorway: false };

  // Confianza de cada superficie (0-1) para ajustar opacidad del grid
  surfaceConfidence = { left: 0.8, right: 0.8, floor: 0.7, ceiling: 0.5 };

  simulateAnalysis() {
    this.isAnalyzing = true;

    if (this.previewImage) {
      this.analyzeImageStructure(this.previewImage);
    }

    const baseArea = this.area && this.area > 0 ? this.area : 35;
    this.arSurface = baseArea;
    this.arVolume = baseArea * this.arHeight;
    this.arPerimeter = Math.sqrt(baseArea) * 4;
    this.arLength = Math.sqrt(baseArea) * 1.2;
    this.arWidth = baseArea / this.arLength;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ALGORITMO DE VISIÓN ARTIFICIAL MEJORADO (Sobel Edge Detection)
  // Detecta automáticamente: esquina de habitación, techo, suelo, paredes
  // ─────────────────────────────────────────────────────────────────────────
  analyzeImageStructure(dataUrl: string) {
    const img = new Image();
    img.onload = () => {
      const W = 120, H = 120;
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = W;
      canvas.height = H;
      ctx.drawImage(img, 0, 0, W, H);
      const imgData = ctx.getImageData(0, 0, W, H);
      const d = imgData.data;

      const gray = (x: number, y: number): number => {
        const xi = Math.max(0, Math.min(W - 1, Math.round(x)));
        const yi = Math.max(0, Math.min(H - 1, Math.round(y)));
        const i = (yi * W + xi) * 4;
        return (d[i] + d[i + 1] + d[i + 2]) / 3;
      };

      // Sobel H: detecta bordes verticales (aristas de paredes)
      const sobelH = (x: number, y: number): number => {
        if (x < 1 || x >= W - 1 || y < 1 || y >= H - 1) return 0;
        return Math.abs(
          -gray(x-1,y-1) - 2*gray(x-1,y) - gray(x-1,y+1)
          +gray(x+1,y-1) + 2*gray(x+1,y) + gray(x+1,y+1)
        );
      };

      // Sobel V: detecta bordes horizontales (suelo/techo)
      const sobelV = (x: number, y: number): number => {
        if (x < 1 || x >= W - 1 || y < 1 || y >= H - 1) return 0;
        return Math.abs(
          -gray(x-1,y-1) - 2*gray(x,y-1) - gray(x+1,y-1)
          +gray(x-1,y+1) + 2*gray(x,y+1) + gray(x+1,y+1)
        );
      };

      // 1. Esquina vertical más fuerte (zona 25%-75% horizontal)
      let bestCornerScore = 0;
      let bestCornerX = W / 2;
      for (let x = Math.floor(W * 0.25); x < Math.floor(W * 0.75); x++) {
        let score = 0;
        for (let y = Math.floor(H * 0.1); y < Math.floor(H * 0.85); y++) {
          score += sobelH(x, y) * (y < H * 0.5 ? 1.5 : 1.0);
        }
        if (score > bestCornerScore) { bestCornerScore = score; bestCornerX = x; }
      }
      this.cornerX = (bestCornerX / W) * 100;

      // 2. Línea de techo (zona 8%-38%)
      let bestCeilingScore = 0;
      let bestCeilingY = H * 0.18;
      for (let y = Math.floor(H * 0.08); y < Math.floor(H * 0.38); y++) {
        let score = 0;
        for (let x = 5; x < W - 5; x++) score += sobelV(x, y);
        if (score > bestCeilingScore) { bestCeilingScore = score; bestCeilingY = y; }
      }
      this.ceilingY = (bestCeilingY / H) * 100;

      // 3. Línea de suelo (zona 55%-92%)
      let bestFloorScore = 0;
      let bestFloorY = H * 0.75;
      for (let y = Math.floor(H * 0.55); y < Math.floor(H * 0.92); y++) {
        let score = 0;
        for (let x = 5; x < W - 5; x++) score += sobelV(x, y);
        if (score > bestFloorScore) { bestFloorScore = score; bestFloorY = y; }
      }
      this.floorY = (bestFloorY / H) * 100;

      // 4. Confianza de superficies normalizada
      const maxScore = Math.max(bestCornerScore, bestCeilingScore, bestFloorScore, 1);
      this.surfaceConfidence = {
        left:    Math.min(1, bestCornerScore / maxScore * 1.1),
        right:   Math.min(1, bestCornerScore / maxScore * 1.0),
        floor:   Math.min(1, bestFloorScore  / maxScore * 1.2),
        ceiling: Math.min(1, bestCeilingScore / maxScore * 0.9)
      };

      // 5. Detectar techo visible
      this.detectedSurfaces.ceiling = bestCeilingScore > maxScore * 0.25;

      // 6. Detectar puerta/ventana (zona de baja densidad de bordes en pared derecha)
      const rxStart = Math.floor(bestCornerX + (W - bestCornerX) * 0.2);
      const rxEnd   = Math.floor(bestCornerX + (W - bestCornerX) * 0.8);
      let doorScore = 0;
      for (let x = rxStart; x < rxEnd; x++) {
        for (let y = Math.floor(bestCeilingY + (bestFloorY - bestCeilingY) * 0.15); y < Math.floor(bestFloorY); y++) {
          doorScore += sobelH(x, y) + sobelV(x, y);
        }
      }
      const doorDensity = doorScore / ((rxEnd - rxStart) * (bestFloorY - bestCeilingY) * 0.85 + 1);
      this.detectedSurfaces.hasDoorway = doorDensity > 3;

      // 7. Cutout (puerta/ventana)
      const roomH = this.floorY - this.ceilingY;
      this.cutout = {
        x: this.cornerX + (100 - this.cornerX) * 0.15,
        y: this.ceilingY + roomH * 0.2,
        w: (100 - this.cornerX) * 0.28,
        h: roomH * 0.55
      };
    };
    img.src = dataUrl;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Genera las líneas SVG con perspectiva correcta (convergen al punto de fuga)
  // Devuelve un array de strings "x1,y1,x2,y2" para usar en el template
  // ─────────────────────────────────────────────────────────────────────────

  // Punto de fuga: la esquina de la habitación
  get vpX(): number { return this.cornerX; }
  get vpY(): number { return this.ceilingY; }

  // Líneas de perspectiva para la PARED IZQUIERDA
  // Van desde el punto de fuga hacia el borde izquierdo, distribuidas verticalmente
  get leftWallLines(): string[] {
    const lines: string[] = [];
    const steps = 10; // cantidad de divisiones
    const topLeft   = { x: 0, y: this.ceilingY - 10 };
    const botLeft   = { x: 0, y: this.floorY + 10 };
    const vpBottom  = { x: this.vpX, y: this.floorY };
    const vpTop     = { x: this.vpX, y: this.ceilingY };

    // Líneas horizontales (van del VP hacia el borde izq, interpolando vertical)
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const y1 = this.vpY + (vpBottom.y - this.vpY) * t;
      const y2 = topLeft.y + (botLeft.y - topLeft.y) * t;
      lines.push(`${this.vpX},${y1} 0,${y2}`);
    }
    return lines;
  }

  // Líneas de perspectiva para la PARED DERECHA
  get rightWallLines(): string[] {
    const lines: string[] = [];
    const steps = 10;
    const topRight = { x: 100, y: this.ceilingY - 5 };
    const botRight = { x: 100, y: this.floorY + 5 };
    const vpBottom = { x: this.vpX, y: this.floorY };

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const y1 = this.vpY + (vpBottom.y - this.vpY) * t;
      const y2 = topRight.y + (botRight.y - topRight.y) * t;
      lines.push(`${this.vpX},${y1} 100,${y2}`);
    }
    return lines;
  }

  // Líneas verticales pared izquierda (paralelas entre VP y borde, dividiendo ancho)
  get leftWallVerticals(): string[] {
    const lines: string[] = [];
    const steps = 8;
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      // Interpolación entre VP y el borde izquierdo
      const x = this.vpX * (1 - t); // se acerca a 0
      const topY = this.vpY + (this.ceilingY - 10 - this.vpY) * t;
      const botY = this.floorY + (this.floorY + 10 - this.floorY) * t;
      lines.push(`${x},${topY} ${x},${botY}`);
    }
    return lines;
  }

  // Líneas verticales pared derecha
  get rightWallVerticals(): string[] {
    const lines: string[] = [];
    const steps = 8;
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const x = this.vpX + (100 - this.vpX) * t;
      const topY = this.vpY + (this.ceilingY - 5 - this.vpY) * t;
      const botY = this.floorY + (this.floorY + 5 - this.floorY) * t;
      lines.push(`${x},${topY} ${x},${botY}`);
    }
    return lines;
  }

  // Líneas del SUELO — radiales desde el VP hacia el fondo
  get floorLines(): string[] {
    const lines: string[] = [];
    const steps = 10;
    // Horizontales del suelo (van del VP al fondo)
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const yFloor = this.floorY + (100 - this.floorY) * t;
      // interpolar x entre el punto de fuga y los bordes
      const xLeft  = this.vpX * (1 - t);
      const xRight = this.vpX + (100 - this.vpX) * t;
      // línea horizontal a esa profundidad
      lines.push(`${xLeft},${yFloor} ${xRight},${yFloor}`);
    }
    // Radiales laterales del suelo
    const numRadials = 8;
    for (let i = 0; i <= numRadials; i++) {
      const t = i / numRadials;
      const endX = 100 * t;
      const endY = 100;
      lines.push(`${this.vpX},${this.floorY} ${endX},${endY}`);
    }
    return lines;
  }

  // Líneas del TECHO
  get ceilingLines(): string[] {
    const lines: string[] = [];
    const steps = 8;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const yCeil = this.vpY * (1 - t); // hacia arriba desde VP
      const xLeft  = this.vpX * (1 - t);
      const xRight = this.vpX + (100 - this.vpX) * t;
      lines.push(`${xLeft},${yCeil} ${xRight},${yCeil}`);
    }
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const endX = 100 * t;
      lines.push(`${this.vpX},${this.vpY} ${endX},0`);
    }
    return lines;
  }

  getModalTitle() {
    switch(this.selectedModalType) {
      case 'camera': return 'Escanear en Vivo';
      case 'images': return 'Subir Imágenes';
      case 'plans': return 'Importar Planos';
      default: return 'Opciones';
    }
  }

  async submitProject() {
    if (!this.nombreProyecto || !this.selectedType || !this.selectedMaterial || !this.pisos || !this.area) {
      alert('Por favor completa todos los campos del formulario antes de iniciar el análisis.');
      return;
    }

    if (this.inputType !== 'plans' && !this.previewImage) {
      alert('Por favor selecciona una imagen o toma una foto.');
      return;
    }

    this.isSubmitting = true;

    try {
      const data = {
        nombre: this.nombreProyecto,
        tipo: this.selectedType,
        pisos: this.pisos,
        material: this.selectedMaterial,
        area: this.area
      };

      const result = await this.apiService.createProject(data);
      
      if (result.ok) {
        // Guardar la imagen y los puntos AR en localStorage
        if (this.previewImage) {
          try {
            localStorage.setItem('temp_project_image', this.previewImage);
            localStorage.setItem('temp_ar_points', JSON.stringify({
              cornerX: this.cornerX, ceilingY: this.ceilingY, floorY: this.floorY, cutout: this.cutout
            }));
          } catch(e) {
             console.warn('Storage quota exceeded, image/points not passed to editor');
          }
        } else {
          localStorage.removeItem('temp_project_image');
          localStorage.removeItem('temp_ar_points');
        }

        // Redirigir al editor con el ID del proyecto recién creado
        this.router.navigate(['/editor'], { queryParams: { projectId: result.project_id } });
        
        // Reset form
        this.nombreProyecto = '';
        this.selectedType = '';
        this.selectedMaterial = '';
        this.pisos = null;
        this.area = null;
        this.previewImage = null;
        this.selectedFileName = null;
        this.isAnalyzing = false;
      } else {
        alert('Error: ' + result.message);
      }
    } catch (error) {
      console.error(error);
      alert('Hubo un error de conexión con el servidor al crear el proyecto.');
    } finally {
      this.isSubmitting = false;
    }
  }

  // Update AR metrics if area changes while analyzing
  updateDynamicArea() {
    if (this.isAnalyzing) {
      this.simulateAnalysis();
    }
  }
}