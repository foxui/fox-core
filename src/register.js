(function(env) {

	var undefined;

	var fox = env.fox;

	function getTplAndAttribute(el) {
		var elTmpl = el.querySelector('fox-template');
		var obj = {
			tmpl : null,
			attributes : [],
			extends:null
		};
		if (elTmpl) {
			obj['tmpl'] = elTmpl;
		}

		obj['extends'] =  el.getAttribute('extends')?el.getAttribute('extends'):null;

		var attributes = el.getAttribute('attributes');
		obj['attributes'] = attributes && attributes.split(' ') || [];
		return obj;
	}

    // TODO: 目前只解析以 <link rel="import"/> 方式载入的标签定义，需要增加对于 inline 以及 innerHTML 的解析
	function getOwnTplAndAttribute(elementName) {
		var links = document.querySelectorAll('link[rel="import"]');
		var foxuiEl;

		for (var i = 0; i < links.length; i++) {
			var link = links[i];
			var foxui = link.import.querySelector('foxui-element[name="' + elementName + '"]');
			if (foxui) {
				foxuiEl = foxui;
				break;
			}
		}
		var result = {};
		if (foxuiEl) {
			result = getTplAndAttribute(foxuiEl);

		}

		return result;

	}

	var registerArr = [];

	function register(elementName, option) {

		if (registerArr.indexOf(elementName) == -1) {
			_register(elementName, option);
			registerArr.push(elementName);
		}

	}

	function _register(elementName, option) {


		var own = getOwnTplAndAttribute(elementName);

		own['extends'] &&  fox.fn.extendTag(elementName, option, own['extends']);

		$.extend({
			lifecycle : {
				created : function() {

				},
				inserted : function() {
				},
				removed : function() {
				},
				attributeChanged : function() {

				}
			},
			events : {},
			extends : 'div',
			accessors : {},
			methods : {}
		}, option);

		option.accessors = option.accessors || {};


		own['attributes'].forEach(function(v) {
			option.accessors[v] = {
				attribute : true
			}
		});

		xtag.register(elementName, {

			extends : option.extends,
			lifecycle : {
				created : function() {
					var self = this;

					own['attributes'].forEach(function(v) {
						var value = self.getAttribute(v);
						if (value) {
							if (value == 'false') {
								value = false;
							} else if (value == 'true') {
								value = true;
							}
							self[v] = value;
						}
					});
					if(own['tmpl']){
						$("content", own['tmpl']).replaceWith($(this).children().clone(true));
						$(this).empty();
						var clone = document.importNode(own['tmpl'], true);

						this['rivets'] = rivets.bind(clone, this);
						var _$ = {};
						$('[id]', clone).each(function() {
							_$[$(this).attr('id')] = this;
						});
						this.$ = _$;
						$(this).append(clone);
					}


					option.lifecycle.created && option.lifecycle.created.apply(this, arguments);

				},
				inserted : function() {
					option.lifecycle.inserted && option.lifecycle.inserted.apply(this, arguments);
				},
				removed : function() {
					option.lifecycle.removed && option.lifecycle.removed.apply(this, arguments);
				},
				attributeChanged : function() {

					option.lifecycle.attributeChanged && option.lifecycle.attributeChanged.apply(this, arguments);
				}
			},
			events : option.events,
			accessors : option.accessors,
			methods : option.methods
		});
	}


	fox.fn.register = register;
})(this);
