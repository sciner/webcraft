import { SimpleQueue } from "@client/helpers.js"

export class GameLog {
    db: any;
    items: SimpleQueue;

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

    append(event_name, data : any = null) {
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