rivets.binders['background-image'] = function(el, value) {
	el.style["backgroundImage"] = "url(" + value + ")";
};

rivets.binders['class'] = function(el, value) {
	
	if(el._rivetCls){
		$(el).removeClass(el._rivetCls);
	}
	$(el).addClass(value);
	
	el._rivetCls = value;
	
}; 