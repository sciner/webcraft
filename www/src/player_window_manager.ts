import type { Player } from "./player.js";
import {ChargingStationWindow, ChestWindow, DoubleChestWindow, CraftTable, CreativeInventoryWindow, DieWindow, EditSignWindow, FurnaceWindow, InventoryWindow, NotImplementedWindow, QuestWindow, StatsWindow, AnvilWindow, BeaconWindow, ScreenshotWindow, BookWindow, InGameMain, BarrelWindow, EnderChestWindow, ModeWindow, BrewingWindow, HopperWindow, RecipeWindow, InventoryRecipeWindow} from "./window/index.js";
import type {WindowManager} from "./ui/wm.js";

export class PlayerWindowManager {
    player: Player;
    wm: WindowManager

    frmRecipe?          : RecipeWindow
    frmInventoryRecipe? : InventoryRecipeWindow

    constructor(player : Player) {
        this.wm = player.world.game.hud.wm
        this.player = player;
        const inventory = player.inventory;
        const recipes = inventory.recipes
        this.addWindow(new CraftTable(inventory, inventory.recipes));
        // this.addWindow(new InventoryWindow(inventory, inventory.recipes));
        this.addWindow(new CreativeInventoryWindow(inventory));
        this.addWindow(new ChestWindow(inventory));
        this.addWindow(new DoubleChestWindow(inventory));
        this.addWindow(new FurnaceWindow(inventory));
        this.addWindow(new ChargingStationWindow(inventory));
        this.addWindow(new EditSignWindow());
        this.addWindow(new EnderChestWindow(inventory));
        this.addWindow(new NotImplementedWindow());
        // this.addWindow(new QuestWindow(player));
        this.addWindow(new StatsWindow(player));
        this.addWindow(new DieWindow());
        this.addWindow(new AnvilWindow(inventory));
        this.addWindow(new BeaconWindow(inventory));
        this.addWindow(new ScreenshotWindow(player));
        this.addWindow(new BookWindow(player));
        this.addWindow(new BarrelWindow(inventory));
        this.addWindow(new InGameMain(player, inventory, inventory.recipes));
        this.addWindow(new ModeWindow(player));
        this.addWindow(new BrewingWindow(inventory));
        this.addWindow(new HopperWindow(inventory))
        /**
         * Перенесено союда из конструктора {@link RecipeManager}, т.к. он серверный класс, не можем там
         * импортировать типы окон, и тут более подходящее место.
         * Как и было в {@link RecipeManager}, игра стартует не дожидаясь конца загрузки рецептов - потенциально баг при гонках.
         */
        inventory.recipesLoadPromise.then(() => {
            this.addWindow(this.frmRecipe = new RecipeWindow(recipes))
            this.addWindow(this.frmInventoryRecipe = new InventoryRecipeWindow(recipes))
        })
    }

    addWindow(w) {
        w.visible = false;

        // это не использовалось:
        //this[w.id] = w;

        this.wm.add(w);
    }

}