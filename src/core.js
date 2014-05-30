/**
 * @fileoverview fox命名空间以及帮助方法
 */

(function( env ) {

    var undefined;

    if (env.fox) {
        return;
    }

    var vendor = env.xtag;

    var fox = env.fox = function() {
        return fox.fn && fox.fn.apply(this, arguments);
    };

    fox.debug = true;

    fox.log = function(msg, type) {
        if (!fox.debug) {
            return;
        }

        console.log(msg);
    };

    fox.mixin = function(target, source) {
        for (var key in source) {

            if (source[key] !== undefined) {
                target[key] = source[key];
            }

        }
    };


    fox.find = function(selector, context) {
        return (context || document).querySelectorAll(selector);
    }

    fox.bind = function(fn, context) {

        if (typeof fn.bind === 'function') {
            return fn.bind(context);
        }

        return function() {
            return fn.apply(context, arguments);
        };
    }

    fox.addEvent = function(el, event, callback) {
        return el.addEventListener(event, callback, false);
    }

    fox.toArray = function(arrayLikeObject) {
        return Array.prototype.slice.call(arrayLikeObject);
    }

    fox.fn = function() {
        // extends xtag here

        return vendor.register.apply( vendor, arguments );
    };

})(this);
