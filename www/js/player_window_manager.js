import { ChargingStationWindow, ChestWindow, DoubleChestWindow, CraftTable, CreativeInventoryWindow, DieWindow, EditSignWindow, FurnaceWindow, InventoryWindow, NotImplementedWindow, QuestWindow, StatsWindow, AnvilWindow, BeaconWindow, ScreenshotWindow, BookWindow, InGameMain, BarrelWindow, EnderChestWindow, ModeWindow, BrewingWindow} from "./window/index.js";

export class PlayerWindowManager {

    constructor(player) {
        //
        this.player = player;
        const inventory = player.inventory;
        this.addWindow(new CraftTable(inventory, inventory.recipes));
        this.addWindow(new InventoryWindow(inventory, inventory.recipes));
        this.addWindow(new CreativeInventoryWindow(inventory));
        this.addWindow(new ChestWindow(inventory));
        this.addWindow(new DoubleChestWindow(inventory));
        this.addWindow(new FurnaceWindow(inventory));
        this.addWindow(new ChargingStationWindow(inventory));
        this.addWindow(new EditSignWindow(inventory));
        this.addWindow(new EnderChestWindow(inventory));
        this.addWindow(new NotImplementedWindow(inventory));
        this.addWindow(new QuestWindow(player));
        this.addWindow(new StatsWindow(player));
        this.addWindow(new DieWindow(player));
        this.addWindow(new AnvilWindow(inventory));
        this.addWindow(new BeaconWindow(player));
        this.addWindow(new ScreenshotWindow(player));
        this.addWindow(new BookWindow(player));
        this.addWindow(new BarrelWindow(inventory));
        // this.addWindow(new InGameMain(player, inventory, inventory.recipes));
        this.addWindow(new ModeWindow(player));
        this.addWindow(new BrewingWindow(inventory));
    }

    addWindow(w) {
        w.visible = false;
        this[w.id] = w;
        Qubatch.hud.wm.add(w);
    }

}