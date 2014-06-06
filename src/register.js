(function(env) {

	var undefined;

	var fox = env.fox;

	function getTplAndAttribute(el) {

		var tpl = el.querySelector('fox-template');
		var meta = {
			tmpl: null,
			attributes: [],
			extends: null
		};

		if (tpl) {
			meta['tmpl'] = tpl;
		}

		meta['extends'] =  el.getAttribute('extends');

		var attributes = el.getAttribute('attributes');
		meta['attributes'] = attributes && attributes.split(' ') || [];

		return meta;
	}

    // TODO: 目前只解析以 <link rel="import"/> 方式载入的标签定义，需要增加对于 inline 以及 innerHTML 的解析
	function getOwnTplAndAttribute(elementName) {
		var links = document.querySelectorAll('link[rel="import"]');
		var foxuiEl;

		for (var i = 0; i < links.length; i++) {
			var link = links[i];
			var foxui = link.import.querySelector(
                'fox-element[name="' + elementName + '"]');

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
        else {
            throw new Error( elementName + ' already defined.' );
        }

	}

	function _register(elementName, option) {


		var own = getOwnTplAndAttribute(elementName);

        option = option || {
            lifecycle: {}
        };

		own['extends'] &&  fox.fn.extendTag(elementName, option, own['extends']);

		option.accessors = option.accessors || {};


		own['attributes'] && own['attributes'].forEach(function(v) {
			option.accessors[v] = {
				attribute : true
			}
		});

        var originCreated = option.lifecycle.created;

        option.lifecycle.created = function() {
            var self = this;

            if(own['tmpl']){
                $('content', own['tmpl']).replaceWith($(this).children().clone(true));
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


            originCreated && originCreated.apply(this, arguments);

        }

		xtag.register(elementName, option);
	}


	fox.fn.register = register;
})(this);
