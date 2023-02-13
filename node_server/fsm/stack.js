export class FSMStack {
    constructor() {
        this.list = [];
    }

    tick(delta, context) {
        let currentStateFunction = this.getCurrentState();
        currentStateFunction?.call(context, delta);
        return currentStateFunction;
    }

    popState() {
        return this.list.pop();
    }

    pushState(state) {
        if (this.getCurrentState() !== state) {
            this.list.push(state);
        }
    }

    replaceState(state) {
        if (this.getCurrentState() !== state) {
            this.list.pop();
            this.list.push(state);
        }
    }

    getCurrentState() {
        return this.list.length > 0 ? this.list[this.list.length - 1] : null;
    }
}
