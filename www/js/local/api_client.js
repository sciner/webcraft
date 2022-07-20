import { LocalServerClient } from "./client.js";

export class LocalAPIClient {

    /**
     * @param {LocalServerClient} local_server_client 
     */
    constructor(local_server_client) {
        this.local_server_client = local_server_client;
        this.requests = new Map();
    }

    async call(App, method, params, callback, callback_error, callback_progress, callback_final) {
        const session = App.getSession();
        const session_id = session?.session_id;
        const id = randomUUID();
        this.local_server_client.send(JSON.stringify({name: '_api', data: {id, session_id, method, params}}));
        const promise = new Promise((resolve, reject) => {
            this.requests.set(id, {App, resolve, reject, callback, callback_error, callback_progress, callback_final});
        });
        return promise;
    }

    //
    _onResult(packet) {
        const id = packet.id;
        const r = this.requests.get(id);
        if(!r) {
            // @todo
        }
        const {App, resolve, reject, callback, callback_error, callback_progress, callback_final} = r;
        this.requests.delete(id);
        //
        const result = packet.result;
        if (result.status == 'error') {
            if (callback_error && callback_error instanceof Function) {
                resolve(callback_error(result));
            } else {
                if (result.code == 401 || result.message == 'error_invalid_session') {
                    resolve(App.logout(result));
                } else {
                    resolve(App.showError(result.message, 4000));
                }
            }
        } else {
            if (callback && callback instanceof Function) {
                resolve(callback(result));
            }
        }
        if (callback_final && callback_final instanceof Function) {
            resolve(callback_final(result));
        }
    }

}