import {ServerClient} from "../server_client.js";

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

type TLimitedLoggerOptions = {
    prefix: string
    minInterval: int
    player?: any
    enabled?: boolean
    consoleDisabled?: boolean
    debugValueSendLog?: string
    debugValueEnabled?: string
    printKeyFn?: ((...args: any[]) => string | null) | null
}

/**
 * Configurable console logger for one kind of messages. Features:
 * - limit messages frequency (separately for different keys)
 * - enable/disable logging
 */
export class LimitedLogger {

    options: TLimitedLoggerOptions
    private histories = new Map<LogHistoryKey, LogHistory>()
    private nextMaintenanceTime = -Infinity

    constructor(options: TLimitedLoggerOptions) {
        this.options = options
        if (options.prefix.length && !options.prefix.endsWith(' ')) {
            options.prefix += ' '
        }
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
        const options = this.options
        const enabled = options.enabled || this.hasDebugValue(options.debugValueEnabled)
        if (!enabled || args.length === 0) {
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
            const printKeyFn = options.printKeyFn
            let printedKey = (printKeyFn && printKeyFn(...args.slice(0, -1))) ?? ''
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
        if (history.lastConsoleTime > performance.now() - this.options.minInterval) {
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
        history.lastConsoleTime = performance.now()
    }

    private logSkipped(mode: LogMode, history: LogHistory): void {
        this.logString(mode, `skipped ${history.skippedCount} similar messages`, history)
        history.skippedCount = 0
    }

    private logString(mode: LogMode, msg: string, history: LogHistory): void {
        const options = this.options
        const timestamp = (Math.round(performance.now()) % 100000).toString().padStart(5, '0')
        msg = `${options.prefix}${history.printedKey} ${timestamp} ${msg}`
        if (this.hasDebugValue(options.debugValueSendLog)) {
            options.player?.sendPackets([{ name: ServerClient.CMD_LOG_CONSOLE, data: msg }])
        }
        if (options.consoleDisabled) {
            return
        }
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
    }

    private periodicMaintenance(): void {
        const now = performance.now()
        const minLogTime = now - this.options.minInterval
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

    private hasDebugValue(name: string | null): boolean {
        return name && this.options.player?.debugValues?.has(name)
    }
}