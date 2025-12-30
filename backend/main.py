# backend/main.py
from fastapi import FastAPI, HTTPException, Depends, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import json
from warehouse_calc import WarehouseCalculator

# --- DATABASE SETUP ---
from sqlalchemy import create_engine, Column, Integer, String, Float, ForeignKey
from sqlalchemy.dialects.postgresql import ARRAY  # specific for PostgreSQL Arrays
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session, relationship

# IMPORTANT: Update 'password' with your actual pgAdmin 4 password
# If your DB name is 'warehouse_db', ensure the URL ends with /warehouse_db
SQLALCHEMY_DATABASE_URL = "postgresql://postgres:12345@localhost:5433/WAREHOUSE_VISUALIZATION"

engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# --- SQLALCHEMY DATABASE MODELS ---
# These match the tables you created in pgAdmin 4

class DBWarehouse(Base):
    __tablename__ = "warehouse_table"
    warehouse_id = Column(String, primary_key=True)
    warehouse_name = Column(String)
    warehouse_length = Column(Float)
    warehouse_width = Column(Float)
    warehouse_height = Column(Float)
    warehouse_height_safety_margin = Column(Float)
    warehousedimensions_unit = Column(String, default="cm")

class DBWorkstation(Base):
    __tablename__ = "workstation_table"
    workstation_id = Column(Integer, primary_key=True)
    warehouse_id = Column(String, ForeignKey("warehouse_table.warehouse_id"))
    workstation_index = Column(Integer)
    workstation_gap = Column(Float)

class DBAisle(Base):
    __tablename__ = "warehouse_aisle_table"
    waisle_id = Column(Integer, primary_key=True)
    workstation_id = Column(Integer, ForeignKey("workstation_table.workstation_id"))
    
    # Configuration columns
    aisle_space = Column("aisle_space", Float) # Note: Case sensitive in some DBs
    aisle_space_unit = Column(String, default="cm")
    waisle_side = Column(String)  # 'left' or 'right'
    num_floors = Column(Integer)
    num_rows = Column(Integer)
    num_aisles = Column(Integer)
    
    # Array fields for gaps
    aisles_gap = Column(ARRAY(Float))
    aisle_gap_unit = Column(String, default="cm")
    
    deep = Column(Integer)
    deep_gap = Column(ARRAY(Float))
    deep_gap_unit = Column(String, default="cm")
    
    # Wall gaps
    gap_front = Column(Float)
    gap_back = Column(Float)
    gap_left = Column(Float)
    gap_right = Column(Float)
    wall_gap_unit = Column(String, default="cm")

class DBPallet(Base):
    __tablename__ = "warehouse_pallet_table"
    pallet_id = Column(Integer, primary_key=True)
    workstation_id = Column(Integer, ForeignKey("workstation_table.workstation_id"))
    
    type = Column(String)
    weight = Column(Float)
    length = Column(Float)
    width = Column(Float)
    height = Column(Float)
    pallet_dimensions_unit = Column(String, default="cm")
    color = Column(String)
    
    # Position
    side = Column(String)
    floor_idx = Column(Integer)
    row_idx = Column(Integer)
    aisle_idx = Column(Integer)
    deep_idx = Column(Integer)

# Create tables (Safe to run even if tables exist)
Base.metadata.create_all(bind=engine)

# Dependency to get DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# --- PYDANTIC MODELS (For API Response) ---

class Dimensions(BaseModel):
    length: float
    width: float
    height: float
    height_safety_margin: float
    unit: str = "cm"

class Position(BaseModel):
    floor: int
    row: int
    col: int
    deep: int = 1
    side: str = "left"

class PalletConfig(BaseModel):
    type: str
    weight: float
    length_cm: float 
    width_cm: float
    height_cm: float
    color: str = "#8B4513"
    position: Position

class SideAisleConfig(BaseModel):
    num_floors: int
    num_rows: int
    num_aisles: int
    custom_gaps: List[float] = []
    deep: int
    deep_gaps: List[float] = []
    gap_front: float
    gap_back: float
    gap_left: float
    gap_right: float
    wall_gap_unit: str = "cm"

class WorkstationConfig(BaseModel):
    workstation_index: int
    aisle_space: float
    aisle_space_unit: str = "cm"
    left_side_config: SideAisleConfig
    right_side_config: SideAisleConfig
    pallet_configs: List[PalletConfig]

class WarehouseConfig(BaseModel):
    id: str
    warehouse_dimensions: Dimensions
    num_workstations: int
    workstation_gap: float
    workstation_gap_unit: str = "cm"
    workstation_configs: List[WorkstationConfig]
    workstations: bool = True # Flag for frontend compatibility

