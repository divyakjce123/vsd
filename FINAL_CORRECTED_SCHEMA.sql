-- ==========================================
-- FINAL CORRECTED WAREHOUSE SCHEMA
-- This matches the backend SQLAlchemy models exactly
-- ==========================================

-- 1. Warehouse Table
CREATE TABLE warehouse_table (
    warehouse_id VARCHAR(50) PRIMARY KEY,
    warehouse_name VARCHAR(100),
    warehouse_length FLOAT,
    warehouse_width FLOAT,
    warehouse_height FLOAT,
    warehouse_height_safety_margin FLOAT,
    warehousedimensions_unit VARCHAR(10) DEFAULT 'cm'
);

-- 2. Workstation Table (CORRECTED: Removed aisle_Space - it belongs in aisle table)
CREATE TABLE workstation_table (
    workstation_id SERIAL PRIMARY KEY,
    warehouse_id VARCHAR(50) REFERENCES warehouse_table(warehouse_id),
    workstation_index INT,
    workstation_gap FLOAT
);

-- 3. Aisle Configuration Table (CORRECTED: Fixed column name to match backend)
CREATE TABLE warehouse_aisle_table (
    waisle_id SERIAL PRIMARY KEY,
    workstation_id INT REFERENCES workstation_table(workstation_id),
    aisle_space FLOAT,  -- FIXED: Must be lowercase to match backend model
    aisle_space_unit VARCHAR(10) DEFAULT 'cm',
    waisle_side VARCHAR(10), -- 'left' or 'right'
    num_floors INT,
    num_rows INT,
    num_aisles INT,
    aisles_gap FLOAT[],
    aisle_gap_unit VARCHAR(10) DEFAULT 'cm',
    deep INT,
    deep_gap FLOAT[],
    deep_gap_unit VARCHAR(10) DEFAULT 'cm',
    gap_front FLOAT,
    gap_back FLOAT,
    gap_left FLOAT,
    gap_right FLOAT,
    wall_gap_unit VARCHAR(10) DEFAULT 'cm',
    -- Add constraints to ensure positive values
    CONSTRAINT positive_floors CHECK (num_floors >= 1),
    CONSTRAINT positive_rows CHECK (num_rows >= 1),
    CONSTRAINT positive_aisles CHECK (num_aisles >= 1),
    CONSTRAINT positive_deep CHECK (deep >= 1),
    CONSTRAINT unique_workstation_side UNIQUE (workstation_id, waisle_side)
);

-- 4. Pallet Table (CORRECTED: Removed invalid foreign key constraint)
CREATE TABLE warehouse_pallet_table (
    pallet_id SERIAL PRIMARY KEY,
    workstation_id INT REFERENCES workstation_table(workstation_id),
    type VARCHAR(50), -- Wooden, Plastic, Metal
    weight FLOAT,
    length FLOAT,
    width FLOAT,
    height FLOAT,
    pallet_dimensions_unit VARCHAR(10) DEFAULT 'cm',
    color VARCHAR(20), -- Use hex colors like #8B4513
    side VARCHAR(10),  -- left, right
    floor_idx INT,
    row_idx INT,
    aisle_idx INT,
    deep_idx INT,
    -- Add constraints to ensure valid indexing (0-based to match backend calculations)
    CONSTRAINT valid_floor_idx CHECK (floor_idx >= 0),
    CONSTRAINT valid_row_idx CHECK (row_idx >= 0),
    CONSTRAINT valid_aisle_idx CHECK (aisle_idx >= 0),
    CONSTRAINT valid_deep_idx CHECK (deep_idx >= 0)
);

-- ==========================================
-- INSERT SAMPLE DATA (CORRECTED)
-- ==========================================

-- A. Insert Warehouse
INSERT INTO warehouse_table VALUES 
('WH-DB-01', 'Warehouse 1', 3000, 6000, 1500, 300, 'cm');

-- B. Insert Workstations (CORRECTED: Removed aisle_Space column)
INSERT INTO workstation_table (warehouse_id, workstation_index, workstation_gap) VALUES 
('WH-DB-01', 0, 100),  -- Using 0-based indexing to match backend
('WH-DB-01', 1, 100);

