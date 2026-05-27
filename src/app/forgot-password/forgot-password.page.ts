import { Component } from '@angular/core';
import { Router } from '@angular/router';
import axios from 'axios';

@Component({
  selector: 'app-forgot-password',
  templateUrl: './forgot-password.page.html',
  styleUrls: ['./forgot-password.page.scss'],
})
export class ForgotPasswordPage {
  step = 1;
  email = '';
  verificationCode = '';
  newPassword = '';

  isSubmitting = false;
  errorMessage = '';
  successMessage = '';

  private readonly apiIpStorageKey = '9amm_api_ip';

  constructor(private router: Router) {}

  get apiIp(): string {
    return localStorage.getItem(this.apiIpStorageKey) || '';
  }

  private buildApiUrl(endpoint: string): string | null {
    const value = this.apiIp;
    const trimmedValue = value.trim().replace(/\/+$/, '');
    if (!trimmedValue) return null;

    const valueWithProtocol = /^https?:\/\//i.test(trimmedValue)
      ? trimmedValue
      : `http://${trimmedValue}`;

    try {
      const url = new URL(valueWithProtocol);
      if (!url.hostname) return null;
      if (!url.pathname || url.pathname === '/') {
        url.pathname = '/my-app/apis';
      }
      return url.toString().replace(/\/+$/, '') + endpoint;
    } catch {
      return null;
    }
  }

  async sendCode() {
    this.errorMessage = '';
    this.isSubmitting = true;

    // Simulate sending email verification code
    setTimeout(() => {
      this.isSubmitting = false;
      this.step = 2; // Move to step 2
    }, 1200);
  }

  async verifyCode() {
    this.errorMessage = '';
    
    if (this.verificationCode.length !== 6) {
      this.errorMessage = 'El código debe tener 6 caracteres.';
      return;
    }

    this.isSubmitting = true;
    // Simulate verifying code (accept any 6 chars for demo)
    setTimeout(() => {
      this.isSubmitting = false;
      this.step = 3; // Move to step 3
    }, 1000);
  }

  async resetPassword() {
    this.errorMessage = '';
    this.successMessage = '';

    const resetUrl = this.buildApiUrl('/reset_password.php');
    if (!resetUrl) {
      this.errorMessage = 'No hay IP de servidor configurada. Regresa a login e ingresa la IP.';
      return;
    }

    this.isSubmitting = true;

    try {
      const response = await axios.post(resetUrl, {
        username: this.email.trim(),
        newPassword: this.newPassword
      }, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000,
        validateStatus: () => true
      });

      if (!response.data?.ok) {
        this.errorMessage = response.data?.message || 'Error al cambiar contraseña.';
        this.isSubmitting = false;
        return;
      }

      this.successMessage = '¡Contraseña cambiada con éxito!';
      
      setTimeout(() => {
        this.router.navigateByUrl('/login', { replaceUrl: true });
      }, 1500);

    } catch (error) {
      this.errorMessage = 'Error de red al intentar cambiar la contraseña.';
      this.isSubmitting = false;
    }
  }
}
