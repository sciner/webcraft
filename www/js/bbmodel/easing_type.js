/**
 * For more information on easings, see:
 * https://easings.net/
 * https://cubic-bezier.com
*/

export const EasingType = new Map()

EasingType.set('linear', (result, a, b, percent, args) => easyLinear(result, a, b, percent, linear, args))
EasingType.set('step', (result, a, b, percent, args) => easyLinear(result, a, b, percent, step, args))

EasingType.set('easeInCubic', (result, a, b, percent, args) => easeIn(result, a, b, percent, cubic, args))
EasingType.set('easeOutCubic', (result, a, b, percent, args) => easeOut(result, a, b, percent, cubic, args))
EasingType.set('easeInOutCubic', (result, a, b, percent, args) => easeInOut(result, a, b, percent, cubic, args))

EasingType.set('easeInBounce', (result, a, b, percent, args) => easeIn(result, a, b, percent, bounce, args))
EasingType.set('easeOutBounce', (result, a, b, percent, args) => easeOut(result, a, b, percent, bounce, args))
EasingType.set('easeInOutBounce', (result, a, b, percent, args) => easeInOut(result, a, b, percent, bounce, args))

EasingType.set('easeInBack', (result, a, b, percent, args) => easeIn(result, a, b, percent, back, args))
EasingType.set('easeOutBack', (result, a, b, percent, args) => easeOut(result, a, b, percent, back, args))
EasingType.set('easeInOutBack', (result, a, b, percent, args) => easeInOut(result, a, b, percent, back, args))

EasingType.set('easeInSine', (result, a, b, percent, args) => easeIn(result, a, b, percent, sine, args))
EasingType.set('easeOutSine', (result, a, b, percent, args) => easeOut(result, a, b, percent, sine, args))
EasingType.set('easeInOutSine', (result, a, b, percent, args) => easeInOut(result, a, b, percent, sine, args))

EasingType.set('easeInQuad', (result, a, b, percent, args) => easeIn(result, a, b, percent, quadratic, args))
EasingType.set('easeOutQuad', (result, a, b, percent, args) => easeOut(result, a, b, percent, quadratic, args))
EasingType.set('easeInOutQuad', (result, a, b, percent, args) => easeInOut(result, a, b, percent, quadratic, args))

EasingType.set('easeInCirc', (result, a, b, percent, args) => easeIn(result, a, b, percent, circle, args))
EasingType.set('easeOutCirc', (result, a, b, percent, args) => easeOut(result, a, b, percent, circle, args))
EasingType.set('easeInOutCirc', (result, a, b, percent, args) => easeInOut(result, a, b, percent, circle, args))

EasingType.set('easeInQuart', (result, a, b, percent, args) => easeIn(result, a, b, percent, pow(4), args))
EasingType.set('easeOutQuart', (result, a, b, percent, args) => easeOut(result, a, b, percent, pow(4), args))
EasingType.set('easeInOutQuart', (result, a, b, percent, args) => easeInOut(result, a, b, percent, pow(4), args))

EasingType.set('easeInQuint', (result, a, b, percent, args) => easeIn(result, a, b, percent, pow(4), args))
EasingType.set('easeOutQuint', (result, a, b, percent, args) => easeOut(result, a, b, percent, pow(5), args))
EasingType.set('easeInOutQuint', (result, a, b, percent, args) => easeInOut(result, a, b, percent, pow(5), args))

EasingType.set('easeInExpo', (result, a, b, percent, args) => easeIn(result, a, b, percent, exp, args))
EasingType.set('easeOutExpo', (result, a, b, percent, args) => easeOut(result, a, b, percent, exp, args))
EasingType.set('easeInOutExpo', (result, a, b, percent, args) => easeInOut(result, a, b, percent, exp, args))

EasingType.set('easeInElastic', (result, a, b, percent, args) => easeIn(result, a, b, percent, elastic, args))
EasingType.set('easeOutElastic', (result, a, b, percent, args) => easeOut(result, a, b, percent, elastic, args))
EasingType.set('easeInOutElastic', (result, a, b, percent, args) => easeInOut(result, a, b, percent, elastic, args))

EasingType.set('catmullRom', (result, a, b, percent, args) => easeInOut(result, a, b, percent, catmullRom, args))

function easyLinear(result, a, b, percent, func, args) {
    const value = func(percent, ...args)
    result.lerpFrom(a, b, value);
}

function easeIn(result, a, b, percent, func, args) {
    const value = func(percent, ...args)
    result.lerpFrom(a, b, value);
}

function easeOut(result, a, b, percent, func, args) {
    const value = 1 - func(1 - percent, ...args)
    result.lerpFrom(a, b, value);
}

function easeInOut(result, a, b, percent, func, args) {
    let value
    if (percent < 0.5) {
        value = func(percent * 2, ...args) / 2
    } else {
        value = 1 - func((1 - percent) * 2, ...args) / 2
    }
    result.lerpFrom(a, b, value);
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