-- C. Insert Aisle Configurations (CORRECTED: Use generated workstation_id values)
-- Get the actual workstation IDs that were generated
DO $$
DECLARE
    ws1_id INT;
    ws2_id INT;
BEGIN
    -- Get the generated workstation IDs
    SELECT workstation_id INTO ws1_id FROM workstation_table WHERE warehouse_id = 'WH-DB-01' AND workstation_index = 0;
    SELECT workstation_id INTO ws2_id FROM workstation_table WHERE warehouse_id = 'WH-DB-01' AND workstation_index = 1;
    
    -- Insert aisle configurations for workstation 1
    INSERT INTO warehouse_aisle_table (
        workstation_id, waisle_side, aisle_space, num_floors, num_rows, num_aisles, 
        aisles_gap, deep, deep_gap, gap_front, gap_back, gap_left, gap_right
    ) VALUES 
    (ws1_id, 'left', 500, 4, 4, 2, ARRAY[50.0], 1, ARRAY[0.0], 100, 100, 100, 100),
    (ws1_id, 'right', 500, 4, 4, 1, ARRAY[0.0], 2, ARRAY[50.0], 100, 100, 100, 100);
    
    -- Insert aisle configurations for workstation 2
    INSERT INTO warehouse_aisle_table (
        workstation_id, waisle_side, aisle_space, num_floors, num_rows, num_aisles, 
        aisles_gap, deep, deep_gap, gap_front, gap_back, gap_left, gap_right
    ) VALUES 
    (ws2_id, 'left', 500, 3, 5, 2, ARRAY[50.0], 2, ARRAY[50.0], 100, 100, 100, 100),
    (ws2_id, 'right', 500, 3, 5, 1, ARRAY[0.0], 2, ARRAY[50.0], 100, 100, 100, 100);
END $$;

-- D. Insert Pallets (CORRECTED: Use 0-based indexing and hex colors)
DO $$
DECLARE
    ws1_id INT;
    ws2_id INT;
BEGIN
    -- Get the workstation IDs
    SELECT workstation_id INTO ws1_id FROM workstation_table WHERE warehouse_id = 'WH-DB-01' AND workstation_index = 0;
    SELECT workstation_id INTO ws2_id FROM workstation_table WHERE warehouse_id = 'WH-DB-01' AND workstation_index = 1;
    
    -- --- WORKSTATION 1 : LEFT SIDE --- (0-based indexing)
    INSERT INTO warehouse_pallet_table 
    (workstation_id, type, color, side, weight, length, width, height, floor_idx, row_idx, aisle_idx, deep_idx)
    VALUES 
    -- Pallet 1: Wooden (Brown) at position [0,0,0,0]
    (ws1_id, 'Wooden', '#8B4513', 'left', 15.0, 120, 100, 15, 0, 0, 0, 0),
    -- Pallet 2: Plastic (Blue) at position [1,0,0,0]
    (ws1_id, 'Plastic', '#1E90FF', 'left', 15.0, 120, 100, 14, 1, 0, 0, 0),
    -- Pallet 3: Metal (Grey) at position [2,0,0,0]
    (ws1_id, 'Metal', '#A9A9A9', 'left', 45.0, 120, 100, 15, 2, 0, 0, 0),
    -- Pallet 4: Wooden (Brown) at position [0,1,1,0]
    (ws1_id, 'Wooden', '#8B4513', 'left', 30.0, 120, 100, 15, 0, 1, 1, 0);
    
    -- --- WORKSTATION 1 : RIGHT SIDE ---
    INSERT INTO warehouse_pallet_table 
    (workstation_id, type, color, side, weight, length, width, height, floor_idx, row_idx, aisle_idx, deep_idx)
    VALUES 
    -- Pallet 5: Plastic (Blue) at position [0,0,0,0]
    (ws1_id, 'Plastic', '#1E90FF', 'right', 18.0, 120, 80, 14, 0, 0, 0, 0),
    -- Pallet 6: Metal (Grey) at position [3,3,0,1]
    (ws1_id, 'Metal', '#A9A9A9', 'right', 50.0, 120, 100, 15, 3, 3, 0, 1);
    
    -- --- WORKSTATION 2 : LEFT SIDE ---
    INSERT INTO warehouse_pallet_table 
    (workstation_id, type, color, side, weight, length, width, height, floor_idx, row_idx, aisle_idx, deep_idx)
    VALUES 
    -- Pallet 7: Wooden (Brown) at position [0,4,0,0] (row 4, 0-based = row 5 in 1-based)
    (ws2_id, 'Wooden', '#8B4513', 'left', 22.0, 120, 100, 15, 0, 4, 0, 0),
    -- Pallet 8: Plastic (Blue) at position [1,2,1,0]
    (ws2_id, 'Plastic', '#1E90FF', 'left', 12.5, 110, 110, 12, 1, 2, 1, 0);
    
    -- --- WORKSTATION 2 : RIGHT SIDE ---
    INSERT INTO warehouse_pallet_table 
    (workstation_id, type, color, side, weight, length, width, height, floor_idx, row_idx, aisle_idx, deep_idx)
    VALUES 
    -- Pallet 9: Metal (Grey) at position [2,4,0,1]
    (ws2_id, 'Metal', '#A9A9A9', 'right', 60.0, 120, 100, 15, 2, 4, 0, 1),
    -- Pallet 10: Wooden (Brown) at position [1,3,0,0]
    (ws2_id, 'Wooden', '#8B4513', 'right', 28.0, 120, 100, 15, 1, 3, 0, 0);
