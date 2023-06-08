import type {MobControlParams} from "@client/control/player_control.js";

/**
 * @returns не null если посл евызова нужно установить параметры управления, промоделировать физику
 *   и выслать состояние. null - если не нужно.
 */
type FSMFunction = (context: any, delta: float, args: any) => MobControlParams | null

declare type FSMState = {
    func : FSMFunction
    args : any
}

export class FSMStack {
    list: FSMState[] = []

    /** @returns не null, если нужно изменить параметры управления, моделировать физику и выслать состояние */
    tick(delta : float, context : any) : MobControlParams | null {
        const current = this.getCurrentState()
        return current?.func.call(context, delta, current.args)
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