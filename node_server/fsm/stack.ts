declare type FSMState = {
    func : Function
    args : any
}

export class FSMStack {
    list: FSMState[] = []
    
    tick(delta : float, context : any) : FSMState | null{
        const current = this.getCurrentState()
        if(current) {
            const func = current.func
            func.call(context, delta, current.args)
        }
        return current
    }
    
    pushState(func : Function, args? : any) {
        if (this.getCurrentState()?.func !== func) {
            this.list.push({func, args})
        }
    }

    replaceState(func : Function, args? : any) {
        if (this.getCurrentState()?.func !== func) {
            this.list.pop();
            this.list.push({func, args} as FSMState)
        }
    }
    
    getCurrentState() : FSMState | null {
        const index = this.list.length - 1
        return index >= 0 ? this.list[index] : null
    }

}