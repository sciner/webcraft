
//
export class FileCacheStorage {

    constructor(name) {
        this.name = name
    }

    async open() {
        if(this.instance) {
            return this
        }
        this.instance = await caches.open(this.name)
        return this
    }

    /**
     * Return data from the cache or false
     * @param {string} url 
     * @returns {?object}
     */
    async get(url) {
        const cachedResponse = await this.instance.match(url)
        if (!cachedResponse || !cachedResponse.ok) {
            return null
        }
        return cachedResponse
    }

    async put(url, value) {
        return this.instance.put(url, new Response(value))
    }

}