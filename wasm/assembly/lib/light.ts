import { adjustSrc } from "./constants";
import { World } from "./world";

const world = new World();
world.defDayLight = adjustSrc(15);
