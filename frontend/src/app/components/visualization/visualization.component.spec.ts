import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VisualizationComponent } from './visualization.component';
import { beforeEach, describe, it } from 'node:test';

describe('VisualizationComponent', () => {
  let component: VisualizationComponent;
  let fixture: ComponentFixture<VisualizationComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VisualizationComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(VisualizationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component);
  });
});


function expect(component: VisualizationComponent) {
  throw new Error('Function not implemented.');
}

