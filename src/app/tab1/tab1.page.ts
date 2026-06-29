import { Component } from '@angular/core';
import { ApiService } from '../services/api.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-tab1',
  templateUrl: 'tab1.page.html',
  styleUrls: ['tab1.page.scss']
})
export class Tab1Page {
  
  projects: any[] = [];
  isLoading = true;
  errorMessage = '';

  // Propiedades para modal de confirmación personalizado
  isDeleteModalOpen = false;
  projectToDeleteId: number | null = null;

  constructor(
    private apiService: ApiService,
    private router: Router
  ) {}

  ionViewWillEnter() {
    this.loadProjects();
  }

  async loadProjects() {
    this.isLoading = true;
    this.errorMessage = '';
    try {
      const data = await this.apiService.getProjects();
      if (data && data.ok) {
        this.projects = data.projects.map((p: any) => ({
          id: p.id,
          title: p.nombre || 'Sin título',
          area: p.area ? `${p.area} m²` : '-- m²',
          dateStr: this.formatDate(p.fecha),
          status: p.estado || 'Pendiente',
          statusClass: this.getStatusClass(p.estado)
        }));
      } else {
        this.errorMessage = data?.message || 'Error al cargar proyectos';
      }
    } catch (e: any) {
      this.errorMessage = 'No se pudo conectar con el servidor.';
      console.error(e);
    } finally {
      this.isLoading = false;
    }
  }

  private formatDate(dateString: string): string {
    if (!dateString) return '--';
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  }

  private getStatusClass(status: string): string {
    const s = (status || '').toLowerCase();
    if (s.includes('completado')) return 'badge-success';
    if (s.includes('proceso')) return 'badge-primary';
    return 'badge-warning'; // Pendiente u otros
  }

  showDeleteConfirm(projectId: number, event: Event) {
    event.stopPropagation();
    this.projectToDeleteId = projectId;
    this.isDeleteModalOpen = true;
  }

  closeDeleteModal() {
    this.isDeleteModalOpen = false;
    this.projectToDeleteId = null;
  }

  async confirmDelete() {
    if (this.projectToDeleteId === null) return;
    
    const idToDelete = this.projectToDeleteId;
    this.closeDeleteModal();
    
    this.isLoading = true;
    try {
      const res = await this.apiService.deleteProject(idToDelete);
      if (res && res.ok) {
        await this.loadProjects();
      } else {
        this.errorMessage = res?.message || 'Error al eliminar el proyecto';
      }
    } catch (e: any) {
      this.errorMessage = 'No se pudo conectar con el servidor para eliminar el proyecto.';
      console.error(e);
    } finally {
      this.isLoading = false;
    }
  }
}
