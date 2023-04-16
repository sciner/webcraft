/**
 * For more information on easings, see:
 * https://easings.net/
 * https://cubic-bezier.com
*/

export const EasingType = new Map()

EasingType.set('linear', (percent, args) => easyLinear(percent, linear, args))
EasingType.set('step', (percent, args) => easyLinear(percent, step, args))

EasingType.set('easeInCubic', (percent, args) => easeIn(percent, cubic, args))
EasingType.set('easeOutCubic', (percent, args) => easeOut(percent, cubic, args))
EasingType.set('easeInOutCubic', (percent, args) => easeInOut(percent, cubic, args))

EasingType.set('easeInBounce', (percent, args) => easeIn(percent, bounce, args))
EasingType.set('easeOutBounce', (percent, args) => easeOut(percent, bounce, args))
EasingType.set('easeInOutBounce', (percent, args) => easeInOut(percent, bounce, args))

EasingType.set('easeInBack', (percent, args) => easeIn(percent, back, args))
EasingType.set('easeOutBack', (percent, args) => easeOut(percent, back, args))
EasingType.set('easeInOutBack', (percent, args) => easeInOut(percent, back, args))

EasingType.set('easeInSine', (percent, args) => easeIn(percent, sine, args))
EasingType.set('easeOutSine', (percent, args) => easeOut(percent, sine, args))
EasingType.set('easeInOutSine', (percent, args) => easeInOut(percent, sine, args))

EasingType.set('easeInQuad', (percent, args) => easeIn(percent, quadratic, args))
EasingType.set('easeOutQuad', (percent, args) => easeOut(percent, quadratic, args))
EasingType.set('easeInOutQuad', (percent, args) => easeInOut(percent, quadratic, args))

EasingType.set('easeInCirc', (percent, args) => easeIn(percent, circle, args))
EasingType.set('easeOutCirc', (percent, args) => easeOut(percent, circle, args))
EasingType.set('easeInOutCirc', (percent, args) => easeInOut(percent, circle, args))

EasingType.set('easeInQuart', (percent, args) => easeIn(percent, pow(4), args))
EasingType.set('easeOutQuart', (percent, args) => easeOut(percent, pow(4), args))
EasingType.set('easeInOutQuart', (percent, args) => easeInOut(percent, pow(4), args))

EasingType.set('easeInQuint', (percent, args) => easeIn(percent, pow(4), args))
EasingType.set('easeOutQuint', (percent, args) => easeOut(percent, pow(5), args))
EasingType.set('easeInOutQuint', (percent, args) => easeInOut(percent, pow(5), args))

EasingType.set('easeInExpo', (percent, args) => easeIn(percent, exp, args))
EasingType.set('easeOutExpo', (percent, args) => easeOut(percent, exp, args))
EasingType.set('easeInOutExpo', (percent, args) => easeInOut(percent, exp, args))

EasingType.set('easeInElastic', (percent, args) => easeIn(percent, elastic, args))
EasingType.set('easeOutElastic', (percent, args) => easeOut(percent, elastic, args))
EasingType.set('easeInOutElastic', (percent, args) => easeInOut(percent, elastic, args))

EasingType.set('catmullrom', (percent, args) => easeInOut(percent, catmullRom, args))

function easyLinear(percent, func, args) {
    return func(percent, ...args)
}

function easeIn(percent, func, args) {
    return func(percent, ...args)
}

function easeOut(percent, func, args) {
    return 1 - func(1 - percent, ...args)
}

function easeInOut(percent, func, args) {
    let value
    if (percent < 0.5) {
        value = func(percent * 2, ...args) / 2
    } else {
        value = 1 - func((1 - percent) * 2, ...args) / 2
    }
    return value;
}

// Math functions

/**
 * Returns an easing function running linearly. Functionally equivalent to no easing
 * @param {float} percent
 * @returns {float}
 */
function linear(percent) {
    return percent
}

/**
 * Returns a stepped value based on the nearest step to the input value
 * @param {float} percent 
 * @param {*} steps the size (grade) of the steps
 * @returns {float}
 */
function step(percent, steps) {
    steps = steps ?? 5
    return Math.round(percent * steps) / steps
}

/**
 * A bouncing function, equivalent to a bouncing ball curve
 * @param {float} percent 
 * @param {float} bounciness defines the bounciness of the output
 * @returns {float}
 */
function bounce(percent, bounciness) {
    bounciness = bounciness ?? .5
    const one = (x) => 121 / 16 * x * x;
    const two = (x) => 121 / 4 * bounciness * Math.pow(x - 6 / 11, 2) + 1 - bounciness;
    const three = (x) => 121 * bounciness * bounciness * Math.pow(x - 9 / 11, 2) + 1 - bounciness * bounciness;
    const four = (x) => 484 * bounciness * bounciness * bounciness * Math.pow(x - 10.5 / 11, 2) + 1 - bounciness * bounciness * bounciness;
    return Math.min(Math.min(one(percent), two(percent)), Math.min(three(percent), four(percent)));
}

/**
 * A negative elastic function, equivalent to inverting briefly before increasing
 * @param {float} percent 
 * @param {float} overshoot
 * @returns {float}
 */
function back(percent, overshoot) {
    overshoot = overshoot ? overshoot * 1.70158 : 1.70158
    return percent * percent * ((overshoot + 1) * percent - overshoot);
}

/**
 * A cubic function, equivalent to cube (<i>n</i>^3) of elapsed time
 * @param {float} percent
 * @returns {float}
 */
function cubic(percent) {
    return percent * percent * percent
}

/**
 * A sinusoidal function, equivalent to a sine curve output
 * @param {float} percent
 * @returns {float}
 */
function sine(percent) {
    return 1 - Math.cos(percent * Math.PI / 2)
}

/**
 * A quadratic function, equivalent to the square (<i>n</i>^2) of elapsed time
 * @param {float} percent
 * @returns {float}
 */
function quadratic(percent) {
    return percent * percent;
}

/**
 * A circular function, equivalent to a normally symmetrical curve
 * @param {float} percent
 * @returns {float}
 */
function circle(percent) {
    return 1 - Math.sqrt(1 - percent * percent)
}

/**
 * An exponential function, equivalent to an exponential curve to the {@code n} root
 * f(t) = t^n
 * @param {float} n the exponent
 * @returns {float}
 */
function pow(n) {
    return (t) => Math.pow(t, n);
}

/**
 * An exponential function, equivalent to an exponential curve
 * f(n) = 2^(10 * (n - 1))
 * @param {float} percent
 * @returns {float}
 */
function exp(percent) {
    return Math.pow(2, 10 * (percent - 1))
}

/**
 *  An elastic function, equivalent to an oscillating curve
 * @param {float} percent 
 * @param {float} bounciness defines the bounciness of the output
 * @returns {float}
 */
function elastic(percent, bounciness) {
    bounciness = bounciness ?? 1;
    return 1 - Math.pow(Math.cos(percent * Math.PI / 2), 3) * Math.cos(percent * bounciness * Math.PI)
}

/**
 * Performs a Catmull-Rom interpolation, used to get smooth interpolated motion between keyframes
 * @param {*} percent
 * @returns {float}
 */
function catmullRom(percent) {
    return (0.5 * (2.0 * (percent + 1) + ((percent + 2) - percent) * 1
        + (2.0 * percent - 5.0 * (percent + 1) + 4.0 * (percent + 2) - (percent + 3)) * 1
        + (3.0 * (percent + 1) - percent - 3.0 * (percent + 2) + (percent + 3)) * 1))
}