# --- FASTAPI APP ---
app = FastAPI(title="Warehouse 3D Visualizer API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

warehouse_data = {} # In-memory fallback

# Helper to normalize units to CM
def to_cm(value, unit):
    factors = {'cm': 1, 'm': 100, 'mm': 0.1, 'ft': 30.48, 'in': 2.54}
    if value is None: return 0.0
    return float(value) * factors.get(unit.lower(), 1.0)

@app.get("/api/warehouse/db/{warehouse_id}")
async def get_warehouse_from_db(warehouse_id: str, db: Session = Depends(get_db)):
    """
    Fetches warehouse data from PostgreSQL, converts it to the format
    expected by WarehouseCalculator, and returns the config + layout.
    """
    # 1. Fetch Warehouse Record
    wh = db.query(DBWarehouse).filter(DBWarehouse.warehouse_id == warehouse_id).first()
    if not wh:
        raise HTTPException(status_code=404, detail=f"Warehouse '{warehouse_id}' not found in database.")

    # 2. Fetch Workstations
    workstations = db.query(DBWorkstation).filter(DBWorkstation.warehouse_id == warehouse_id).order_by(DBWorkstation.workstation_index).all()
    
    ws_configs = []
    
    for ws in workstations:
        # 3. Fetch Aisles (Left/Right Configs)
        aisles = db.query(DBAisle).filter(DBAisle.workstation_id == ws.workstation_id).all()
        
        # Default empty config structure
        default_side = {
            "num_floors": 1, "num_rows": 1, "num_aisles": 1, "deep": 1,
            "custom_gaps": [], "gap_front": 0, "gap_back": 0, "gap_left": 0, "gap_right": 0,
            "wall_gap_unit": "cm"
        }
        
        left_conf = default_side.copy()
        right_conf = default_side.copy()
        
        # Central aisle width logic (taken from aisle table)
        current_aisle_space = 500.0
        current_aisle_unit = "cm"

        for a in aisles:
            # If aisle_space is defined, use it for the workstation's central aisle
            if a.aisle_space is not None:
                current_aisle_space = a.aisle_space
                current_aisle_unit = a.aisle_space_unit or "cm"

            # Construct Side Config
            # Note: We prioritize 'aisles_gap' from DB for 'custom_gaps'
            conf = {
                "num_floors": a.num_floors,
                "num_rows": a.num_rows,
                "num_aisles": a.num_aisles,
                "deep": a.deep,
                "custom_gaps": a.aisles_gap if a.aisles_gap else [], 
                "gap_front": a.gap_front,
                "gap_back": a.gap_back,
                "gap_left": a.gap_left,
                "gap_right": a.gap_right,
                "wall_gap_unit": a.wall_gap_unit or "cm"
            }
            
            if a.waisle_side == 'left':
                left_conf = conf
            elif a.waisle_side == 'right':
                right_conf = conf

        # 4. Fetch Pallets
        pallets = db.query(DBPallet).filter(DBPallet.workstation_id == ws.workstation_id).all()
        pallet_configs = []
        
        for p in pallets:
            # Convert DB dimensions to CM for consistent calculation
            unit = p.pallet_dimensions_unit or "cm"
            pallet_configs.append({
                "type": p.type,
                "weight": p.weight,
                "length_cm": to_cm(p.length, unit),
                "width_cm": to_cm(p.width, unit),
                "height_cm": to_cm(p.height, unit),
                "color": p.color,
                "position": {
                    "floor": p.floor_idx,
                    "row": p.row_idx,
                    "col": p.aisle_idx, # Mapping SQL 'aisle_idx' to 'col'
                    "deep": p.deep_idx,
                    "side": p.side
                }
            })

        ws_configs.append({
            "workstation_index": ws.workstation_index,
            "aisle_space": current_aisle_space,
            "aisle_space_unit": current_aisle_unit,
            "left_side_config": left_conf,
            "right_side_config": right_conf,
            "pallet_configs": pallet_configs
        })

    # 5. Construct Final Config Object
    config_dict = {
        "id": wh.warehouse_id,
        "warehouse_dimensions": {
            "length": wh.warehouse_length,
            "width": wh.warehouse_width,
            "height": wh.warehouse_height,
            "height_safety_margin": wh.warehouse_height_safety_margin,
            "unit": wh.warehousedimensions_unit or "cm"
        },
        "num_workstations": len(ws_configs),
        "workstation_gap": workstations[0].workstation_gap if workstations else 100.0,
        "workstation_gap_unit": "cm", # Assuming cm for gap from DB
        "workstation_configs": ws_configs,
        "workstations": True
    }

    # 6. Calculate Layout using existing logic
    try:
        calc = WarehouseCalculator()
        layout = calc.create_warehouse_layout(config_dict)
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error calculating layout: {str(e)}")

    return {"success": True, "config": config_dict, "layout": layout}

# --- EXISTING ENDPOINTS (For compatibility) ---

@app.post("/api/warehouse/create")
async def create_warehouse(config: WarehouseConfig):
    """
    Standard generation from JSON payload (Frontend 'Generate Layout' button)
    """
    try:
        calc = WarehouseCalculator()
        config_dict = config.model_dump()
        layout = calc.create_warehouse_layout(config_dict)
        warehouse_data[config.id] = {"config": config_dict, "layout": layout}
        
        print(f"Generated layout for: {config.id}")
        return {"success": True, "warehouse_id": config.id, "layout": layout}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/warehouse/validate")
async def validate_config(config: WarehouseConfig):
    try:
        calc = WarehouseCalculator()
        calc.create_warehouse_layout(config.model_dump())
        return {"valid": True, "message": "Configuration is valid."}
    except Exception as e:
        return {"valid": False, "message": f"Validation Failed: {str(e)}"}

@app.get("/api/warehouse/{warehouse_id}")
async def get_warehouse(warehouse_id: str):
    # In-memory retrieval
    if warehouse_id not in warehouse_data:
        raise HTTPException(status_code=404, detail="Warehouse not found in memory")
    return {"success": True, "warehouse": warehouse_data[warehouse_id]}

@app.delete("/api/warehouse/{warehouse_id}/delete")
async def delete_warehouse(warehouse_id: str):
    if warehouse_id in warehouse_data:
        del warehouse_data[warehouse_id]
        return {"success": True, "message": f"Warehouse {warehouse_id} deleted."}
    raise HTTPException(status_code=404, detail="Warehouse not found")

if __name__ == '__main__':
    import uvicorn
    # Run on port 5000 to match frontend expectation
    uvicorn.run("main:app", host="127.0.0.1", port=5000, reload=True)