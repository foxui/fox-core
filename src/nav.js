/**
 * 单页导航和多页导航处理
 */
(function(env){
    var fox = env.fox;
    var $ = env.$;
    var stateSupport = 'pushState' in history;
    var stacks = [];
    var stacksMap = {};
    var backward = false;
    var mainPage = '.main-page';

    function delegate() {
        var targets = 'a[href]';
        var me = this;

        $(targets).forEach(function(target){
            $(target).click(function(e) {
                e.preventDefault();

                var href = this.getAttribute('href');
                var title = this.getAttribute('title');
                var transition = this.getAttribute('transition');

                if (href) {
                    me.navigate(href, title, transition);
                }
            });
        });
    }

    function clearPage(page) {
        if (page) {
            !page._anchor_ && page.remove();
        }
    }

    function onPopState() {
        // current state already turns to new page
        // stacks still stay in last status
        var state = history.state;
        var outData;
        var inPage;
        var outPage;

        var previousData = stacks[stacks.length -2];

        // back to index page or previous page
        if (!state || (previousData && (previousData.href === state.href))) {
            backward = true;
            outData = stacks.pop();

            // swtich
            outPage = outData ? outData.page : null;

            // index page
            if (!state) {
                inPage = $(mainPage)[0];
            }
            else {
                inPage = previousData.page;
            }

        }
        else {
            backward = false;
            outData = stacks[stacks.length-1];
            outPage = (outData && outData.page) || $(mainPage)[0];
            inPage = preparePageDom(state.href, state.transition);

            stacks.push({href: state.href, page: inPage});
        }


        if (outPage) {

            // clear out page after transtion end
            if (outPage.transition) {

                // only remove the out page in backward direction
                if (backward) {
                    function transitionEnd(){
                        outPage.removeEventListener('transitionend', transitionEnd, false);
                        clearPage(outPage);
                    }
                    outPage.addEventListener('transitionend', transitionEnd, false);
                }

                outPage.hide(true, backward);
            }
            else if(backward){
                clearPage(outPage);
            }
        }

        if (inPage) {
            inPage.show(true, backward);
        }
    }

    function preparePageDom(href, transition) {
        var page;

        // anchor
        if (href.indexOf('#') === 0) {

            // take href as page's id
            page = $(href)[0];

            if (!page) {
                return;
            }

            page._anchor_ = true;
        }
        // create new page
        else {
            page = document.createElement('fox-page');
            page.class = 'transition-out';
            document.body.appendChild(page);
        }

        transition && (page.transition = transition);

        return page;
    }

    var nav = fox.navigator = {
        start: function() {

            if (this.started) {
                return;
            }

            this.started = true;

            window.addEventListener('popstate', function() {
                onPopState();
            }, false);

            delegate.apply(this);

        },

        navigate: function(href, title, transition) {
            var inPage = preparePageDom(href, transition);
            var outPage;

            // query current page
            if (!history.state) {
                // index page
                outPage = $(mainPage)[0];
            }
            else {
                outPage = stacks[stacks.length-1].page;
            }

            outPage && outPage.hide();

            // push next state
            stacks.push({href: href, page: inPage});

            inPage && inPage.show();

            history.pushState({href:href, transition: transition}, title, href);

            // onPopState();
        }
    };

    document.addEventListener('HTMLImportsLoaded', function(){
        nav.start();
    }, false);
})(this);
