/**
 * World weather
 */
export class Weather {

    constructor(name, message) {
        this.name = name;
        this.message = message;
    }

    /**
     * Name of weather
     * @type string
     */
    name;

    /**
     * This message show when player set weather by chat command
     * @type string
     */
     message;

}