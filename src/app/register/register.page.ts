import axios, { AxiosError } from 'axios';
import { Component } from '@angular/core';
import { Router } from '@angular/router';

interface RegisterResponse {
  ok: boolean;
  message: string;
  user?: {
    id: number;
    nombre: string;
    usuario: string;
    rol: string;
  };
}

@Component({
  selector: 'app-register',
  templateUrl: './register.page.html',
  styleUrls: ['./register.page.scss']
})
export class RegisterPage {
  private readonly apiIpStorageKey = '9amm_api_ip';

  apiIp = localStorage.getItem(this.apiIpStorageKey) || '192.168.4.13';
  nombre = '';
  username = '';
  password = '';
  errorMessage = '';
  successMessage = '';
  debugLog: string[] = [];
  isSubmitting = false;

  constructor(private readonly router: Router) {}

  get debugText(): string {
    return this.debugLog.join('\n');
  }

  submitRegister(): void {
    this.errorMessage = '';
    this.successMessage = '';
    this.debugLog = [];

    const registerUrl = this.buildRegisterUrl();

    if (!registerUrl) {
      this.errorMessage = 'Captura una IP valida del servidor.';
      return;
    }

    if (!this.nombre.trim()) {
      this.errorMessage = 'Captura tu nombre completo.';
      return;
    }

    if (!this.username.trim() || !this.password.trim()) {
      this.errorMessage = 'Captura usuario y contrasena.';
      return;
    }

    localStorage.setItem(this.apiIpStorageKey, this.apiIp.trim());
    this.isSubmitting = true;
    this.addLog(`Servidor capturado: ${this.apiIp.trim()}`);
    this.addLog(`Endpoint: ${registerUrl}`);

    this.registerWithAxios(registerUrl, {
      nombre: this.nombre.trim(),
      username: this.username.trim(),
      password: this.password
    });
  }

  private buildRegisterUrl(): string | null {
    const apiBaseUrl = this.normalizeApiBaseUrl(this.apiIp);
    return apiBaseUrl ? `${apiBaseUrl}/register.php` : null;
  }

  private normalizeApiBaseUrl(value: string): string | null {
    let trimmedValue = value.trim().replace(/\/+$/, '');
    
    if (trimmedValue === 'localhost') {
      trimmedValue = '192.168.4.13';
    }

    if (!trimmedValue) {
      return null;
    }

    const valueWithProtocol = /^https?:\/\//i.test(trimmedValue)
      ? trimmedValue
      : `http://${trimmedValue}`;

    try {
      const url = new URL(valueWithProtocol);

      if (!url.hostname) {
        return null;
      }

      if (!url.pathname || url.pathname === '/') {
        url.pathname = '/my-app/apis';
      }

      return url.toString().replace(/\/+$/, '');
    } catch (error) {
      this.addLog(`URL invalida: ${(error as Error).message}`);
      return null;
    }
  }

  private async registerWithAxios(
    registerUrl: string,
    payload: { nombre: string; username: string; password: string }
  ): Promise<void> {
    try {
      this.addLog(`Enviando registro para usuario: ${payload.username}`);

      const response = await axios.post<RegisterResponse>(registerUrl, payload, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 15000,
        validateStatus: () => true
      });

      this.addLog(`HTTP ${response.status} ${response.statusText || ''}`.trim());
      this.addLog(`Respuesta: ${this.stringifyForLog(response.data)}`);

      if (!response.data?.ok) {
        this.errorMessage = response.data?.message || 'No fue posible registrar el usuario.';
        return;
      }

      this.successMessage = response.data.message;
      localStorage.setItem('9amm_user', JSON.stringify(response.data.user || { nombre: this.nombre, usuario: this.username }));
      this.router.navigateByUrl('/tabs', { replaceUrl: true });

    } catch (error) {
      this.logAxiosError(error as AxiosError);
      this.errorMessage = 'No fue posible conectar con el servidor. Revisa IP, red, XAMPP y CORS.';
    } finally {
      this.isSubmitting = false;
    }
  }

  private logAxiosError(error: AxiosError): void {
    this.addLog(`Error axios: ${error.message}`);

    if (error.code) {
      this.addLog(`Codigo: ${error.code}`);
    }

    if (error.response) {
      this.addLog(`HTTP error: ${error.response.status} ${error.response.statusText || ''}`.trim());
      this.addLog(`Body error: ${this.stringifyForLog(error.response.data)}`);
    }

    if (error.request && !error.response) {
      this.addLog('Sin respuesta HTTP del servidor.');
    }
  }

  private addLog(message: string): void {
    const timestamp = new Date().toLocaleTimeString();
    this.debugLog = [...this.debugLog, `[${timestamp}] ${message}`];
  }

  private stringifyForLog(value: unknown): string {
    try {
      return JSON.stringify(value);
    } catch (error) {
      return String(value);
    }
  }
}
