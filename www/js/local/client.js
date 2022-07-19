export class LocalServerClient {

    constructor(connection_string) {

        this.onopen = (event) => {};
        this.onmessage = (event) => {};
        this.onclose = (event) => {};
        
        //
        this.worker = new Worker('./js-gen/local_server.js', {type: 'module'});

        //
        this.worker.onmessage = (event) => {
            if(event.data === 'connected') {
                this.onopen({});
                this.send(JSON.stringify({name: '_connect', data: connection_string}));
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

    // close server sonnection
    close(code) {
        this.worker.terminate();
        this.onclose({code});
    }

    // send message to server
    send(json) {
        this.worker.postMessage(json);
    }

}