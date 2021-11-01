import {API_Client} from './api.js';
import {} from './clipboard.js';

export class UIApp {

    constructor() {
        this.api = new API_Client();
        // Session
        this._loadSession();
        // Hooks
        this.onLogin = (e) => {};
        this.onLogout = (e) => {};
        this.onError = (e) => {};
    }

    _loadSession() {
        // Session
        let session = localStorage.getItem('session');
        if(session) {
            this.session = JSON.parse(session);
        } else {
            this.session = null;
        }
    }

    logout() {
        this.session = null;
        localStorage.removeItem('session');
        this.onLogout();
    }

    showError(message) {
        this.onError(message);
    }

    isLogged() {
        return !!this.getSession();
    }

    // Login...
    async Login(form, callback, callback_error, callback_progress, callback_final) {
        let that = this;
        let result = [];
        await this.api.call(this, '/api/User/Login', form, (resp) => {
            result = resp;
            localStorage.setItem('session', JSON.stringify(result));
            that._loadSession();
            if(callback) {
                callback(result);
            }
        }, callback_error, callback_progress, callback_final);
        return result;
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