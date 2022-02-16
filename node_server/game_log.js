export class GameLog {

    constructor(db) {
        this.db = db;
        this.items = [];
        setInterval(() => {
                this.write();
            }, 
            2000
        );
    }

    append(event_name, data) {
        this.items.push({event_name, data});
    }

    async write() {
        let item = null;
        while(item = this.items.shift()) {
            await this.db.LogAppend(item.event_name, item.data);
        }
    }

}