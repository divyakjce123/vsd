import { Component, HostListener } from '@angular/core';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  title = '3D Warehouse Visualizer';

  @HostListener('window:resize', ['$event'])
  onResize(event: Event) {
    // This will trigger resize handling in child components
  }
}