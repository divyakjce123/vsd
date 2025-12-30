import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { PalletConfig } from 'src/app/models/warehouse.models';

@Component({
  selector: 'app-pallet-config',
  templateUrl: './pallet-config.component.html',
  styleUrls: ['./pallet-config.component.css']
})
export class PalletConfigComponent implements OnInit {
  @Input() pallet!: PalletConfig;
  @Input() palletIndex: number = 0;
  @Input() workstationIndex: number = 0;
  @Input() maxFloors: number = 3;
  @Input() maxRows: number = 2;
  @Input() maxAisles: number = 4;
  @Input() maxDepth: number = 1;
  
  @Output() palletChange = new EventEmitter<PalletConfig>();
  @Output() removePallet = new EventEmitter<void>();

  // Available units
  lengthUnits = ['cm', 'm', 'mm', 'ft', 'in'];
  weightUnits = ['kg', 'lbs', 'g', 't', 'oz'];
  
  // Pallet types
  palletTypes = [
    { value: 'wooden', label: 'Wooden', color: '#8B4513' },
    { value: 'plastic', label: 'Plastic', color: '#1E90FF' },
    { value: 'metal', label: 'Metal', color: '#A9A9A9' }
  ];

  // Current units
  currentLengthUnit: string = 'cm';
  currentWidthUnit: string = 'cm';
  currentHeightUnit: string = 'cm';
  currentWeightUnit: string = 'kg';

  // Current values in display units
  displayLength: number = 120;
  displayWidth: number = 80;
  displayHeight: number = 15;
  displayWeight: number = 500;

  ngOnInit(): void {
    // Initialize display values from pallet data (assuming pallet stores in cm and kg)
    this.displayLength = this.pallet.length_cm;
    this.displayWidth = this.pallet.width_cm;
    this.displayHeight = this.pallet.height_cm;
    this.displayWeight = this.pallet.weight;
    
    // Set default units
    this.currentLengthUnit = 'cm';
    this.currentWidthUnit = 'cm';
    this.currentHeightUnit = 'cm';
    this.currentWeightUnit = 'kg';
  }

  onPalletChange(): void {
    // Convert display values to cm and kg before emitting
    this.pallet.length_cm = this.convertToCm(this.displayLength, this.currentLengthUnit);
    this.pallet.width_cm = this.convertToCm(this.displayWidth, this.currentWidthUnit);
    this.pallet.height_cm = this.convertToCm(this.displayHeight, this.currentHeightUnit);
    this.pallet.weight = this.convertToKg(this.displayWeight, this.currentWeightUnit);
    
    this.palletChange.emit(this.pallet);
  }

  onTypeChange(type: string): void {
    this.pallet.type = type;
    const palletType = this.palletTypes.find(pt => pt.value === type);
    this.pallet.color = palletType?.color || '#8B4513';
    this.onPalletChange();
  }

  onRemove(): void {
    this.removePallet.emit();
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

  convertToKg(value: number, unit: string): number {
    const conversions: { [key: string]: number } = {
      'kg': 1,
      'lbs': 0.453592
    };
    return value * (conversions[unit] || 1);
  }

  convertFromCm(value: number, unit: string): number {
    const conversions: { [key: string]: number } = {
      'cm': 1,
      'm': 0.01,
      'mm': 10,
      'ft': 0.0328084,
      'in': 0.393701
    };
    return value * (conversions[unit] || 1);
  }

  convertFromKg(value: number, unit: string): number {
    const conversions: { [key: string]: number } = {
      'kg': 1,
      'lbs': 2.20462
    };
    return value * (conversions[unit] || 1);
  }

  getPalletColor(): string {
    return this.pallet.color || '#8B4513';
  }

  getPalletVolume(): number {
    const lengthCm = this.convertToCm(this.displayLength, this.currentLengthUnit);
    const widthCm = this.convertToCm(this.displayWidth, this.currentWidthUnit);
    const heightCm = this.convertToCm(this.displayHeight, this.currentHeightUnit);
    return (lengthCm * widthCm * heightCm) / 1000000; // Convert to cubic meters
  }

  getPalletFootprint(): number {
    const lengthCm = this.convertToCm(this.displayLength, this.currentLengthUnit);
    const widthCm = this.convertToCm(this.displayWidth, this.currentWidthUnit);
    return (lengthCm * widthCm) / 10000; // Convert to square meters
  }

  getPositionLabel(): string {
    return `Side ${this.pallet.position.side}, Floor ${this.pallet.position.floor}, Row ${this.pallet.position.row}, Aisle ${this.pallet.position.col}, Depth ${this.pallet.position.depth }`;
  }

  // Generate floor options based on max floors

  getSideOptions(): string[] {
    return ['left', 'right'];
  }

  getFloorOptions(): number[] {
    return Array.from({ length: this.maxFloors }, (_, i) => i + 1);
  }

  // Generate row options based on max rows
  getRowOptions(): number[] {
    return Array.from({ length: this.maxRows }, (_, i) => i + 1);
  }

  // Generate aisle options based on max aisles
  getAisleOptions(): number[] {
    return Array.from({ length: this.maxAisles }, (_, i) => i + 1);
  }

  getDepthOptions(): number[] {
    return Array.from({ length: this.maxDepth }, (_, i) => i + 1);
  }

  onUnitChange(field: string, unit: string): void {
    // Convert current value to new unit
    let currentValue: number;
    
    switch(field) {
      case 'length':
        currentValue = this.convertFromCm(this.pallet.length_cm, unit);
        this.displayLength = currentValue;
        this.currentLengthUnit = unit;
        break;
      case 'width':
        currentValue = this.convertFromCm(this.pallet.width_cm, unit);
        this.displayWidth = currentValue;
        this.currentWidthUnit = unit;
        break;
      case 'height':
        currentValue = this.convertFromCm(this.pallet.height_cm, unit);
        this.displayHeight = currentValue;
        this.currentHeightUnit = unit;
        break;
      case 'weight':
        currentValue = this.convertFromKg(this.pallet.weight, unit);
        this.displayWeight = currentValue;
        this.currentWeightUnit = unit;
        break;
    }
    
    this.onPalletChange();
  }
}