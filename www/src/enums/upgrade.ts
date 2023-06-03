import { BLOCK } from "../blocks.js"
const ALL = ['COPPER_SWORD', 'IRON_SWORD', 'GOLDEN_SWORD', 'TITANIUM_SWORD', 'NETHERITE_SWORD', 'COPPER_AXE', 'IRON_AXE', 'GOLDEN_AXE', 'TITANIUM_AXE', 'NETHERITE_AXE', 'COPPER_SHOVEL', 'IRON_SHOVEL', 'GOLDEN_SHOVEL', 'TITANIUM_SHOVEL', 'NETHERITE_SHOVEL', 'COPPER_HOE', 'IRON_HOE', 'GOLDEN_HOE', 'TITANIUM_HOE', 'NETHERITE_HOE', 'COPPER_PICKAXE', 'IRON_PICKAXE', 'GOLDEN_PICKAXE', 'TITANIUM_PICKAXE', 'NETHERITE_PICKAXE'];

export default class Upgrade {
    [key: string]: any;
    
    static SPEED = 0
    static POWER = 1
    static DAMAGE = 2

    static getLevelById(item, id: number) {
        const upgrades = item?.extra_data?.upgrades
        if (!upgrades) {
            return 0
        }
        for (const upgrade of upgrades) {
            if (upgrade.id == id) {
                return upgrade.lvl
            }
        }
        return 0
    }

    static isCompatible(item) {
        const blockName = BLOCK.fromId(item.id).name
        return ALL.includes(blockName)
    }

    static getValueById(item, val: number, id: number) {
        const pr = this.getLevelById(item, id)
        return Math.round(pr * val * 10) / 10
    }
    
}