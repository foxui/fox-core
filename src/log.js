(function( env ) {

    var fox = env.fox;

    fox.debug = true;

    fox.log = function(msg, type) {
        if (!fox.debug || !('console' in env)) {
            return;
        }

        console.log(msg);
    };

})(this);
