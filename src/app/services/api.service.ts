import { Injectable } from '@angular/core';
import axios from 'axios';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private readonly apiIpStorageKey = '9amm_api_ip';
  private readonly userStorageKey = '9amm_user';

  constructor() { }

  private getBaseUrl(): string {
    const apiIp = localStorage.getItem(this.apiIpStorageKey) || '192.168.4.13';
    let trimmedValue = apiIp.trim().replace(/\/+$/, '');
    
    if (trimmedValue === 'localhost') {
      trimmedValue = '192.168.4.13';
    }

    if (!trimmedValue) {
      return '';
    }

    const valueWithProtocol = /^https?:\/\//i.test(trimmedValue)
      ? trimmedValue
      : `http://${trimmedValue}`;

    try {
      const url = new URL(valueWithProtocol);
      if (!url.pathname || url.pathname === '/') {
        url.pathname = '/my-app/apis';
      }
      return url.toString().replace(/\/+$/, '');
    } catch (error) {
      return '';
    }
  }

  public getCurrentUserId(): number {
    try {
      const savedUser = localStorage.getItem(this.userStorageKey);
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        return parsed.id || 0;
      }
    } catch (e) {
      console.error('Error parsing user data', e);
    }
    return 0;
  }

  public async getProjects() {
    const userId = this.getCurrentUserId();
    if (userId === 0) throw new Error('User not logged in');
    const baseUrl = this.getBaseUrl();
    if (!baseUrl) throw new Error('Invalid server IP');

    const response = await axios.get(`${baseUrl}/get_projects.php`, {
      params: { user_id: userId },
      timeout: 10000
    });
    return response.data;
  }

  public async getHistory(page: number = 1) {
    const userId = this.getCurrentUserId();
    if (userId === 0) throw new Error('User not logged in');
    const baseUrl = this.getBaseUrl();
    if (!baseUrl) throw new Error('Invalid server IP');

    const response = await axios.get(`${baseUrl}/get_history.php`, {
      params: { user_id: userId, page },
      timeout: 10000
    });
    return response.data;
  }

  public async getUser() {
    const userId = this.getCurrentUserId();
    if (userId === 0) throw new Error('User not logged in');
    const baseUrl = this.getBaseUrl();
    if (!baseUrl) throw new Error('Invalid server IP');

    const response = await axios.get(`${baseUrl}/get_user.php`, {
      params: { user_id: userId },
      timeout: 10000
    });
    return response.data;
  }

  public async createProject(data: any) {
    const userId = this.getCurrentUserId();
    if (userId === 0) throw new Error('User not logged in');
    const baseUrl = this.getBaseUrl();
    if (!baseUrl) throw new Error('Invalid server IP');

    const payload = {
      user_id: userId,
      ...data
    };

    const response = await axios.post(`${baseUrl}/create_project.php`, payload, {
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    return response.data;
  }

  public async getProjectDetails(projectId: number) {
    const baseUrl = this.getBaseUrl();
    if (!baseUrl) throw new Error('Invalid server IP');

    const response = await axios.get(`${baseUrl}/get_project_details.php`, {
      params: { project_id: projectId },
      timeout: 10000
    });
    return response.data;
  }
}
