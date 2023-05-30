
/**
 * @returns true если посл евызова нужно промоделировать физику и выслать состояние
 */
type FSMFunction = (context: any, delta: float, args: any) => boolean

declare type FSMState = {
    func : FSMFunction
    args : any
}

export class FSMStack {
    list: FSMState[] = []

    /** @returns true, если нужно моделировать физику */
    tick(delta : float, context : any) : boolean {
        const current = this.getCurrentState()
        if(current) {
            const func = current.func
            return func.call(context, delta, current.args) ?? false
        }
        return false
    }
    
    pushState(func : FSMFunction, args? : any) {
        if (this.getCurrentState()?.func !== func) {
            this.list.push({func, args})
        }
    }

    replaceState(func : FSMFunction, args? : any) {
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