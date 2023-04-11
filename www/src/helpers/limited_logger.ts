
const HISTORY_TTL = 5000
const MAINTENANCE_PERIOD = 1000

type LogHistoryKey = int | string | null

enum LogMode { LOG, WARN, ERROR, DEBUG }

/** Describes a history of logging for one "key" (e.g. for one type of events for one player) */
type LogHistory = {
    key: LogHistoryKey
    printedKey: string
    lastConsoleTime: int
    skippedCount: 0
    mode: LogMode
}

/**
 * Configurable console logger for one kind of messages. Features:
 * - limit messages frequency (separately for different keys)
 * - enable/disable logging
 */
export class LimitedLogger {

    private prefix: string
    private minInterval: int
    private enabled: boolean
    private printKeyFn: ((...args: any[]) => string | null) | null
    private histories = new Map<LogHistoryKey, LogHistory>()
    private nextMaintenanceTime = -Infinity

    constructor(prefix: string, minInterval: int, printKeyFn: ((...args: any[]) => string | null) | null = null, enabled: boolean = true) {
        this.prefix = prefix.length && !prefix.endsWith(' ') ? prefix + ' ' : prefix
        this.minInterval= minInterval
        this.printKeyFn = printKeyFn
        this.enabled = enabled
    }

    log(...args: any[]): void {
        this._log(LogMode.LOG, args)
    }

    warn(...args: any[]): void {
        this._log(LogMode.WARN, args)
    }

    error(...args: any[]): void {
        this._log(LogMode.ERROR, args)
    }

    debug(...args: any[]): void {
        this._log(LogMode.DEBUG, args)
    }

    private _log(mode: LogMode, args: any[]): void {
        if (!this.enabled || args.length === 0) {
            return
        }
        if (performance.now() > this.nextMaintenanceTime) {
            this.periodicMaintenance()
        }

        let msg = args[args.length - 1]

        let key: LogHistoryKey
        if (args.length == 1) {
            key = null
        } else {
            key = args[0]
            for(let i = 1; i < args.length - 1; i++) {
                key += '|' + args[i]
            }
        }

        let history = this.histories.get(key)
        if (history == null) {
            let printedKey = (this.printKeyFn && this.printKeyFn(...args.slice(0, -1))) ?? ''
            if (printedKey.length && !printedKey.endsWith(' ')) {
                printedKey += ' '
            }
            history = {
                key,
                printedKey,
                lastConsoleTime: -Infinity,
                skippedCount: 0,
                mode
            }
            this.histories.set(key, history)
        }
        if (history.lastConsoleTime > performance.now() - this.minInterval) {
            history.skippedCount++
            return
        }
        if (history.skippedCount) {
            this.logSkipped(mode, history)
        }
        if (typeof msg === 'function') {
            msg = msg()
        }
        this.logString(mode, msg, history)
    }

    private logSkipped(mode: LogMode, history: LogHistory): void {
        this.logString(mode, `skipped ${history.skippedCount} similar messages`, history)
        history.skippedCount = 0
    }

    private logString(mode: LogMode, msg: string, history: LogHistory): void {
        msg = this.prefix + history.printedKey + msg
        switch (mode) {
            case LogMode.LOG:
                console.log(msg)
                break
            case LogMode.WARN:
                console.warn(msg)
                break
            case LogMode.ERROR:
                console.error(msg)
                break
            case LogMode.DEBUG:
                console.debug(msg)
                break
        }
        history.lastConsoleTime = performance.now()
    }

    private periodicMaintenance(): void {
        const now = performance.now()
        const minLogTime = now - this.minInterval
        const minDeleteTime = now - HISTORY_TTL
        for(const history of this.histories.values()) {
            if (history.lastConsoleTime < minLogTime) {
                if (history.skippedCount) {
                    this.logSkipped(history.mode, history)
                } else if (history.lastConsoleTime < minDeleteTime) {
                    this.histories.delete(history.key)
                }
            }
        }
        this.nextMaintenanceTime = now + MAINTENANCE_PERIOD
    }
}