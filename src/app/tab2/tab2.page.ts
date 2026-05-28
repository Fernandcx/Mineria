import { Component } from '@angular/core';

@Component({
  selector: 'app-tab2',
  templateUrl: 'tab2.page.html',
  styleUrls: ['tab2.page.scss']
})
export class Tab2Page {
  inputType: string = 'camera';
  isModalOpen: boolean = false;
  selectedModalType: string = '';

  constructor() {}

  openModal(type: string) {
    this.selectedModalType = type;
    this.isModalOpen = true;
  }

  closeModal() {
    this.isModalOpen = false;
  }

  confirmSelection() {
    this.inputType = this.selectedModalType;
    this.closeModal();
  }

  getModalTitle() {
    switch(this.selectedModalType) {
      case 'camera': return 'Escanear en Vivo';
      case 'images': return 'Subir Imágenes';
      case 'plans': return 'Importar Planos';
      default: return 'Opciones';
    }
  }
}
