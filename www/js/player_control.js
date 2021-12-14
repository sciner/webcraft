export class PlayerControl  {

    constructor() {
        this.back               = false;
        this.forward            = false;
        this.right              = false;
        this.left               = false;
        this.jump               = false;
        this.sneak              = false;
        this.sprint             = false;
        this.mouseX             = 0;
        this.mouseY             = 0;
        this.mouse_sensitivity  = 1.0;
        this.inited             = false;
        this.enabled            = false;
    }

}
