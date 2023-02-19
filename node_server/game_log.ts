import { SimpleQueue } from "../www/src/helpers.js"

export class GameLog {

    constructor(db) {
        this.db = db;
        this.items = new SimpleQueue();
        setInterval(() => {
                this.write();
            }, 
            2000
        );
        this.append('ServerRestart');
    }

    append(event_name, data) {
        this.items.push({event_name, data});
    }

    async write() {
        let item = null;
        const all = [];
        while(item = this.items.shift()) {
            all.push(this.db.LogAppend(item.event_name, item.data));
        }
        await Promise.all(all);
    }

}