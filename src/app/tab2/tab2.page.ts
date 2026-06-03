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
        const photo = await Camera.getPhoto({
          resultType: CameraResultType.DataUrl,
          source: CameraSource.Photos,
          quality: 90
        });
        if (photo && photo.dataUrl) {
          this.previewImage = photo.dataUrl;
          this.simulateAnalysis();
        }
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

  simulateAnalysis() {
    this.isAnalyzing = true;
    
    // Analyze the image to find dynamic corners
    if (this.previewImage) {
      this.analyzeImageStructure(this.previewImage);
    }

    // Calculate dynamic values for the AR overlay
    const baseArea = this.area && this.area > 0 ? this.area : 35; 
    
    this.arSurface = baseArea;
    this.arVolume = baseArea * this.arHeight;
    this.arPerimeter = Math.sqrt(baseArea) * 4;
    
    this.arLength = Math.sqrt(baseArea) * 1.2;
    this.arWidth = baseArea / this.arLength;
  }

  // ALGORITMO DE VISIÓN ARTIFICIAL (Edge Detection Perspectiva)
  analyzeImageStructure(dataUrl: string) {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      canvas.width = 100; 
      canvas.height = 100;
      ctx.drawImage(img, 0, 0, 100, 100);
      
      const imgData = ctx.getImageData(0, 0, 100, 100);
      const data = imgData.data;
      
      // Helpers para encontrar bordes verticales/horizontales
      const findStrongestVertical = (startX: number, endX: number) => {
        let maxContrast = 0;
        let bestX = (startX + endX) / 2;
        for (let x = startX; x < endX; x++) {
          let colContrast = 0;
          for (let y = 20; y < 80; y += 2) {
            const idx1 = (y * 100 + x) * 4;
            const idx2 = (y * 100 + (x+1)) * 4;
            const gray1 = (data[idx1] + data[idx1+1] + data[idx1+2]) / 3;
            const gray2 = (data[idx2] + data[idx2+1] + data[idx2+2]) / 3;
            colContrast += Math.abs(gray1 - gray2);
          }
          if (colContrast > maxContrast) {
            maxContrast = colContrast;
            bestX = x;
          }
        }
        return bestX;
      };

      const findStrongestHorizontal = (startY: number, endY: number) => {
        let maxContrast = 0;
        let bestY = (startY + endY) / 2;
        for (let y = startY; y < endY; y++) {
          let rowContrast = 0;
          for (let x = 20; x < 80; x += 2) {
            const idx1 = (y * 100 + x) * 4;
            const idx2 = ((y+1) * 100 + x) * 4;
            const gray1 = (data[idx1] + data[idx1+1] + data[idx1+2]) / 3;
            const gray2 = (data[idx2] + data[idx2+1] + data[idx2+2]) / 3;
            rowContrast += Math.abs(gray1 - gray2);
          }
          if (rowContrast > maxContrast) {
            maxContrast = rowContrast;
            bestY = y;
          }
        }
        return bestY;
      };

      // 1. Encontrar la esquina de la habitación (Línea vertical más fuerte en el centro 30%-70%)
      this.cornerX = findStrongestVertical(30, 70);
      
      // 2. Encontrar la línea del techo (Línea horizontal más fuerte en el top 10%-40%)
      this.ceilingY = findStrongestHorizontal(10, 40);
      
      // 3. Encontrar la línea del suelo (Línea horizontal más fuerte en el bottom 60%-90%)
      this.floorY = findStrongestHorizontal(60, 90);

      // Centrar el cutout
      this.cutout = { 
        x: this.cornerX - 10, 
        y: this.ceilingY + ((this.floorY - this.ceilingY)/3), 
        w: 20, 
        h: ((this.floorY - this.ceilingY)/3)
      };
    };
    img.src = dataUrl;
  }

  // Update AR metrics if area changes while analyzing
  updateDynamicArea() {
    if (this.isAnalyzing) {
      this.simulateAnalysis();
    }
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
}

