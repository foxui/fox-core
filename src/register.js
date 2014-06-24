(function(env) {

	var undefined;

	var fox = env.fox;

	function getTplAndAttribute(el) {
		
		var tpl = el.querySelector('tpl');
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
	
	function getImportLinks(doc,arr){
	 	var links = doc.querySelectorAll('link[rel="import"]');
	 	for(var i = 0;i<links.length;i++){
	 		var link = links[i];
	 		arr.push(link);
	 		getImportLinks(link.import,arr);
	 	}
	}

    // TODO: 目前只解析以 <link rel="import"/> 方式载入的标签定义，需要增加对于 inline 以及 innerHTML 的解析
	function getOwnTplAndAttribute(elementName) {
		var links = [];
		getImportLinks(document,links);
		// var links = document.querySelectorAll('link[rel="import"]');
		
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
		window.addEventListener('HTMLImportsLoaded', function(e) {
			if (registerArr.indexOf(elementName) == -1) {
				_register(elementName, option);
				registerArr.push(elementName);
			}
	        else {
	            throw new Error( elementName + ' already defined.' );
	        }
		},true);


	}

	function _register(elementName, option) {

		var own = getOwnTplAndAttribute(elementName);

        option = option || {};

        if (!option.lifecycle) {
            option.lifecycle = {};
        }

        // 扩展数据源支持
        fox.fn.datasource(option);

		own['extends'] &&  fox.fn.extendTag(elementName, option, own['extends']);

		option.accessors = option.accessors || {};


		own['attributes'] && own['attributes'].forEach(function(v) {
			option.accessors[v] = {
				attribute : true
			}
		});

        var originCreated = option.lifecycle.created;

        var originAttrChange = option.lifecycle.attributeChanged;
		
        option.lifecycle.created = function() {
            var self = this;

            if(own['tmpl']){
            	
            	var $tmpl = $(own['tmpl']).clone(true);
           
           		$tmpl['rivets'] = rivets.bind($tmpl.get(0), this);
           
            	var $data =  $(this).children('fox-json,fox-ajax').detach();
            	
            	var $children = $(this).children();
            	
                $('content', $tmpl).replaceWith($children);
                
                
                
                $(this).empty();
                
				$('fox-tmpl',$tmpl).each(function(){
					rivets.bind(this, this);
				});
				
                var _$ = {};

                $('[id]', $tmpl).each(function() {
                    _$[$(this).attr('id')] = this;
                });
                this.$ = _$;
                
                $(this).append($data);
                
                $(this).append($tmpl.children());
            }
            
            
 			

            originCreated && originCreated.apply(this, arguments);
        };

        option.lifecycle.attributeChanged = function(attr, oldVal, newVal) {
        	var attrChangeFn = option.lifecycle[attr+'Changed'];
        	attrChangeFn&&attrChangeFn.call(this,oldVal, newVal);
        	originAttrChange && originAttrChange.apply(this, arguments);
        }

		xtag.register(elementName, option);
	}


	fox.fn.register = register;
})(this);
