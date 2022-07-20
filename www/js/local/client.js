import { LocalAPIClient } from "./api_client.js";

export class LocalServerClient {

    constructor() {

        this.onopen = (event) => {};
        this.onmessage = (event) => {};
        this.onclose = (event) => {};
        
        //
        this.worker = new Worker('./js-gen/local_server.js', {type: 'module'});

        //
        this.worker.onmessage = (event) => {
            if(event.data === 'connected') {
                this.onopen({});
            } else if(event.data?.name == '_api_result') {
                this.getAPIClient()._onResult(event.data.data);
            } else {
                this.onmessage(event);
            }
        };

        //
        this.worker.onerror = function(error) {
            console.log('Worker error: ' + error.message + '\n');
            console.error(error);
        };

    }

    connect(connection_string) {
        this.send(JSON.stringify({name: '_connect', data: connection_string}));
        return this;
    }

    // close server sonnection
    close(code) {
        this.worker.terminate();
        this.onclose({code});
    }

    // send message to server
    send(json) {
        this.worker.postMessage(json);
    }

    // Return local API client
    getAPIClient() {
        return this._api_client || (this._api_client = new LocalAPIClient(this));
    }

}