rivets.binders['background-image'] = function(el, value) {
	el.style["backgroundImage"] = "url(" + value + ")";
};

rivets.binders['class'] = function(el, value) {

	var elClass;
	elClass = " " + el.className + " ";
	if (!value === (elClass.indexOf(" " + value + " ") !== -1)) {
		return el.className = value ? "" + el.className + " " + value : elClass.replace(" " + value + " ", ' ').trim();
	}
}; 