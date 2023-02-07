/**
 * Define a constructor with a null prototype,
 * instantiating this is much faster than explicitly
 * calling `Object.create(null)` to get a "bare"
 * empty object
 */
function EmptyObject() {
}

EmptyObject.prototype = Object.create(null)

EmptyObject.prototype.get = function(key) {
    return this[key]
}

EmptyObject.prototype.set = function(key, value) {
    this[key] = value
}

EmptyObject.prototype.has = function(key) {
    return key in this
}

EmptyObject.prototype.delete = function(key) {
    delete(this[key])
}

EmptyObject.prototype[Symbol.iterator] = function* () {
    for (const [k, v] of Object.entries(this)) {
        yield [k, v]
    }
}

/**
 * Create an accelerated hash map
 *
 * @param {...Object} props (optional)
 * @return {Object}
 * @api public
 */
export function fastmap() {

    var map = new EmptyObject();

    for (var _len = arguments.length, props = new Array(_len), _key = 0; _key < _len; _key++) {
        props[_key] = arguments[_key];
    }

    if (props.length) {
        Object.assign.apply(Object, [map].concat(props));
    }

    return map;

}