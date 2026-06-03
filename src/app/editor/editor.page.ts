import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ApiService } from '../services/api.service';

@Component({
  selector: 'app-editor',
  templateUrl: './editor.page.html',
  styleUrls: ['./editor.page.scss'],
})
export class EditorPage implements OnInit {
  currentView: 'results' | '3D' = 'results';
  projectId: number = 0;
  project: any = null;
  isLoading: boolean = true;
  error: string | null = null;
  
  previewImage: string | null = null;

  // AR Overlay dynamic variables
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
  cutout = { x: 55, y: 30, w: 20, h: 40 };

  constructor(private route: ActivatedRoute, private apiService: ApiService) {}

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      if (params['view'] === '3D') {
        this.currentView = '3D';
      } else {
        this.currentView = 'results';
      }
      
      if (params['projectId']) {
        this.projectId = parseInt(params['projectId'], 10);
        this.loadProject();
      } else {
        this.isLoading = false;
        this.error = 'No se especificó un ID de proyecto';
      }
    });

    // Cargar imagen temporal y puntos AR si existen
    this.previewImage = localStorage.getItem('temp_project_image');
    const tempPoints = localStorage.getItem('temp_ar_points');
    if (tempPoints) {
      try {
        const points = JSON.parse(tempPoints);
        if (points.cornerX) this.cornerX = points.cornerX;
        if (points.ceilingY) this.ceilingY = points.ceilingY;
        if (points.floorY) this.floorY = points.floorY;
        if (points.cutout) this.cutout = points.cutout;
      } catch(e) {
        console.error("Error parsing AR points", e);
      }
    }
  }

  async loadProject() {
    this.isLoading = true;
    try {
      const response = await this.apiService.getProjectDetails(this.projectId);
      if (response.ok) {
        this.project = response.project;
        this.calculateARVariables();
      } else {
        this.error = response.message;
      }
    } catch (e) {
      this.error = 'Error al cargar los datos del proyecto';
      console.error(e);
    } finally {
      this.isLoading = false;
    }
  }

  calculateARVariables() {
    if (!this.project) return;
    const baseArea = this.project.area || 35;
    
    this.arSurface = baseArea;
    this.arVolume = baseArea * this.arHeight;
    this.arPerimeter = Math.sqrt(baseArea) * 4;
    
    // Simulate room dimensions
    this.arLength = Math.sqrt(baseArea) * 1.2;
    this.arWidth = baseArea / this.arLength;
  }

  setView(view: 'results' | '3D') {
    this.currentView = view;
  }
}


