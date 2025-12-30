import {
  Component,
  ElementRef,
  ViewChild,
  AfterViewInit,
  Input,
  OnChanges,
  OnDestroy,
  HostListener,
  EventEmitter,
  Output,
  SimpleChanges,
} from "@angular/core";
import {
  LayoutData,
  WorkstationData,
  AisleData,
  PalletData,
  WarehouseConfig,
} from "../../models/warehouse.models";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import * as PIXI from "pixi.js";

@Component({
  selector: "app-visualization",
  templateUrl: "./visualization.component.html",
  styleUrls: ["./visualization.component.css"],
})
export class VisualizationComponent
  implements AfterViewInit, OnChanges, OnDestroy
{
  @ViewChild("threeCanvas") threeCanvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild("twoCanvas") twoCanvasRef!: ElementRef<HTMLCanvasElement>;

  @Input() layoutData!: LayoutData | null;
  @Input() warehouseDimensions: any;

  // External 3D/2D toggle from parent component
  private _is3DView: boolean = true;
  @Input()
  get is3DView(): boolean {
    return this._is3DView;
  }
  set is3DView(value: boolean) {
    this._is3DView = value;
    // Once view is initialized, keep internal mode in sync
    if (this.isViewInitialized) {
      this.switchView(value ? "3d" : "2d");
    }
  }

  @Input() warehouseConfig: WarehouseConfig | null = null;
  @Output() elementClicked = new EventEmitter<any>();
  @Output() palletClicked = new EventEmitter<any>();
  
  viewMode: "3d" | "2d" = "3d";

  // Three.js variables
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private controls!: OrbitControls;
  private animationFrameId!: number;
  private labelSprites: THREE.Sprite[] = [];

  // 2D (PIXI) variables
  private pixiApp?: PIXI.Application;
  private pixiStage?: PIXI.Container;
  private isViewInitialized = false;
  private wireframeMode = false;

  // Warehouse dimensions from layout response
  private whWidth: number = 6000;
  private whLength: number = 3000;
  private whHeight: number = 1500;
  private safetyMargin: number = 300;

  // Configuration for "Image 2" Styling
  private readonly COLORS = {
    background: 0xf5f5f5,       // Light gray background
    gridPrimary: 0xaaaaaa,      // Main grid lines
    gridSecondary: 0xd0d0d0,    // Sub grid lines
    
    // Axis Colors
    axisX: 0xff0000, // Red
    axisY: 0x00ff00, // Green (Length)
    axisZ: 0x0000ff, // Blue (Height)
    text: 0x333333,

    // Aisle Styling (Blue Transparent look)
    aisleFill: 0x4a90d9,         // Steel Blue
    aisleEdge: 0x1565c0,         // Darker Blue for edges
    aisleAisle: 0x64b5f6,        // Lighter blue for aisles
    
    // Pallets
    palletWood: 0x8b4513,
    palletPlastic: 0x1e90ff,
    palletMetal: 0xa9a9a9,
  };

  ngAfterViewInit() {
    this.initialize3DView();
    this.initialize2DView();
    this.isViewInitialized = true;
    // Make sure initial internal view matches external toggle
    this.switchView(this.is3DView ? "3d" : "2d");
  }

  ngOnChanges(changes: SimpleChanges) {
    // Extract warehouse dimensions from layout data or config
    if (this.layoutData) {
      const layoutAny = this.layoutData as any;
      if (layoutAny.warehouse_dimensions) {
        this.whWidth = layoutAny.warehouse_dimensions.width || this.whWidth;
        this.whLength = layoutAny.warehouse_dimensions.length || this.whLength;
        this.whHeight = layoutAny.warehouse_dimensions.height || this.whHeight;
      }
    }
    
    // Fallback to warehouseConfig if dimensions not in layout
    if (this.warehouseConfig?.warehouse_dimensions) {
      const dim = this.warehouseConfig.warehouse_dimensions;
      const unitFactor = this.getUnitConversionFactor(dim.unit);
      this.whWidth = this.whWidth || dim.width * unitFactor;
      this.whLength = this.whLength || dim.length * unitFactor;
      this.whHeight = this.whHeight || dim.height * unitFactor;
    }

    if (this.isViewInitialized && this.layoutData) {
      if (this.viewMode === "3d") {
        this.update3DVisualization();
      } else {
        this.update2DVisualization();
      }
    }
  }

  private getUnitConversionFactor(unit: string): number {
    const factors: { [key: string]: number } = {
      'cm': 1, 'm': 100, 'mm': 0.1, 'ft': 30.48, 'in': 2.54, 'yd': 91.44
    };
    return factors[unit?.toLowerCase()] || 1;
  }

  ngOnDestroy() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    if (this.renderer) {
      this.renderer.dispose();
    }
    if (this.pixiApp) {
      // Destroy PIXI app and resources (baseTexture cleanup is covered by texture:true)
      this.pixiApp.destroy(true, { children: true, texture: true });
      this.pixiApp = undefined;
      this.pixiStage = undefined;
    }
    // Clean up labels
    this.labelSprites.forEach(sprite => {
      sprite.material.map?.dispose();
      sprite.material.dispose();
    });
  }

  @HostListener("window:resize")
  onResize() {
    if (this.threeCanvasRef?.nativeElement) {
      const canvas = this.threeCanvasRef.nativeElement;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;

      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height, false);
    }

    if (this.twoCanvasRef?.nativeElement) {
      this.update2DVisualization();
    }
  }

  // ============ 3D VISUALIZATION ============

  private initialize3DView() {
    const canvas = this.threeCanvasRef.nativeElement;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    // 1. Scene Setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(this.COLORS.background);

    // 2. Camera Setup (Z-Up Configuration)
    this.camera = new THREE.PerspectiveCamera(45, width / height, 1, 50000);
    this.camera.up.set(0, 0, 1); // IMPORTANT: Sets Z as the "Up" axis
    this.camera.position.set(2000, -2000, 2000); // Isometric-ish view
    this.camera.lookAt(0, 0, 0);

    // 3. Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
    });
    this.renderer.setSize(width, height, false);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // 4. Controls
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.screenSpacePanning = true;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.05; // Prevent going below ground

    // 5. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
    dirLight.position.set(1000, -2000, 3000); // Light from top-front-left
    dirLight.castShadow = true;
    // Optimize shadow map
    dirLight.shadow.camera.left = -5000;
    dirLight.shadow.camera.right = 5000;
    dirLight.shadow.camera.top = 5000;
    dirLight.shadow.camera.bottom = -5000;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    this.scene.add(dirLight);

    // 6. Helpers
    this.setupEnvironment();

    this.animate();
  }

  private setupEnvironment() {
    // Remove existing ground, grid, and axis indicators if they exist
    const existingGround = this.scene.getObjectByName('ground-plane');
    const existingGrid = this.scene.getObjectByName('grid-helper');
    const existingAxisX = this.scene.getObjectByName('axis-x');
    const existingAxisY = this.scene.getObjectByName('axis-y');
    const existingAxisZ = this.scene.getObjectByName('axis-z');
    
    if (existingGround) this.scene.remove(existingGround);
    if (existingGrid) this.scene.remove(existingGrid);
    if (existingAxisX) this.scene.remove(existingAxisX);
    if (existingAxisY) this.scene.remove(existingAxisY);
    if (existingAxisZ) this.scene.remove(existingAxisZ);
    
    // Clean up old label sprites
    this.labelSprites.forEach(sprite => {
      this.scene.remove(sprite);
      sprite.material.map?.dispose();
      sprite.material.dispose();
    });
    this.labelSprites = [];

    // Calculate grid size to be larger than warehouse
    // Grid should extend beyond warehouse in all directions
    const padding = Math.max(500, Math.max(this.whWidth, this.whLength) * 0.2);
    const gridWidth = this.whWidth + padding * 2;
    const gridLength = this.whLength + padding * 2;
    const gridSize = Math.max(gridWidth, gridLength);
    
    // Calculate divisions based on warehouse size (grid lines every 500cm or appropriate spacing)
    const gridSpacing = Math.max(100, Math.min(500, gridSize / 20));
    const gridDivisions = Math.ceil(gridSize / gridSpacing);

    // Create a ground plane at Z=0
    const groundGeo = new THREE.PlaneGeometry(gridSize, gridSize);
    const groundMat = new THREE.MeshBasicMaterial({ 
      color: 0xf5f5f5, 
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.6
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2; // Rotate to lie flat on XY plane
    // Center the ground around the warehouse center
    ground.position.set(this.whWidth / 2, this.whLength / 2, -1);
    ground.name = 'ground-plane';
    this.scene.add(ground);

    // Grid Helper - positioned to cover warehouse area and beyond
    const gridHelper = new THREE.GridHelper(
      gridSize, 
      gridDivisions, 
      this.COLORS.gridPrimary, 
      this.COLORS.gridSecondary
    );
    // GridHelper by default is on XZ plane, rotate to XY plane for Z-up
    gridHelper.rotation.x = Math.PI / 2;
    // Center the grid around the warehouse center
    gridHelper.position.set(this.whWidth / 2, this.whLength / 2, 0);
    gridHelper.name = 'grid-helper';
    this.scene.add(gridHelper);

    // Axis Helper
    this.addAxisIndicators();
  }

  private addAxisIndicators() {
    const origin = new THREE.Vector3(0, 0, 0);
    const length = Math.min(this.whWidth, this.whLength, this.whHeight) * 0.3;
    const headLength = length * 0.15;
    const headWidth = length * 0.08;

    // X Axis (Width) - Red
    const arrowX = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), origin, length, this.COLORS.axisX, headLength, headWidth);
    arrowX.name = 'axis-x';
    
    // Y Axis (Length) - Green
    const arrowY = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), origin, length, this.COLORS.axisY, headLength, headWidth);
    arrowY.name = 'axis-y';
    
    // Z Axis (Height) - Blue
    const arrowZ = new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), origin, length, this.COLORS.axisZ, headLength, headWidth);
    arrowZ.name = 'axis-z';

    this.scene.add(arrowX, arrowY, arrowZ);

    // Labels
    this.addLabel("Width (cm) X", new THREE.Vector3(length + 100, 0, 0));
    this.addLabel("Length (cm) Y", new THREE.Vector3(0, length + 100, 0));
    this.addLabel("Height (cm) Z", new THREE.Vector3(0, 0, length + 100));
  }

  private addLabel(text: string, position: THREE.Vector3, options?: {
    color?: string;
    backgroundColor?: string;
    fontSize?: number;
    scale?: number;
    addToScene?: boolean;
  }): THREE.Sprite {
    const opts = {
      color: '#333333',
      backgroundColor: 'transparent',
      fontSize: 32,
      scale: 200,
      addToScene: true,
      ...options
    };

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    canvas.width = 256;
    canvas.height = 64;
    
    // Background
    if (opts.backgroundColor !== 'transparent') {
      ctx.fillStyle = opts.backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    
    ctx.fillStyle = opts.color;
    ctx.font = `bold ${opts.fontSize}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 128, 32);

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(material);
    
    sprite.position.copy(position);
    sprite.scale.set(opts.scale, opts.scale * 0.25, 1);
    
    if (opts.addToScene) {
      this.scene.add(sprite);
      this.labelSprites.push(sprite);
    }
    
    return sprite;
  }

  private createTextSprite(text: string, options?: {
    color?: string;
    backgroundColor?: string;
    fontSize?: number;
    borderColor?: string;
    padding?: number;
  }): THREE.Sprite {
    const opts = {
      color: '#ffffff',
      backgroundColor: '#1565c0',
      fontSize: 24,
      borderColor: '#0d47a1',
      padding: 8,
      ...options
    };

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    canvas.width = 256;
    canvas.height = 64;
    
    // Draw rounded rectangle background
    const radius = 8;
    ctx.fillStyle = opts.backgroundColor;
    ctx.beginPath();
    ctx.roundRect(4, 4, canvas.width - 8, canvas.height - 8, radius);
    ctx.fill();
    
    // Border
    ctx.strokeStyle = opts.borderColor;
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Text
    ctx.fillStyle = opts.color;
    ctx.font = `bold ${opts.fontSize}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ 
      map: texture, 
      transparent: true,
      depthTest: false,
      depthWrite: false
    });
    
    return new THREE.Sprite(material);
  }

  private update3DVisualization() {
    if (!this.layoutData || !this.scene) return;

    // Clear previous warehouse objects
    const objToRemove = this.scene.getObjectByName("warehouse-objects");
    if (objToRemove) {
      this.scene.remove(objToRemove);
      // Dispose of geometries and materials
      objToRemove.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry?.dispose();
          if (child.material instanceof THREE.Material) {
            child.material.dispose();
          }
        }
      });
    }

    // Update ground and grid to match new warehouse dimensions
    this.setupEnvironment();

    const mainGroup = new THREE.Group();
    mainGroup.name = "warehouse-objects";

    // 1. Draw Warehouse Floor Outline
    this.drawFloorBoundary(mainGroup);

    // 2. Draw Workstation Gaps (empty space between workstations)
    if (this.layoutData.workstation_gaps) {
      this.layoutData.workstation_gaps.forEach((gap) => {
        this.drawGap(mainGroup, gap);
      });
    }

    // 3. Draw Workstations and Aisles
    if (this.layoutData.workstations) {
      this.layoutData.workstations.forEach((workstation) => {
        this.drawWorkstation(mainGroup, workstation);
      });
    }

    this.scene.add(mainGroup);
    this.fitCameraToScene(mainGroup);
  }

  private drawFloorBoundary(group: THREE.Group) {
    const width = this.whWidth;   // X dimension
    const length = this.whLength; // Y dimension

    // Create warehouse floor outline as a dashed rectangle
    const points = [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(width, 0, 0),
      new THREE.Vector3(width, length, 0),
      new THREE.Vector3(0, length, 0),
      new THREE.Vector3(0, 0, 0)
    ];

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineDashedMaterial({
      color: 0x333333,
      dashSize: 50,
      gapSize: 25,
      linewidth: 2
    });

    const boundaryLine = new THREE.Line(geometry, material);
    boundaryLine.computeLineDistances(); // Required for dashed lines
    boundaryLine.name = 'warehouse-boundary';
    group.add(boundaryLine);

    // Add corner markers
    const markerSize = Math.min(width, length) * 0.02;
    const cornerMaterial = new THREE.MeshBasicMaterial({ color: 0x333333 });
    const cornerGeometry = new THREE.SphereGeometry(markerSize, 8, 8);
    
    [[0, 0], [width, 0], [width, length], [0, length]].forEach(([x, y]) => {
      const marker = new THREE.Mesh(cornerGeometry, cornerMaterial);
      marker.position.set(x, y, 0);
      group.add(marker);
    });
  }

  private drawWorkstation(group: THREE.Group, workstation: WorkstationData) {
    // In Z-up coordinate system:
    // X = Width direction, Y = Length/Depth direction, Z = Height direction
    // Aisle positions are already absolute (calculated by backend)
    
    const workstationGroup = new THREE.Group();
    workstationGroup.name = `workstation-${workstation.id}`;
    
    // Taisle unique floors, rows, and columns for labeling
    const uniqueFloors = new Set<number>();
    const uniqueRows = new Set<number>();
    const uniqueCols = new Set<number>();
    const aislesByPosition: Map<string, AisleData> = new Map();
    
    // Collect info about storage aisles only (not central aisles or gaps)
    const storageAisles = workstation.aisles.filter(a => a.type === 'storage_aisle');
    
    storageAisles.forEach((aisle) => {
      if (aisle.indices) {
        uniqueFloors.add(aisle.indices.floor);
        uniqueRows.add(aisle.indices.row);
        if (aisle.indices.col) {
          uniqueCols.add(aisle.indices.col);
        }
        aislesByPosition.set(`${aisle.indices.floor}-${aisle.indices.row}-${aisle.indices.col || 0}`, aisle);
      }
    });
    
    // Draw all aisles in the workstation (including central aisles)
    workstation.aisles.forEach((aisle) => {
      this.drawAisle(workstationGroup, aisle);
    });
    
    // Add Workstation Label at the front-center-top
    if (workstation.aisles.length > 0) {
      const workstationIndex = (workstation as any).workstation_index !== undefined ? (workstation as any).workstation_index + 1 : 
                         parseInt(workstation.id.replace('workstation_', '')) || 1;
      
      // Calculate workstation bounds
      const workstationBounds = this.calculateWorkstationBounds(workstation.aisles);
      
      // Workstation label position - front center, above the workstation
      const workstationLabelPos = new THREE.Vector3(
        workstationBounds.centerX,
        workstationBounds.minY - 80,
        workstationBounds.maxZ + 100
      );
      
      const workstationLabel = this.createTextSprite(`Workstation ${workstationIndex}`, {
        backgroundColor: '#2196f3',
        borderColor: '#1565c0',
        color: '#ffffff',
        fontSize: 28
      });
      workstationLabel.position.copy(workstationLabelPos);
      workstationLabel.scale.set(180, 45, 1);
      workstationGroup.add(workstationLabel);
      
      // Add storage aisle information label
      const numStorageAisles = storageAisles.length;
      const storageInfoLabel = this.createTextSprite(`Storage Aisles: ${numStorageAisles}`, {
        backgroundColor: '#ff9800',
        borderColor: '#f57c00',
        color: '#ffffff',
        fontSize: 18
      });
      storageInfoLabel.position.set(workstationBounds.centerX, workstationBounds.maxY + 80, workstationBounds.maxZ + 50);
      storageInfoLabel.scale.set(150, 35, 1);
      workstationGroup.add(storageInfoLabel);
      
      // Add Floor Labels (on the left side)
      this.addFloorLabels(workstationGroup, workstation.aisles, workstationBounds, uniqueFloors);
      
      // Add Row Labels (at the front)
      this.addRowLabels(workstationGroup, workstation.aisles, workstationBounds, uniqueRows);
      
      // Add Aisle/Column Labels (at the top)
      this.addAisleLabels(workstationGroup, workstation.aisles, workstationBounds, uniqueCols);
    }
    
    group.add(workstationGroup);
  }

  private calculateWorkstationBounds(aisles: AisleData[]): {
    minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number;
    centerX: number; centerY: number; centerZ: number;
  } {
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    
    aisles.forEach(aisle => {
      const { x, y, z } = aisle.position;
      const { width, length, height } = aisle.dimensions;
      
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x + width);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y + length);
      minZ = Math.min(minZ, z);
      maxZ = Math.max(maxZ, z + height);
    });
    
    return {
      minX, maxX, minY, maxY, minZ, maxZ,
      centerX: (minX + maxX) / 2,
      centerY: (minY + maxY) / 2,
      centerZ: (minZ + maxZ) / 2
    };
  }

  private addFloorLabels(
    group: THREE.Group, 
    aisles: AisleData[], 
    bounds: any, 
    uniqueFloors: Set<number>
  ) {
    // Get floor heights by finding aisles at each floor level
    const floorHeights: Map<number, number> = new Map();
    
    aisles.forEach(aisle => {
      if (aisle.indices) {
        const floor = aisle.indices.floor;
        if (!floorHeights.has(floor)) {
          floorHeights.set(floor, aisle.position.z + aisle.dimensions.height / 2);
        }
      }
    });
    
    // Create labels for each floor
    Array.from(uniqueFloors).sort((a, b) => a - b).forEach(floor => {
      const zPos = floorHeights.get(floor) || 0;
      
      const label = this.createTextSprite(`Floor ${floor}`, {
        backgroundColor: '#4caf50',
        borderColor: '#388e3c',
        color: '#ffffff',
        fontSize: 20
      });
      
      label.position.set(bounds.minX - 120, bounds.centerY, zPos);
      label.scale.set(140, 35, 1);
      group.add(label);
    });
  }

  private addRowLabels(
    group: THREE.Group, 
    aisles: AisleData[], 
    bounds: any, 
    uniqueRows: Set<number>
  ) {
    // Get row Y positions
    const rowPositions: Map<number, number> = new Map();
    
    aisles.forEach(aisle => {
      if (aisle.indices) {
        const row = aisle.indices.row;
        if (!rowPositions.has(row)) {
          rowPositions.set(row, aisle.position.y + aisle.dimensions.length / 2);
        }
      }
    });
    
    // Create labels for each row
    Array.from(uniqueRows).sort((a, b) => a - b).forEach(row => {
      const yPos = rowPositions.get(row) || 0;
      
      const label = this.createTextSprite(`Row ${row}`, {
        backgroundColor: '#ff9800',
        borderColor: '#f57c00',
        color: '#ffffff',
        fontSize: 20
      });
      
      label.position.set(bounds.minX - 120, yPos, bounds.minZ - 30);
      label.scale.set(120, 30, 1);
      group.add(label);
    });
  }

  private addAisleLabels(
    group: THREE.Group, 
    aisles: AisleData[], 
    bounds: any, 
    uniqueCols: Set<number>
  ) {
    // Get aisle/column X positions (only for ground floor to avoid clutter)
    const colPositions: Map<number, number> = new Map();
    
    aisles.forEach(aisle => {
      if (aisle.indices && aisle.indices.floor === 1) { // Only get positions from floor 1
        const col = aisle.indices.col;
        if (!colPositions.has(col)) {
          colPositions.set(col, aisle.position.x + aisle.dimensions.width / 2);
        }
      }
    });
    
    // Create labels for each aisle/column
    Array.from(uniqueCols).sort((a, b) => a - b).forEach(col => {
      const xPos = colPositions.get(col);
      if (xPos === undefined) return;
      
      const label = this.createTextSprite(`Aisle ${col}`, {
        backgroundColor: '#9c27b0',
        borderColor: '#7b1fa2',
        color: '#ffffff',
        fontSize: 20
      });
      
      label.position.set(xPos, bounds.minY - 60, bounds.maxZ + 50);
      label.scale.set(120, 30, 1);
      group.add(label);
    });
  }

  private drawAisle(group: THREE.Group, aisle: AisleData) {
    const aisleType = aisle.type || 'storage_aisle';
    
    if (aisleType === 'central_aisle') {
      // Draw central aisle as empty space with outline only
      this.drawCentralAisle(group, aisle);
    } else if (aisleType === 'storage_aisle') {
      // Draw storage aisle with transparent blue appearance
      this.drawStorageAisle(group, aisle);
    }
  }

  private drawStorageAisle(group: THREE.Group, aisle: AisleData) {
    const { width, length, height } = aisle.dimensions;
    const { x, y, z } = aisle.position;

    // Create Aisle Group
    const aisleGroup = new THREE.Group();
    aisleGroup.name = `aisle-${aisle.id}`;
    
    // Position at the corner (x, y, z), then offset by half dimensions
    aisleGroup.position.set(
      x + width / 2,
      y + length / 2,
      z + height / 2
    );

    // 1. Transparent Blue Body (Glass-like appearance)
    const geometry = new THREE.BoxGeometry(width, length, height);
    const material = new THREE.MeshPhysicalMaterial({
      color: this.COLORS.aisleFill,
      transparent: true,
      opacity: 0.25,
      metalness: 0.0,
      roughness: 0.3,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const cube = new THREE.Mesh(geometry, material);
    cube.castShadow = true;
    cube.receiveShadow = true;
    aisleGroup.add(cube);

    // 2. Solid Edges (Structural frame outline)
    const edges = new THREE.EdgesGeometry(geometry);
    const edgeMaterial = new THREE.LineBasicMaterial({ 
      color: this.COLORS.aisleEdge,
      linewidth: 1.5 
    });
    const wireframe = new THREE.LineSegments(edges, edgeMaterial);
    aisleGroup.add(wireframe);

    // 3. Draw Pallets if present
    if (aisle.pallets && aisle.pallets.length > 0) {
      aisle.pallets.forEach((pallet, index) => {
        this.drawPallet(aisleGroup, pallet, width, length, height);
      });
    }

    group.add(aisleGroup);
  }

  private drawCentralAisle(group: THREE.Group, aisle: AisleData) {
    const { width, length, height } = aisle.dimensions;
    const { x, y, z } = aisle.position;

    const aisleGroup = new THREE.Group();
    aisleGroup.name = `central-aisle-${aisle.id}`;
    
    aisleGroup.position.set(
      x + width / 2,
      y + length / 2,
      z
    );

    // Draw only outline (edges) to show empty space
    const geometry = new THREE.BoxGeometry(width, length);
    const edges = new THREE.EdgesGeometry(geometry);
    const edgeMaterial = new THREE.LineBasicMaterial({ 
      color: 0x000000,  // Light gray for central aisle outline
      linewidth: 2
    });
    const wireframe = new THREE.LineSegments(edges, edgeMaterial);
    aisleGroup.add(wireframe);

    group.add(aisleGroup);
  }

  private drawGap(group: THREE.Group, gap: any) {
    const { width, length, height } = gap.dimensions;
    const { x, y, z } = gap.position;

    if (width <= 0) return; // Skip zero-width gaps

    const gapGroup = new THREE.Group();
    gapGroup.name = `gap-${gap.id}`;
    
    gapGroup.position.set(
      x + width / 2,
      y + length / 2,
      z + height / 2
    );

    // Draw only outline (edges) to show empty space
    const geometry = new THREE.BoxGeometry(width, length, height);
    const edges = new THREE.EdgesGeometry(geometry);
    const edgeMaterial = new THREE.LineDashedMaterial({ 
      color: 0x000000,  
      gapSize: 10,
      linewidth: 2
    });
    const wireframe = new THREE.LineSegments(edges, edgeMaterial);
    wireframe.computeLineDistances(); // Required for dashed lines
    gapGroup.add(wireframe);

    group.add(gapGroup);
  }

  private drawPallet(
    aisleGroup: THREE.Group, 
    pallet: PalletData, 
    aisleWidth: number, 
    aisleLength: number, 
    aisleHeight: number
  ) {
    // Calculate pallet size - use actual dims or scale to fit aisle
    const pw = pallet.dims?.width || aisleWidth * 0.8;
    const pl = pallet.dims?.length || aisleLength * 0.8;
    const ph = pallet.dims?.height || aisleHeight * 0.6;
    
    const palletGeo = new THREE.BoxGeometry(
      Math.min(pw, aisleWidth * 0.9),
      Math.min(pl, aisleLength * 0.9),
      Math.min(ph, aisleHeight * 0.8)
    );
    
    const palletMat = new THREE.MeshStandardMaterial({ 
      color: this.getPalletColor(pallet.color),
      roughness: 0.7,
      metalness: 0.1
    });
    
    const palletMesh = new THREE.Mesh(palletGeo, palletMat);
    // Position pallet at bottom-center of aisle
    palletMesh.position.set(0, 0, -aisleHeight/2 + ph/2 + 5);
    palletMesh.castShadow = true;
    palletMesh.receiveShadow = true;
    
    aisleGroup.add(palletMesh);
  }

  private getPalletColor(colorName: string): number {
    // Handle hex color strings
    if (colorName?.startsWith('#')) {
      return parseInt(colorName.slice(1), 16);
    }
    
    const map: { [key: string]: number } = {
      wood: this.COLORS.palletWood,
      wooden: this.COLORS.palletWood,
      plastic: this.COLORS.palletPlastic,
      metal: this.COLORS.palletMetal,
      blue: 0x1e90ff,
      red: 0xff4444,
      green: 0x4caf50
    };
    return map[colorName?.toLowerCase()] || this.COLORS.palletWood;
  }

  private fitCameraToScene(object: THREE.Object3D) {
    const box = new THREE.Box3().setFromObject(object);
    if (box.isEmpty()) {
      // Use warehouse dimensions if no objects
      box.setFromCenterAndSize(
        new THREE.Vector3(this.whWidth/2, this.whLength/2, this.whHeight/2),
        new THREE.Vector3(this.whWidth, this.whLength, this.whHeight)
      );
    }

    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    
    // Calculate camera distance based on FOV
    const fov = this.camera.fov * (Math.PI / 180);
    const cameraDistance = Math.abs(maxDim / Math.tan(fov / 2)) * 1.2;

    // Position camera for isometric-like view (looking at center from corner)
    this.camera.position.set(
      center.x + cameraDistance * 0.7,
      center.y - cameraDistance * 0.7,
      center.z + cameraDistance * 0.6
    );
    
    this.camera.lookAt(center);
    this.controls.target.copy(center);
    this.controls.update();
  }

  private animate() {
    this.animationFrameId = requestAnimationFrame(() => this.animate());
    this.controls.update();
    // Update labels to look at camera (billboarding)
    // Note: Sprites do this automatically, but if we used Mesh text we'd need this.
    this.renderer.render(this.scene, this.camera);
  }

  // ============ 2D VISUALIZATION ============
  
  private initialize2DView() {
    const canvas = this.twoCanvasRef?.nativeElement;
    if (!canvas) return;

    const container = canvas.parentElement || canvas;
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    this.pixiApp = new PIXI.Application({
      view: canvas,
      width,
      height,
      antialias: true,
      backgroundAlpha: 1,
      backgroundColor: 0xffffff,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });
    this.pixiStage = new PIXI.Container();
    this.pixiApp.stage.addChild(this.pixiStage);
  }

  private update2DVisualization() {
    if (!this.layoutData || !this.pixiApp || !this.pixiStage || !this.twoCanvasRef) return;

    const canvas = this.twoCanvasRef.nativeElement;
    const container = canvas.parentElement || canvas;
    const canvasWidth = container.clientWidth || 800;
    const canvasHeight = container.clientHeight || 600;

    this.pixiApp.renderer.resize(canvasWidth, canvasHeight);
    this.pixiStage.removeChildren();
    const stage = this.pixiStage;

    const whWidth = this.whWidth;
    const whLength = this.whLength;

    const padding = 60;
    const scaleX = (canvasWidth - padding * 2) / whWidth;
    const scaleY = (canvasHeight - padding * 2) / whLength;
    const scale = Math.min(scaleX, scaleY);

    const drawWidth = whWidth * scale;
    const drawHeight = whLength * scale;
    const offsetX = (canvasWidth - drawWidth) / 2;
    const offsetY = (canvasHeight - drawHeight) / 2;

    this.draw2DGridPIXI(offsetX, offsetY, drawWidth, drawHeight, scale);

    const boundary = new PIXI.Graphics();
    boundary.lineStyle(3, 0x333333, 1);
    boundary.drawRect(offsetX, offsetY, drawWidth, drawHeight);
    stage.addChild(boundary);

    this.draw2DAxisLabelsPIXI(offsetX, offsetY, drawWidth, drawHeight, whWidth, whLength);

    if ((this.layoutData as any).workstations) {
      this.layoutData.workstations.forEach((workstation: any, subIdx: number) => {
        const rowPositions: Map<number, number> = new Map();
        const colPositions: Map<number, number> = new Map();
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        
        workstation.aisles.forEach((aisle: any) => {
          if (aisle.indices.floor === 1) {
            const rX = offsetX + aisle.position.x * scale;
            const rY = offsetY + aisle.position.y * scale;
            const rW = aisle.dimensions.width * scale;
            const rL = aisle.dimensions.length * scale;

            if (!rowPositions.has(aisle.indices.row)) {
              rowPositions.set(aisle.indices.row, rY + rL / 2);
            }
            if (!colPositions.has(aisle.indices.col)) {
              colPositions.set(aisle.indices.col, rX + rW / 2);
            }
            
            minX = Math.min(minX, rX);
            maxX = Math.max(maxX, rX + rW);
            minY = Math.min(minY, rY);
            maxY = Math.max(maxY, rY + rL);

            const aisleRect = new PIXI.Graphics();
            aisleRect.beginFill(0x4a90d9, 0.35);
            aisleRect.lineStyle(1.5, 0x1565c0, 1);
            aisleRect.drawRect(rX, rY, rW, rL);
            aisleRect.endFill();
            stage.addChild(aisleRect);

            const aisleLabel = this.makeTextPIXI(
              `R${aisle.indices.row}C${aisle.indices.col}`,
              9,
              0x1565c0
            );
            aisleLabel.x = rX + rW / 2;
            aisleLabel.y = rY + rL / 2;
            aisleLabel.anchor.set(0.5);
            stage.addChild(aisleLabel);

            if (aisle.pallets && aisle.pallets.length > 0) {
              aisle.pallets.forEach((pallet: PalletData) => {
                const palletMargin = Math.min(rW, rL) * 0.15;
                const palletRect = new PIXI.Graphics();
                const color = pallet.color?.startsWith("#")
                  ? parseInt(pallet.color.slice(1), 16)
                  : 0x8b4513;
                palletRect.beginFill(color, 0.7);
                palletRect.drawRect(
                  rX + palletMargin,
                  rY + palletMargin,
                  rW - palletMargin * 2,
                  rL - palletMargin * 2
                );
                palletRect.endFill();
                stage.addChild(palletRect);
              });
            }
          }
        });

        if (minX !== Infinity) {
          const centerX = (minX + maxX) / 2;

          this.drawPillLabelPIXI(
            `Workstation ${subIdx + 1}`,
            centerX,
            minY - 25,
            { bg: 0x2196f3, color: 0xffffff, fontSize: 12, padding: 6 }
          );

          Array.from(rowPositions.entries()).sort((a, b) => a[0] - b[0]).forEach(([row, yPos]) => {
            this.drawPillLabelPIXI(
              `Row ${row}`,
              minX - 35,
              yPos,
              { bg: 0xff9800, color: 0xffffff, fontSize: 10, padding: 4 }
            );
          });

          Array.from(colPositions.entries()).sort((a, b) => a[0] - b[0]).forEach(([col, xPos]) => {
            this.drawPillLabelPIXI(
              `Aisle ${col}`,
              xPos,
              minY - 8,
              { bg: 0x9c27b0, color: 0xffffff, fontSize: 9, padding: 3 }
            );
          });
        }
      });
    }
  }

  // ===== PIXI helpers =====

  private draw2DGridPIXI(offsetX: number, offsetY: number, width: number, height: number, scale: number) {
    if (!this.pixiStage) return;
    const grid = new PIXI.Graphics();
    const gridSpacing = 500;
    const gridSpacingScaled = gridSpacing * scale;
    const gridPadding = gridSpacingScaled * 2;
    const gridStartX = offsetX - gridPadding;
    const gridEndX = offsetX + width + gridPadding;
    const gridStartY = offsetY - gridPadding;
    const gridEndY = offsetY + height + gridPadding;

    grid.lineStyle(0.5, 0xe0e0e0, 1);

    const startXGrid = Math.floor(gridStartX / gridSpacingScaled) * gridSpacingScaled;
    for (let x = startXGrid; x <= gridEndX; x += gridSpacingScaled) {
      grid.moveTo(x, gridStartY);
      grid.lineTo(x, gridEndY);
    }

    const startYGrid = Math.floor(gridStartY / gridSpacingScaled) * gridSpacingScaled;
    for (let y = startYGrid; y <= gridEndY; y += gridSpacingScaled) {
      grid.moveTo(gridStartX, y);
      grid.lineTo(gridEndX, y);
    }

    this.pixiStage.addChild(grid);
  }

  private draw2DAxisLabelsPIXI(
    offsetX: number, offsetY: number,
    width: number, height: number,
    whWidth: number, whLength: number
  ) {
    this.drawPillLabelPIXI(
      `Width: ${whWidth.toFixed(0)} cm`,
      offsetX + width / 2,
      offsetY + height + 30,
      { bg: 0x333333, color: 0xffffff, fontSize: 12, padding: 6 }
    );

    this.drawPillLabelPIXI(
      `Length: ${whLength.toFixed(0)} cm`,
      offsetX - 40,
      offsetY + height / 2,
      { bg: 0x333333, color: 0xffffff, fontSize: 12, padding: 6 },
      true
    );

    const zeroLabel = this.makeTextPIXI("0", 10, 0x666666);
    zeroLabel.x = offsetX - 12;
    zeroLabel.y = offsetY + height + 12;
    zeroLabel.anchor.set(1, 0);
    this.pixiStage?.addChild(zeroLabel);

    const widthLabel = this.makeTextPIXI(`${whWidth.toFixed(0)}`, 10, 0x666666);
    widthLabel.x = offsetX + width + 12;
    widthLabel.y = offsetY + height + 12;
    widthLabel.anchor.set(0, 0);
    this.pixiStage?.addChild(widthLabel);
  }

  private drawPillLabelPIXI(
    text: string,
    x: number,
    y: number,
    opts: { bg: number; color: number; fontSize: number; padding: number },
    rotate90: boolean = false
  ) {
    const label = this.makeTextPIXI(text, opts.fontSize, opts.color);
    // Use label's measured size instead of TextMetrics (works across Pixi versions)
    const w = label.width + opts.padding * 2;
    const h = label.height + opts.padding * 2;

    const container = new PIXI.Container();
    const bg = new PIXI.Graphics();
    bg.beginFill(opts.bg, 1);
    bg.drawRoundedRect(-w / 2, -h / 2, w, h, 6);
    bg.endFill();

    label.anchor.set(0.5);
    container.addChild(bg);
    container.addChild(label);
    container.x = x;
    container.y = y;
    if (rotate90) container.rotation = -Math.PI / 2;
    this.pixiStage?.addChild(container);
  }

  private makeTextPIXI(text: string, fontSize: number, color: number): PIXI.Text {
    return new PIXI.Text(text, {
      fontFamily: "Arial",
      fontSize,
      fill: color,
      fontWeight: "bold",
      align: "center",
    });
  }

  // ============ PUBLIC METHODS ============

  switchView(mode: "3d" | "2d") {
    this.viewMode = mode;
    setTimeout(() => {
      if (mode === "3d" && this.layoutData) {
        this.update3DVisualization();
      } else if (mode === "2d" && this.layoutData) {
        this.update2DVisualization();
      }
      this.onResize();
    }, 0);
  }

  resetCamera() {
    if (this.camera && this.controls) {
      // Reset to default Isometric view
      this.fitCameraToScene(this.scene.getObjectByName("warehouse-objects") || this.scene);
    }
  }

  toggleWireframe() {
    this.wireframeMode = !this.wireframeMode;
    if (this.layoutData) {
      this.update3DVisualization();
    }
  }

  onCanvasClick(event: MouseEvent) {
    // Keep existing click logic for 2D...
    if (this.viewMode === "2d") {
        // Implementation similar to previous logic
    }
  }
}