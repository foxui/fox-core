(function( env ) {

    var undefined;

    var fox = env.fox;
    var vendor = env.xtag;

    fox.mixin = function(target, source) {
        for (var key in source) {

            if (source[key] !== undefined) {
                target[key] = source[key];
            }

        }
    };


    fox.query = function(el, selector) {
        return vendor.query(el, selector);
    }

    fox.queryChildren = function(el, selector) {
        return vendor.queryChildren(el, selector);
    }

    fox.bind = function(fn, context) {

        if (typeof fn.bind === 'function') {
            return fn.bind(context);
        }

        return function() {
            return fn.apply(context, arguments);
        };
    }

    fox.fireEvent = function(el, type, data) {
        return vendor.fireEvent(el, type, data);
    }

    fox.addEvent = function(el, event, callback) {
        return vendor.addEvent(el, event, callback);
    }

    fox.addEvents = function(el, events) {
        return vendor.addEvents(el, events);
    }

    fox.toArray = function(arrayLikeObject) {
        return Array.prototype.slice.call(arrayLikeObject);
    }

})(this);
