import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from '../services/api.service';

@Component({
  selector: 'app-tab3',
  templateUrl: 'tab3.page.html',
  styleUrls: ['tab3.page.scss']
})
export class Tab3Page {
  user: any = {
    nombre: 'Usuario',
    usuario: 'correo@ejemplo.com',
    rol: 'usuario'
  };
  history: any[] = [];
  expandedSection: string | null = null;
  isLoadingHistory = false;
  historyError = '';

  constructor(
    private router: Router,
    private apiService: ApiService
  ) {}

  toggleSection(section: string) {
    if (this.expandedSection === section) {
      this.expandedSection = null;
    } else {
      this.expandedSection = section;
      if (section === 'history' && this.history.length === 0) {
        this.loadHistory();
      }
    }
  }

  ionViewWillEnter() {
    this.loadUserProfile();
  }

  async loadUserProfile() {
    try {
      const savedUser = localStorage.getItem('9amm_user');
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        if (parsed && parsed.nombre) {
          this.user = parsed;
        }
      }

      const data = await this.apiService.getUser();
      if (data && data.ok) {
        this.user = data.user;
        localStorage.setItem('9amm_user', JSON.stringify(this.user));
      }
      
      if (!this.user.usuario || !this.user.usuario.includes('@')) {
        this.user.usuario = this.user.usuario + '@gmail.com'; 
      }
    } catch (e) {
      console.error('Error fetching user profile', e);
    }
  }

  async loadHistory() {
    this.isLoadingHistory = true;
    this.historyError = '';
    try {
      const data = await this.apiService.getHistory(1);
      if (data && data.ok) {
        this.history = data.history.map((h: any) => ({
          ...h,
          fechaFormateada: this.formatDate(h.fecha_escaneo)
        }));
      } else {
        this.historyError = data?.message || 'Error al cargar el historial';
      }
    } catch (e) {
      this.historyError = 'Error de conexión';
      console.error(e);
    } finally {
      this.isLoadingHistory = false;
    }
  }

  private formatDate(dateString: string): string {
    if (!dateString) return '--';
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  }

  logout() {
    localStorage.removeItem('9amm_user');
    this.router.navigateByUrl('/login', { replaceUrl: true });
  }
}
