import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';

import { AppComponent } from './app.component';
import { WarehouseVisualizerComponent } from './components/warehouse/warehouse.component';
import { WorkstationConfigComponent } from './components/workstation-config/workstation-config.component';
import { PalletConfigComponent } from './components/pallet-config/pallet-config.component';
import { VisualizationComponent } from './components/visualization/visualization.component';

@NgModule({
  declarations: [
    AppComponent,
    WarehouseVisualizerComponent,
    WorkstationConfigComponent,
    PalletConfigComponent,
    VisualizationComponent // <-- Make sure this is included
  ],
  imports: [
    BrowserModule,
    FormsModule,
    HttpClientModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }