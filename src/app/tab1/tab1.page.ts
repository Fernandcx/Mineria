import { Component } from '@angular/core';

interface Project {
  id: string;
  title: string;
  area: string;
  dateStr: string;
  image: string;
  buttonType: 'light' | 'solid';
}

@Component({
  selector: 'app-tab1',
  templateUrl: 'tab1.page.html',
  styleUrls: ['tab1.page.scss']
})
export class Tab1Page {
  
  projects: Project[] = [
    {
      id: '48291',
      title: 'Apartamento Centro',
      area: '45 m²',
      dateStr: 'Escaneado ayer',
      image: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?q=80&w=600&auto=format&fit=crop',
      buttonType: 'light'
    },
    {
      id: '48305',
      title: 'Habitación Principal',
      area: '18 m²',
      dateStr: 'Hace 3 días',
      image: 'https://images.unsplash.com/photo-1540518614846-7eded433c457?q=80&w=600&auto=format&fit=crop',
      buttonType: 'solid'
    },
    {
      id: '48317',
      title: 'Cocina Remodelada',
      area: '22 m²',
      dateStr: 'Hace 1 semana',
      image: 'https://images.unsplash.com/photo-1556910103-1c02745a872f?q=80&w=600&auto=format&fit=crop',
      buttonType: 'solid'
    }
  ];

  showUploadModal = false;
  showCameraModal = false;

  constructor() {}

}
