import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-tab3',
  templateUrl: 'tab3.page.html',
  styleUrls: ['tab3.page.scss']
})
export class Tab3Page {
  user: any = {
    nombre: 'Camila Flores',
    usuario: 'camilaaaflores209@gmail.com'
  };
  expandedSection: string | null = null;

  constructor(private router: Router) {}

  toggleSection(section: string) {
    if (this.expandedSection === section) {
      this.expandedSection = null;
    } else {
      this.expandedSection = section;
    }
  }

  ionViewWillEnter() {
    const savedUser = localStorage.getItem('9amm_user');
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        if (parsed && parsed.nombre) {
          this.user = parsed;
          if (!this.user.usuario || !this.user.usuario.includes('@')) {
            // Just a fallback to make it look like an email if it's not
            this.user.usuario = this.user.usuario + '@gmail.com'; 
          }
        }
      } catch (e) {
        console.error('Error parsing user data', e);
      }
    }
  }

  logout() {
    localStorage.removeItem('9amm_user');
    // We intentionally don't clear apiIp to preserve the user's server setting
    this.router.navigateByUrl('/login', { replaceUrl: true });
  }
}
