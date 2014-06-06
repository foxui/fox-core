/**
 * @fileoverview fox命名空间
 */

(function(env) {

	if (env.fox) {
		return;
	}

	var vendor = env.xtag;

	var fox = env.fox = function() {
		return fox.fn && fox.fn.apply(this, arguments);
	};

	fox.fn = function(tagName, options, parent) {
		return fox.fn.register(tagName, options);
	};

})(this);
