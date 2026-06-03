import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { ScanRoomPageRoutingModule } from './scan-room-routing.module';

import { ScanRoomPage } from './scan-room.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    ScanRoomPageRoutingModule
  ],
  declarations: [ScanRoomPage]
})
export class ScanRoomPageModule {}
