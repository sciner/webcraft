import type { Player } from "./player.js";
import { ChargingStationWindow, ChestWindow, DoubleChestWindow, CraftTable, CreativeInventoryWindow, DieWindow, EditSignWindow, FurnaceWindow, InventoryWindow, NotImplementedWindow, QuestWindow, StatsWindow, AnvilWindow, BeaconWindow, ScreenshotWindow, BookWindow, InGameMain, BarrelWindow, EnderChestWindow, ModeWindow, BrewingWindow, HopperWindow} from "./window/index.js";

export class PlayerWindowManager {
    player: Player;

    constructor(player : Player) {
        this.player = player;
        const inventory = player.inventory;
        this.addWindow(new CraftTable(inventory, inventory.recipes));
        this.addWindow(new InventoryWindow(inventory, inventory.recipes));
        this.addWindow(new CreativeInventoryWindow(inventory));
        this.addWindow(new ChestWindow(inventory));
        this.addWindow(new DoubleChestWindow(inventory));
        this.addWindow(new FurnaceWindow(inventory));
        this.addWindow(new ChargingStationWindow(inventory));
        this.addWindow(new EditSignWindow());
        this.addWindow(new EnderChestWindow(inventory));
        this.addWindow(new NotImplementedWindow());
        this.addWindow(new QuestWindow(player));
        this.addWindow(new StatsWindow(player));
        this.addWindow(new DieWindow());
        this.addWindow(new AnvilWindow(inventory));
        this.addWindow(new BeaconWindow(inventory));
        this.addWindow(new ScreenshotWindow(player));
        this.addWindow(new BookWindow(player));
        this.addWindow(new BarrelWindow(inventory));
        // this.addWindow(new InGameMain(player, inventory, inventory.recipes));
        this.addWindow(new ModeWindow(player));
        this.addWindow(new BrewingWindow(inventory));
        this.addWindow(new HopperWindow(inventory))
    }

    addWindow(w) {
        w.visible = false;
        this[w.id] = w;
        Qubatch.hud.wm.add(w);
    }

}