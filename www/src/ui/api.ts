export class API_Client {
    [key: string]: any;

    constructor(api_url) {
        this.api_url = api_url || '';
    }

    // Организует вызов API, обработку ответа и вызов callback-функции
    async call(App, url, data, callback, callback_error, callback_progress, callback_final) {
        let session         = App?.getSession();
        let sessionID       = session ? session.session_id : null;
        url                 = this.api_url + url;
        callback_error      = callback_error || null;
        callback_progress   = callback_progress || null;
        callback_final      = callback_final || null;
        // var deferred        = $q.defer();
        var headers = {
            'X-Language-Locale': 'ru',
            'Content-Type': 'application/json'
        };
        if(sessionID) {
            headers['X-Session-ID'] = sessionID;
        }
        var options = {
            method:                 'POST',
            headers:                headers,
            body:                   data instanceof FormData ? data : JSON.stringify(data),
            uploadEventHandlers:    {}
        };
        if(callback_progress instanceof Function) {
            options.uploadEventHandlers.progress = callback_progress;
        }
        if(data instanceof FormData) {
            delete(options.headers['Content-Type']);
        }
        // Response
        const response = await fetch(url, options)
            .then((res) => res.json())
            .then(result => {
                if (result.error) {
                    result = result.error;
                    result.status = 'error';
                }
                if (result.status == 'error') {
                    if (callback_error && callback_error instanceof Function) {
                        callback_error(result);
                    } else {
                        if (result.code == 401 || result.message == 'error_invalid_session') {
                            App.logout(result);
                        } else {
                            App.showError(result.message, 4000);
                        }
                    }
                } else {
                    if (callback && callback instanceof Function) {
                        callback(result);
                    }
                }
                if (callback_final && callback_final instanceof Function) {
                    callback_final(result);
                }
            })
        .catch(error => {
            console.log(error);
            if (error.response) {
                //get HTTP error code
                console.log(error.reponse.status)
            } else {
                console.log(error.message)
            }
        })
    }

}