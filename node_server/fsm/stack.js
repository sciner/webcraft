export class FSMStack {

    constructor() {
        this.list = [];
    }
    
    tick(delta) {
        let currentStateFunction = this.getCurrentState();
        if (currentStateFunction != null) {
            currentStateFunction(delta);
        }
    }
    
    popState() {
        return this.list.pop();
    }
    
    pushState(state) {
        if (this.getCurrentState() !== state) {
            this.list.push(state);
        }
    }
    
    getCurrentState() {
        return this.list.length > 0 ? this.list[this.list.length - 1] : null;
    }

}