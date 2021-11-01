import {API_Client} from './api.js';
import {} from './clipboard.js';

export class UIApp {

    constructor() {
        this.api = new API_Client();
        // Session
        let session_id = localStorage.getItem('session_id');
        if(session_id) {
            this.session = {
                session_id: session_id,
                username: localStorage.getItem('username')
            };
        } else {
            this.session = null;
        }
        // Hooks
        this.onLogin = (e) => {};
        this.onLogout = (e) => {};
        this.onError = (e) => {};

    }

    logout() {
        this.session.username = null;
        this.session.session_id = null;
        localStorage.removeItem('username');
        localStorage.removeItem('session_id');
        this.onLogout();
    }

    showError(message) {
        this.onError(message);
    }

    isLogged() {
        return !!this.getSession();
    }

    // MyWorlds...
    async MyWorlds(form, callback, callback_error, callback_progress, callback_final) {
        let result = [];
        await this.api.call(this, '/api/Game/MyWorlds', form, (resp) => {
            result = resp;
            if(callback) {
                callback(result);
            }
        }, callback_error, callback_progress, callback_final);
        return result;
    }

    // CreateWorld...
    async CreateWorld(form, callback, callback_error, callback_progress, callback_final) {
        let result = null;
        await this.api.call(this, '/api/Game/CreateWorld', form, (resp) => {
            result = resp;
            if(callback) {
                callback(result);
            }
        }, callback_error, callback_progress, callback_final);
        return result;
    }

    //
    getSession() {
        return this.session;
    }

}