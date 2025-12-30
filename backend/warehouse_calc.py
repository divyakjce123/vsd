import math

class WarehouseCalculator:
    def __init__(self):
        self.conversion_factors = {
            'cm': 1.0, 'm': 100.0, 'km': 100000.0,
            'in': 2.54, 'ft': 30.48, 'yd': 91.44, 'mm': 0.1
        }

        self.MIN_RACK_WIDTH_CM = 1.0
        self.MIN_RACK_LENGTH_CM = 1.0
        self.MIN_FLOOR_HEIGHT_CM = 10.0

    def to_cm(self, value, unit):
        if value is None:
            return 0.0
        try:
            return float(value) * self.conversion_factors.get(unit.lower(), 1.0)
        except ValueError:
            return 0.0

    def create_warehouse_layout(self, config):
        # Debug: Print pallet configs structure
        for i, ws_conf in enumerate(config['workstation_configs']):
            pallets = ws_conf.get('pallet_configs', [])
            print(f"\nWorkstation {i} has {len(pallets)} pallets")
            for j, p in enumerate(pallets):
                print(f"  Pallet {j}: type={p.get('type')}, position={p.get('position', {})}")
        
        wh = config['warehouse_dimensions']

        W = self.to_cm(wh['width'], wh['unit'])
        L = self.to_cm(wh['length'], wh['unit'])
        H = self.to_cm(wh['height'], wh['unit'])
        H_safety = self.to_cm(wh['height_safety_margin'], wh['unit'])

        n_ws = config['num_workstations']
        wg = self.to_cm(config['workstation_gap'], config['workstation_gap_unit'])

        workstation_width = (W - wg * (n_ws - 1)) / n_ws
        workstation_height = H - H_safety

        workstations = []

        for i, ws_conf in enumerate(config['workstation_configs']):
            ws_x = i * (workstation_width + wg)

            aisle_space = self.to_cm(
                ws_conf['aisle_space'],
                ws_conf.get('aisle_space_unit', 'cm')
            )

            side_width = (workstation_width - aisle_space) / 2

            aisles = []

            # CENTRAL AISLE
            aisles.append({
                "id": f"central-aisle-{i}",
                "type": "central_aisle",
                "position": {"x": ws_x + side_width, "y": 0, "z": 0},
                "dimensions": {
                    "width": aisle_space,
                    "length": L,
                    "height": workstation_height
                }
            })

            # LEFT + RIGHT SIDES
            aisles += self._process_side(
                ws_conf['left_side_config'],
                ws_x,
                side_width,
                L,
                workstation_height,
                i,
                "left"
            )

            aisles += self._process_side(
                ws_conf['right_side_config'],
                ws_x + side_width + aisle_space,
                side_width,
                L,
                workstation_height,
                i,
                "right"
            )

            # ASSIGN PALLETS
            self._assign_pallets(ws_conf.get('pallet_configs', []), aisles)

            workstations.append({
                "id": f"workstation_{i+1}",
                "position": {"x": ws_x, "y": 0, "z": 0},
                "dimensions": {
                    "width": workstation_width,
                    "length": L,
                    "height": H
                },
                "aisles": aisles
            })

        return {
            "warehouse_dimensions": {
                "width": W,
                "length": L,
                "height": H
            },
            "workstations": workstations
        }

    def _process_side(
        self,
        cfg,
        start_x,
        side_width,
        side_length,
        side_height,
        ws_index,
        side_name
    ):
        gf = self.to_cm(cfg['gap_front'], cfg['wall_gap_unit'])
        gb = self.to_cm(cfg['gap_back'], cfg['wall_gap_unit'])
        gl = self.to_cm(cfg['gap_left'], cfg['wall_gap_unit'])
        gr = self.to_cm(cfg['gap_right'], cfg['wall_gap_unit'])

        avail_w = side_width - gl - gr
        avail_l = side_length - gf - gb

        rows = cfg['num_rows']
        floors = cfg['num_floors']
        num_aisles = cfg['num_aisles']
        deep = cfg['deep']

        # ✅ TRUE STORAGE AISLE COUNT
        n = num_aisles * deep

        custom_gaps = [self.to_cm(g, cfg['wall_gap_unit']) for g in cfg.get('custom_gaps', [])]
        custom_gaps += [0.0] * (n - 1 - len(custom_gaps))

        aisle_space = (avail_w - sum(custom_gaps)) / n
        aisle_length = avail_l / rows
        aisle_height = side_height / floors

        aisles = []

        for r in range(rows):
            y = gf + r * aisle_length
            current_x = start_x + gl
            aisle_no = 1

            for d in range(deep):
                for a in range(num_aisles):

                    if aisle_no > 1:
                        current_x += custom_gaps[aisle_no - 2]

                    for f in range(floors):
                        aisles.append({
                            "id": f"aisle-{ws_index}-{side_name}-{r}-{aisle_no}-{f}",
                            "type": "storage_aisle",
                            "side": side_name,
                            "position": {
                                "x": current_x,
                                "y": y,
                                "z": f * aisle_height
                            },
                            "dimensions": {
                                "width": aisle_space,
                                "length": aisle_length,
                                "height": aisle_height
                            },
                            "indices": {
                                "row": r + 1,
                                "floor": f + 1,
                                "col": aisle_no,               # ✅ GLOBAL column index (1 → n)
                                "deep": d + 1,
                                "aisle": a + 1 if num_aisles > 1 else 1
                            },
                            "pallets": []
                        })

                    current_x += aisle_space
                    aisle_no += 1

        return aisles

    def _assign_pallets(self, pallets, aisles):
        for i, p in enumerate(pallets):
            pos = p.get('position', {})
            if not pos:
                print(f"Warning: Pallet {i} has no position information")
                continue
            
            # Match pallet to aisle using: side, row, floor, deep, col (global aisle index)
            side = pos.get('side')
            row = pos.get('row')
            floor = pos.get('floor')
            deep = pos.get('deep')
            col = pos.get('col')  # Global aisle column index
            
            if not all([side, row is not None, floor is not None, deep is not None, col is not None]):
                print(f"Warning: Pallet {i} has incomplete position: {pos}")
                continue
                
            for aisle in aisles:
                if aisle['type'] != 'storage_aisle':
                    continue
                    
                # Match on all indices
                if (aisle.get('side') == side and
                    aisle['indices']['row'] == row and
                    aisle['indices']['floor'] == floor and
                    aisle['indices']['deep'] == deep and
                    aisle['indices']['col'] == col):
                    
                    aisle['pallets'].append({
                        "type": p.get('type', 'wooden'),
                        "color": p.get('color', '#8B4513'),
                        "dims": {
                            "length": p.get('length_cm', 0),
                            "width": p.get('width_cm', 0),
                            "height": p.get('height_cm', 0)
                        }
                    })
                    break
