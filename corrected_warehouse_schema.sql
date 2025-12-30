-- ==========================================
-- CORRECTED WAREHOUSE DATABASE SCHEMA
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

-- 2. Workstation Table (CORRECTED: Removed duplicate aisle_space columns)
CREATE TABLE workstation_table (
    workstation_id SERIAL PRIMARY KEY,
    warehouse_id VARCHAR(50) REFERENCES warehouse_table(warehouse_id),
    workstation_index INT,
    workstation_gap FLOAT
);

-- 3. Aisle Configuration Table (CORRECTED: Fixed column name consistency)
CREATE TABLE warehouse_aisle_table (
    waisle_id SERIAL PRIMARY KEY,
    workstation_id INT REFERENCES workstation_table(workstation_id),
    aisle_space FLOAT,  -- FIXED: Consistent naming with backend model
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
    wall_gap_unit VARCHAR(10) DEFAULT 'cm'
);

-- 4. Pallet Table
CREATE TABLE warehouse_pallet_table (
    pallet_id SERIAL PRIMARY KEY,
    workstation_id INT REFERENCES workstation_table(workstation_id),
    type VARCHAR(50), -- Wooden, Plastic, Metal
    weight FLOAT,
    length FLOAT,
    width FLOAT,
    height FLOAT,
    pallet_dimensions_unit VARCHAR(10) DEFAULT 'cm',
    color VARCHAR(20), -- Brown, Blue, Grey
    side VARCHAR(10),  -- left, right
    floor_idx INT,
    row_idx INT,
    aisle_idx INT,
    deep_idx INT
);

-- ==========================================
-- INSERT SAMPLE DATA
-- ==========================================

-- A. Insert Warehouse
INSERT INTO warehouse_table VALUES 
('WH-DB-01', 'Warehouse 1', 3000, 6000, 1500, 300, 'cm');

-- B. Insert Workstations
INSERT INTO workstation_table (warehouse_id, workstation_index, workstation_gap) VALUES 
('WH-DB-01', 1, 100),
('WH-DB-01', 2, 100);

-- C. Insert Aisle Configurations
-- CORRECTED: Get actual workstation_id values from the inserted records
-- Workstation 1 (Left & Right)
INSERT INTO warehouse_aisle_table (
    workstation_id, waisle_side, aisle_space, num_floors, num_rows, num_aisles, 
    aisles_gap, deep, deep_gap, gap_front, gap_back, gap_left, gap_right
) VALUES 
-- Left side of workstation 1
((SELECT workstation_id FROM workstation_table WHERE warehouse_id = 'WH-DB-01' AND workstation_index = 1), 
 'left', 500, 4, 4, 2, ARRAY[50.0], 1, ARRAY[0.0], 100, 100, 100, 100),
-- Right side of workstation 1
((SELECT workstation_id FROM workstation_table WHERE warehouse_id = 'WH-DB-01' AND workstation_index = 1), 
 'right', 500, 4, 4, 1, ARRAY[0.0], 2, ARRAY[50.0], 100, 100, 100, 100);

-- Workstation 2 (Left & Right)
INSERT INTO warehouse_aisle_table (
    workstation_id, waisle_side, aisle_space, num_floors, num_rows, num_aisles, 
    aisles_gap, deep, deep_gap, gap_front, gap_back, gap_left, gap_right
) VALUES 
-- Left side of workstation 2
((SELECT workstation_id FROM workstation_table WHERE warehouse_id = 'WH-DB-01' AND workstation_index = 2), 
 'left', 500, 3, 5, 2, ARRAY[50.0], 2, ARRAY[50.0], 100, 100, 100, 100),
-- Right side of workstation 2
((SELECT workstation_id FROM workstation_table WHERE warehouse_id = 'WH-DB-01' AND workstation_index = 2), 
 'right', 500, 3, 5, 1, ARRAY[0.0], 2, ARRAY[50.0], 100, 100, 100, 100);

-- D. Insert Pallets
-- CORRECTED: Use proper workstation_id references and hex colors for better compatibility

-- --- WORKSTATION 1 : LEFT SIDE ---
INSERT INTO warehouse_pallet_table 
(workstation_id, type, color, side, weight, length, width, height, floor_idx, row_idx, aisle_idx, deep_idx)
VALUES 
-- Pallet 1: Wooden (Brown) at position [0,0,0,0]
((SELECT workstation_id FROM workstation_table WHERE warehouse_id = 'WH-DB-01' AND workstation_index = 1), 
 'Wooden', '#8B4513', 'left', 15.0, 120, 100, 15, 0, 0, 0, 0),
-- Pallet 2: Plastic (Blue) at position [1,0,0,0]
((SELECT workstation_id FROM workstation_table WHERE warehouse_id = 'WH-DB-01' AND workstation_index = 1), 
 'Plastic', '#1E90FF', 'left', 15.0, 120, 100, 14, 1, 0, 0, 0),
