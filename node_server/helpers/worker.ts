
export class QubatchWorker {
    parentPort: any
    initializePromise: Promise<Function>
    initializeResolve: Function
    wait_init_cmd?: string // Если указана, то воркер будет ждать поступления этой команды и гарантированно
                           // вызовет @onMessageFunc в первый раз именно с указанной командой, и только потом все остальные

    constructor(wait_init_cmd?: string) {

        const that = this

        this.wait_init_cmd = wait_init_cmd
        if(wait_init_cmd) {
            this.initializePromise = new Promise(resolve => this.initializeResolve = resolve)
        }

        import('worker_threads').then(module => {
            that.parentPort = module.parentPort
            that.parentPort.on('message', that._onMessage.bind(this))
        })
    
    }

    // On message callback function
    async _onMessage(e) {

        let data = e;
        if(typeof e == 'object' && 'data' in e) {
            data = e.data;
        }
        const [cmd, args] = data

        // либо инициализируем, либо ждем пока инициализирется
        if(this.wait_init_cmd) {
            if (cmd === this.wait_init_cmd) {
                await this.onMessage(cmd, args)
                this.initializeResolve()
                return
            } else {
                await this.initializePromise
            }
        }

        try {
            await this.onMessage(cmd, args)
        } catch(e) {
            console.error('Error in world worker: ', e)
            if (typeof e !== 'string') {
                e = 'Error in world worker: ' + e
            }
            if (!e.startsWith('!lang')) {
                e = '!lang' + e
            }
            this.postMessage(['error', {args, e}])
        }
    }

    postMessage(message : any) {
        this.parentPort.postMessage(message)
    }

    async onMessage(cmd: string, args: any) {}

}