END $$;

-- ==========================================
-- VERIFICATION QUERIES
-- ==========================================

-- Show all data
SELECT 'Warehouse Data:' as info;
SELECT * FROM warehouse_table;

SELECT 'Workstation Data:' as info;
SELECT * FROM workstation_table ORDER BY workstation_index;

SELECT 'Aisle Data:' as info;
SELECT workstation_id, waisle_side, num_floors, num_rows, num_aisles, deep 
FROM warehouse_aisle_table ORDER BY workstation_id, waisle_side;

SELECT 'Pallet Data with Search IDs:' as info;
-- Generate search IDs that match the frontend search feature
SELECT 
    pallet_id,
    CONCAT('WS', (workstation_index + 1), 
           '-R', (row_idx + 1),
           '-C', (aisle_idx + 1), 
           '-F', (floor_idx + 1),
           '-P', ROW_NUMBER() OVER (
               PARTITION BY p.workstation_id, p.side, p.floor_idx, p.row_idx, p.aisle_idx 
               ORDER BY p.pallet_id
           )
    ) AS search_id,
    type,
    color,
    side,
    weight,
    CONCAT('[', floor_idx, ',', row_idx, ',', aisle_idx, ',', deep_idx, ']') AS position_0based,
    CONCAT('[', floor_idx+1, ',', row_idx+1, ',', aisle_idx+1, ',', deep_idx+1, ']') AS position_1based
FROM warehouse_pallet_table p
JOIN workstation_table w ON p.workstation_id = w.workstation_id
ORDER BY w.workstation_index, p.side, p.floor_idx, p.row_idx, p.aisle_idx, p.pallet_id;

-- ==========================================
-- TEST SEARCH IDS FOR THE FRONTEND
-- ==========================================
SELECT 'Available Search IDs for Testing:' as info;
SELECT DISTINCT
    CONCAT('WS', (w.workstation_index + 1), 
           '-R', (p.row_idx + 1),
           '-C', (p.aisle_idx + 1), 
           '-F', (p.floor_idx + 1),
           '-P', ROW_NUMBER() OVER (
               PARTITION BY p.workstation_id, p.side, p.floor_idx, p.row_idx, p.aisle_idx 
               ORDER BY p.pallet_id
           )
    ) AS search_id,
    p.type,
    p.color
FROM warehouse_pallet_table p
JOIN workstation_table w ON p.workstation_id = w.workstation_id
ORDER BY search_id;