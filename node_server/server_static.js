import express from "express"; 

export class ServerStatic {

    static init(app) {
        // Serves resources from public folder
        app.use(express.static('../www/'));
    }

}