-- Pallet 3: Metal (Grey) at position [2,0,0,0]
((SELECT workstation_id FROM workstation_table WHERE warehouse_id = 'WH-DB-01' AND workstation_index = 1), 
 'Metal', '#A9A9A9', 'left', 45.0, 120, 100, 15, 2, 0, 0, 0),
-- Pallet 4: Wooden (Brown) at position [0,1,1,0]
((SELECT workstation_id FROM workstation_table WHERE warehouse_id = 'WH-DB-01' AND workstation_index = 1), 
 'Wooden', '#8B4513', 'left', 30.0, 120, 100, 15, 0, 1, 1, 0);

-- --- WORKSTATION 1 : RIGHT SIDE ---
INSERT INTO warehouse_pallet_table 
(workstation_id, type, color, side, weight, length, width, height, floor_idx, row_idx, aisle_idx, deep_idx)
VALUES 
-- Pallet 5: Plastic (Blue)
((SELECT workstation_id FROM workstation_table WHERE warehouse_id = 'WH-DB-01' AND workstation_index = 1), 
 'Plastic', '#1E90FF', 'right', 18.0, 120, 80, 14, 0, 0, 0, 0),
-- Pallet 6: Metal (Grey)
((SELECT workstation_id FROM workstation_table WHERE warehouse_id = 'WH-DB-01' AND workstation_index = 1), 
 'Metal', '#A9A9A9', 'right', 50.0, 120, 100, 15, 3, 3, 0, 0);

-- --- WORKSTATION 2 : LEFT SIDE ---
INSERT INTO warehouse_pallet_table 
(workstation_id, type, color, side, weight, length, width, height, floor_idx, row_idx, aisle_idx, deep_idx)
VALUES 
-- Pallet 7: Wooden (Brown)
((SELECT workstation_id FROM workstation_table WHERE warehouse_id = 'WH-DB-01' AND workstation_index = 2), 
 'Wooden', '#8B4513', 'left', 22.0, 120, 100, 15, 0, 4, 0, 0),
-- Pallet 8: Plastic (Blue)
((SELECT workstation_id FROM workstation_table WHERE warehouse_id = 'WH-DB-01' AND workstation_index = 2), 
 'Plastic', '#1E90FF', 'left', 12.5, 110, 110, 12, 1, 2, 1, 0);

-- --- WORKSTATION 2 : RIGHT SIDE ---
INSERT INTO warehouse_pallet_table 
(workstation_id, type, color, side, weight, length, width, height, floor_idx, row_idx, aisle_idx, deep_idx)
VALUES 
-- Pallet 9: Metal (Grey)
((SELECT workstation_id FROM workstation_table WHERE warehouse_id = 'WH-DB-01' AND workstation_index = 2), 
 'Metal', '#A9A9A9', 'right', 60.0, 120, 100, 15, 2, 4, 1, 0),
-- Pallet 10: Wooden (Brown)
((SELECT workstation_id FROM workstation_table WHERE warehouse_id = 'WH-DB-01' AND workstation_index = 2), 
 'Wooden', '#8B4513', 'right', 28.0, 120, 100, 15, 1, 3, 0, 0);

-- ==========================================
-- VERIFY DATA
-- ==========================================
SELECT 'Warehouse Data:' as info;
SELECT * FROM warehouse_table;

SELECT 'Workstation Data:' as info;
SELECT * FROM workstation_table;

SELECT 'Aisle Data:' as info;
SELECT * FROM warehouse_aisle_table;

SELECT 'Pallet Data:' as info;
SELECT * FROM warehouse_pallet_table ORDER BY workstation_id, side, floor_idx, row_idx, aisle_idx;

-- ==========================================
-- USEFUL QUERIES FOR TESTING SEARCH FEATURE
-- ==========================================

-- Query to see pallet locations in a format similar to the search IDs
SELECT 
    CONCAT('WS', 
           (SELECT workstation_index FROM workstation_table ws WHERE ws.workstation_id = p.workstation_id),
           '-R', (p.row_idx + 1),
           '-C', (p.aisle_idx + 1), 
           '-F', (p.floor_idx + 1),
           '-P', ROW_NUMBER() OVER (
               PARTITION BY p.workstation_id, p.side, p.floor_idx, p.row_idx, p.aisle_idx 
               ORDER BY p.pallet_id
           )
    ) AS search_id,
    p.type,
    p.color,
    p.side,
    p.weight,
    CONCAT(p.length, '×', p.width, '×', p.height, ' cm') AS dimensions
FROM warehouse_pallet_table p
ORDER BY p.workstation_id, p.side, p.floor_idx, p.row_idx, p.aisle_idx, p.pallet_id;