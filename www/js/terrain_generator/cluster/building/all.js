// Buildings
import { Farmland } from "./farmland.js";
import { WaterWell } from "./waterwell.js";
import { BuildingBlocks } from "./building_blocks.js";

export const building_classes = new Map()
building_classes.set('Farmland', Farmland);
building_classes.set('WaterWell', WaterWell);
building_classes.set('BuildingBlocks', BuildingBlocks);