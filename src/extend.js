(function( env ) {

    var undefined;

    var fox = env.fox;

    fox.fn.extendTag = function (tagName, options, parent) {
        var originCreated;
        var lifecycle = options.lifecycle || (options.lifecycle = {});
        var parentInst = document.createElement(parent);
        var proto = parentInst.__proto__ || Object.getPrototypeOf(parentInst);

        // change prototype
        options.prototype = proto;

        if (lifecycle.created) {
            originCreated = lifecycle.created;
        }

        options.lifecycle.created = function() {
            //take parent's created callback as constructor
            proto.createdCallback.apply(this, arguments);

            // $super
            this.$super = proto;

            originCreated && originCreated.apply(this, arguments);
        }
    };

})(this);
