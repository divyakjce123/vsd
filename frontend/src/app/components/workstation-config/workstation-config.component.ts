import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { PalletConfig, SideAisleConfig } from 'src/app/models/warehouse.models';

@Component({
  selector: 'app-workstation-config',
  templateUrl: './workstation-config.component.html',
  styleUrls: ['./workstation-config.component.css']
})
export class WorkstationConfigComponent implements OnInit, OnChanges {
  @Input() workstationIndex: number = 0;
  @Input() aisleConfig!: SideAisleConfig;
  @Input() pallets: PalletConfig[] = [];
  @Input() workstationGapUnit: string = 'cm';
  
  @Output() aisleConfigChange = new EventEmitter<SideAisleConfig>();
  @Output() palletsChange = new EventEmitter<PalletConfig[]>();
  @Output() addPallet = new EventEmitter<void>();
  @Output() removePallet = new EventEmitter<number>();
  @Output() updateAisleGaps = new EventEmitter<void>();

  // Available units for dropdowns
  units = ['cm', 'm', 'mm', 'ft', 'in'];
  weightUnits = ['kg', 'lbs'];
  
  // Pallet types with colors
  palletTypes = [
    { value: 'wooden', label: 'Wooden', color: '#8B4513' },
    { value: 'plastic', label: 'Plastic', color: '#1E90FF' },
    { value: 'metal', label: 'Metal', color: '#A9A9A9' }
  ];

  // Taisle aisle gaps
  aisleGaps: { value: number, unit: string }[] = [];

  ngOnInit(): void {
    this.initializeAisleGaps();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['aisleConfig'] && changes['aisleConfig'].currentValue) {
      this.initializeAisleGaps();
    }
  }

  initializeAisleGaps(): void {
    const numGaps = this.aisleConfig.num_aisles - 1;
    this.aisleGaps = [];
    
    for (let i = 0; i < numGaps; i++) {
      this.aisleGaps.push({
        value: this.aisleConfig.custom_gaps[i] || 20,
        unit: this.aisleConfig.wall_gap_unit || 'cm'
      });
    }
  }

  onAisleConfigChange(): void {
    // Update custom gaps from aisleGaps array, converting each to cm
    this.aisleConfig.custom_gaps = this.aisleGaps.map(gap =>
      this.convertToCm(gap.value, gap.unit)
    );
    
    // Keep wall_gap_unit ONLY for wall gaps (front/back/left/right),
    // do NOT force all aisle gaps to share the same unit anymore.
    
    this.aisleConfigChange.emit(this.aisleConfig);
    this.updateAisleGaps.emit();
  }

  onPalletsChange(): void {
    this.palletsChange.emit(this.pallets);
  }

  onAddPallet(): void {
    const newPallet: PalletConfig = {
      type: 'wooden',
      weight: 500,
      length_cm: 120,
      width_cm: 80,
      height_cm: 15,
      color: '#8B4513',
      position: {
        floor: 1,
        row: 1,
        col: 1
      }
    };
    
    this.pallets.push(newPallet);
    this.onPalletsChange();
    this.addPallet.emit();
  }

  onRemovePallet(index: number): void {
    this.pallets.splice(index, 1);
    this.onPalletsChange();
    this.removePallet.emit(index);
  }

  onPalletTypeChange(pallet: PalletConfig, type: string): void {
    pallet.type = type;
    const palletType = this.palletTypes.find(pt => pt.value === type);
    pallet.color = palletType?.color || '#8B4513';
    this.onPalletsChange();
  }

  getAisleGapLabel(index: number): string {
    return `Gap between Aisle ${index + 1}-${index + 2}`;
  }

  addAisleGap(): void {
    if (this.aisleConfig.num_aisles > 0) {
      this.aisleConfig.num_aisles++;
      this.initializeAisleGaps();
      this.onAisleConfigChange();
    }
  }

  removeAisleGap(): void {
    if (this.aisleConfig.num_aisles > 1) {
      this.aisleConfig.num_aisles--;
      this.initializeAisleGaps();
      this.onAisleConfigChange();
    }
  }

  updateAisleCount(): void {
    // Update aisle gaps based on new aisle count
    const oldCount = this.aisleGaps.length + 1;
    const newCount = this.aisleConfig.num_aisles;
    
    if (newCount > oldCount) {
      // Add new gaps
      for (let i = oldCount; i < newCount; i++) {
        this.aisleGaps.push({
          value: 20,
          unit: this.aisleConfig.wall_gap_unit || 'cm'
        });
      }
    } else if (newCount < oldCount) {
      // Remove extra gaps
      this.aisleGaps = this.aisleGaps.slice(0, newCount - 1);
    }
    
    // Store gaps in cm for backend
    this.aisleConfig.custom_gaps = this.aisleGaps.map(gap =>
      this.convertToCm(gap.value, gap.unit)
    );
    this.onAisleConfigChange();
  }

  convertToCm(value: number, unit: string): number {
    const conversions: { [key: string]: number } = {
      'cm': 1,
      'm': 100,
      'mm': 0.1,
      'ft': 30.48,
      'in': 2.54
    };
    return value * (conversions[unit] || 1);
  }

  getTotalPalletsWeight(): number {
    return this.pallets.reduce((total, pallet) => total + pallet.weight, 0);
  }

  getWorkstationInfo(): string {
    return `Workstation ${this.workstationIndex + 1}: ${this.aisleConfig.num_floors}F × ${this.aisleConfig.num_rows}R × ${this.aisleConfig.num_aisles}C`;
  }

  // ADD THIS MISSING METHOD
  getTotalGapsWidth(): number {
    if (!this.aisleGaps || this.aisleGaps.length === 0) {
      return 0;
    }
    
    let totalWidthCm = 0;
    for (const gap of this.aisleGaps) {
      totalWidthCm += this.convertToCm(gap.value, gap.unit);
    }
    
    return totalWidthCm;
  }
}