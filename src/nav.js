/**
 * 单页导航和多页导航处理
 * TODO:
 * 1. 当页面导航到N页并直接刷新会导致前进、后退的判断失效
 * 因为浏览器的 state 记录和 stacks 的已经不同步的
 * 可能的解决方案是借助 sessionStorage 进行 stacks 的备份和恢复
 *
 * 2. 在 ios7 safari 中，可以通过swipe来前进后退，触发 popstate，但是会出现页面抖动。
 * 这个和 popstate 中的动画处理有关，目前未找到解决方案，原因是无法识别是点击按钮还是手势进行导航。
 * 可能的解决方案是记录用户最近touchmove结束时间，并在popstate时进行判断，如果识别为 swipe 则停止动画
 */
(function(env){
    var fox = env.fox;
    var $ = env.$;
    var stacks = [];
    var backward = false;
    var mainPage = '.main-page';
    var indexTitle = document.title;

    // 处理问题2
    var lastTouchMoveTime;
    // 阈值太大会有副作用（例如上下滑动后点击链接会导致无动画效果），酌情调整
    // 阈值太小会导致失效
    var swipeDetectThreashold = 400;

    function delegate() {
        var targets = 'a[href]';
        var me = this;

        $(document).on('click', targets, function(e){

            if (this.hasAttribute('no-nav')) {
                return;
            }

            e.preventDefault();

            var href = this.getAttribute('href');
            var title = this.getAttribute('title');
            var transition = this.getAttribute('transition');

            if (href) {
                me.navigate(href, title, transition);
            }
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

        // 处理问题2
        // var animation = true;
        var animation = nav.animation &&
            (!lastTouchMoveTime ||((Date.now() - lastTouchMoveTime) > swipeDetectThreashold)) ? true : false;

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

            document.title = indexTitle;
        }
        else {
            backward = false;
            outData = stacks[stacks.length-1];
            outPage = (outData && outData.page) || $(mainPage)[0];
            inPage = preparePageDom(state.href, state.transition, state.title);

            stacks.push({href: state.href, page: inPage});

            state.title && (document.title = state.title);
        }


        if (outPage) {

            // clear out page after transtion end
            // fade is the default tranistion
            // if (outPage.transition) {

                // only remove the out page in backward direction
                if (backward) {
                    function transitionEnd(){
                        outPage.removeEventListener('transitionend', transitionEnd, false);
                        clearPage(outPage);
                    }
                    outPage.addEventListener('transitionend', transitionEnd, false);
                }

                outPage.hide(animation, backward);
            // }
            // else if(backward){
                // clearPage(outPage);
            // }
        }

        if (inPage) {
            inPage.show(animation, backward);
        }
    }

    function preparePageDom(href, transition, title) {
        var page;

        transition = transition || nav.defaultTransition;

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
            page.innerHTML =
                '<fox-toolbar title="' + title || '' + '">' +
                    '<fox-icon icon="icon-left-nav" class="left" onclick="history.back();">' +
                    '</fox-icon>' +
                    '<fox-icon icon="icon-spin5" class="right animate-spin">' +
                    '</fox-icon>' +
                '</fox-toolbar>' +
                '<fox-page-content></fox-page-content>';
            document.body.appendChild(page);

            new Linker(href, page);
        }

        // set default transition
        // The order is : page's transition > link's transition > default transition
        if (transition && !page.transition) {
            page.transition = transition;
        }

        return page;
    }

    // Nav core code
    // TODO: addd global default transition and transition switch config
    //===========================
    var nav = fox.navigator = {
        // global config - use animation
        animation: true,

        // global config - default transition effect
        defaultTransition: 'hslide',

        start: function() {

            if (this.started) {
                return;
            }

            this.started = true;

            window.addEventListener('popstate', function() {
                onPopState();
            }, false);

            delegate.apply(this);

            // init state only at hash mode
            if (location.hash) {
                var state = history.state;

                if (state) {
                    var inPage = preparePageDom(state.href, state.transition, state.title);
                    var outPage = $(mainPage)[0];

                    stacks.push({href: state.href, page: inPage});
                    outPage && outPage.hide();
                    inPage && inPage.show();
                    state.title && (document.title = state.title);
                }
            }
        },

        navigate: function(href, title, transition) {
            var inPage = preparePageDom(href, transition, title);
            var outPage;

            // query current page
            if (!stacks.length) {
                // index page
                outPage = $(mainPage)[0];
            }
            else {
                outPage = stacks[stacks.length-1].page;
            }

            outPage && outPage.hide(nav.animation);

            // push next state
            stacks.push({href: href, page: inPage});

            inPage && inPage.show(nav.animation);

            history.pushState({href:href, transition: transition, title: title}, title, href);

            title && (document.title = title);

            // onPopState();
        }
    };

    // To load, parse and insert the linking page
    // =========================================

    function Linker(href, placeholder, timeout) {

        if (!href || !placeholder) {
            return;
        }

        this.placeholder = placeholder;
        this.timeout = timeout;

        this.request(href);
    }

    Linker.prototype = (function(){

        return {

            resetXHR: function(href) {

                var xhr = this.xhr;

                if (xhr && xhr.readyState < 4) {
                  xhr.onreadystatechange = function(){};
                  xhr.abort();
                }
                else {
                    xhr = this.xhr = new XMLHttpRequest();
                    xhr.open('GET', href, true);
                    xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
                }
            },

            request: function(href) {
                this.resetXHR(href);

                var xhr = this.xhr;
                var me = this;

                xhr.onreadystatechange = function () {

                    if (me._timeout) {
                        clearTimeout(me._timeout);
                    }

                    if (xhr.readyState === 4) {
                        xhr.status === 200 ? me.success() : me.failure();
                    }
                };

                if (this.timeout) {
                    this._timeout = setTimeout(function() {
                        xhr.abort('timeout');
                    }, this.timeout);
                }

                xhr.send();
            },

            success: function() {
                // parse response
                var head;
                var body;
                var title;
                var page;
                var responseText = this.xhr.responseText;

                if (!responseText) {
                    return
                }

                // Complete page
                if (/<html/i.test(responseText)) {
                    head = document.createElement('div');
                    body = document.createElement('div');
                    head.innerHTML = responseText.match(/<head[^>]*>([\s\S.]*)<\/head>/i)[0];
                    body.innerHTML = responseText.match(/<body[^>]*>([\s\S.]*)<\/body>/i)[0];

                // Page fragment
                } else {
                    head = body = document.createElement('div');
                    head.innerHTML = responseText;
                }

                // parse and set title
                title = head.querySelector('title');
                var text = 'innerText' in title ? 'innerText' : 'textContent';
                title = title && title[text].trim();

                title && (document.title = title);

                // replace placeholder
                page = body.querySelector('fox-page');

                page &&
                this.placeholder.parentNode &&
                (this.placeholder.innerHTML = page.innerHTML);
            },

            failure: function() {
                // TODO
            }
        };
    })();


    document.addEventListener('HTMLImportsLoaded', function(){
        nav.start();

        // 处理问题2
        // TODO: 目前只监听 touchmove，可以精确到 swipe 手势并且从边框开始滑动
        document.addEventListener('touchmove', function(){
            lastTouchMoveTime = Date.now();
        }, false);
    }, false);
})(this);
