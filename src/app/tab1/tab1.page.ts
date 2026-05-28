import { Component } from '@angular/core';

@Component({
  selector: 'app-tab1',
  templateUrl: 'tab1.page.html',
  styleUrls: ['tab1.page.scss']
})
export class Tab1Page {
  
  projects = [
    {
      id: 1,
      title: 'Edificio Residencial Las Palmas',
      area: '1200 m²',
      dateStr: '27 May 2026',
      status: 'Completado',
      statusClass: 'badge-success'
    },
    {
      id: 2,
      title: 'Centro Comercial Aurora',
      area: '3500 m²',
      dateStr: '27 May 2026',
      status: 'En Proceso',
      statusClass: 'badge-primary'
    },
    {
      id: 3,
      title: 'Casa Habitación Familia Ruiz',
      area: '250 m²',
      dateStr: '25 May 2026',
      status: 'Pendiente',
      statusClass: 'badge-warning'
    }
  ];

  constructor() {}
}
