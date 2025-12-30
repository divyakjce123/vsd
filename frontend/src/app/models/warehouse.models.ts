// frontend/src/app/models/warehouse.models.ts
export interface Dimensions {
  length: number;
  width: number;
  height: number;
  height_safety_margin: number;
  unit: string;
}

export interface Position {
  floor: number;  // Y_position (floors)
  row: number;    // X_position (rows)
  col: number;
  depth?: number; // Depth position
  side?: string;  // "left" or "right"
}

export interface PalletConfig {
  type: string;
  weight: number;
  length_cm: number;
  width_cm: number;
  height_cm: number;
  color: string;
  position: Position;
}

export interface SideAisleConfig {
  num_floors: number;  // Y_position (floors)
  num_rows: number;    // X_position (rows)
  num_aisles: number;  // Number of horizontal aisles
  depth: number;       // Number of Deep (depth dimension)
  custom_gaps: number[];  // Gaps between aisles: (num_aisles * depth) - 1 gaps
  gap_front: number;
  gap_back: number;
  gap_left: number;
  gap_right: number;
  wall_gap_unit: string;
}

export interface WorkstationConfig {
  workstation_index: number;
  aisle_space: number;  // Central aisle width (A_W)
  aisle_space_unit: string;
  left_side_config: SideAisleConfig;
  right_side_config: SideAisleConfig;
  pallet_configs: PalletConfig[];
}

export interface WarehouseConfig {
  workstations: boolean;
  id: string;
  warehouse_dimensions: Dimensions;
  num_workstations: number;
  workstation_gap: number;
  workstation_gap_unit: string;
  workstation_configs: WorkstationConfig[];
}

// Layout response interfaces
export interface PalletDims {
  length: number;
  width: number;
  height: number;
}

export interface PalletData {
  type: string;
  color: string;
  dims: PalletDims;
}

export interface AisleIndices {
  floor: number;  // Y_position (floors)
  row: number;    // X_position (rows)
  col: number;
  depth?: number;
  aisle?: number;
}

export interface AisleData {
  id: string;
  type?: string;  // "storage_aisle" or "central_aisle" or "workstation_gap"
  side?: string;  // "left" or "right" for storage aisles
  position: { x: number; y: number; z: number };
  dimensions: { length: number; width: number; height: number };
  indices: AisleIndices;
  pallets?: PalletData[];
}

export interface WorkstationGapData {
  id: string;
  type: string;
  position: { x: number; y: number; z: number };
  dimensions: { length: number; width: number; height: number };
}

export interface WorkstationData {
  id: string;
  position: { x: number; y: number; z: number };
  dimensions: { width: number; length: number; height: number };
  aisles: AisleData[];
}

export interface LayoutData {
  warehouse_dimensions?: {
    height_safety_margin: number;
    width: number;
    length: number;
    height: number;
  };
  workstation_gaps?: WorkstationGapData[];
  workstations: WorkstationData[];
}