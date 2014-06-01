/**
 * @fileoverview fox命名空间
 */

(function( env ) {

    if (env.fox) {
        return;
    }

    var vendor = env.xtag;

    var fox = env.fox = function() {
        return fox.fn && fox.fn.apply(this, arguments);
    };

    fox.fn = function(tagName, options, parent) {
        /* extends xtag here */
        options = options || {};

        // extend from parent including prototype and constructor
        parent && fox.fn.extendTag(tagName, options, parent);


        return vendor.register(tagName, options);
    };

})(this);