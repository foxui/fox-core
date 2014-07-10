/**
 * 单页导航和多页导航处理
 *
 * A 标签上的属性：
 *
 * disable-pjax：如果有该属性表示禁止使用 ajax 导航功能；
 * transition: 页面切换效果
 * title: 页面标题
 * fox-push-mode:
 *     stack: always push new page
 *     single: reuse existed page with the same href
 *
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
    var pageIDMap = {};
    var id = 0;
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

            if (this.hasAttribute('disable-pjax')) {
                return;
            }

            e.preventDefault();

            var href = this.getAttribute('href');
            var title = this.getAttribute('title');
            var transition = this.getAttribute('transition');
            var pushMode = this.getAttribute('fox-push-mode');

            if (href) {
                me.navigate(href, title, transition, pushMode);
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
            inPage = preparePageDom(state.href, state.transition, state.title, state.pushMode);

            stacks.push({href: state.href, page: inPage});

            state.title && (document.title = state.title);
        }


        if (outPage) {

            // only remove the out page in backward direction
            if (backward && !animation) {
                clearPage(outPage);
            }
            else {
                // backward and animate
                if (backward) {
                    function transitionEnd(){
                        outPage.removeEventListener('transitionend', transitionEnd, false);
                        clearPage(outPage);
                    }
                    outPage.addEventListener('transitionend', transitionEnd, false);
                }

                outPage.hide(animation, backward);
            }
        }

        if (inPage) {
            inPage.show(animation, backward);
        }
    }

    function preparePageDom(href, transition, title, pushMode) {
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
        // reuse page or create new page
        else {

            if (pushMode === 'single') {
                var pageId = pageIDMap[href];
                page = fox.query(document, 'fox-page[fox-page-id="' + pageId + '"]')[0];
            }

            if (!page) {
                page = document.createElement('fox-page');
                page.class = 'transition-out';

                pageIDMap[href] = (++id);
                page.setAttribute('fox-page-id', id);

                page.innerHTML =
                    '<fox-toolbar title="' + (title || '') + '">' +
                        // '<fox-icon icon="icon-left-nav" class="left" onclick="history.back();">' +
                        // '</fox-icon>' +
                        '<fox-icon icon="icon-spin5" class="right animate-spin">' +
                        '</fox-icon>' +
                    '</fox-toolbar>' +
                    '<fox-page-content></fox-page-content>';
                document.body.appendChild(page);

                new Linker(href, page);
            }

        }

        // set default transition
        // The order is : page's transition > link's transition > default transition
        if (transition && !page.transition) {
            page.transition = transition;
        }

        return page;
    }

    // Nav core code
    //===========================
    var nav = fox.navigator = {
        // disable navigator
        disabled: false,

        // global config - use animation
        animation: true,

        // global config - default transition effect
        defaultTransition: 'display',

        start: function() {

            if (this.disabled || this.started) {
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
                    var inPage = preparePageDom(state.href, state.transition, state.title, state.pushMode);
                    var outPage = $(mainPage)[0];

                    stacks.push({href: state.href, page: inPage});
                    outPage && outPage.hide();
                    inPage && inPage.show();
                    state.title && (document.title = state.title);
                }
            }
        },

        navigate: function(href, title, transition, pushMode) {

            if( history.state && history.state.href === href) {
                return;
            }

            var inPage = preparePageDom(href, transition, title, pushMode);
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

            history.pushState({
                    href:href,
                    transition: transition,
                    title: title,
                    pushMode: pushMode
                },
                title,
                href
            );

            title && (document.title = title);

            // onPopState();
        }
    };

    // To load, parse and insert the linking page
    // =========================================

    // resolve relative path to absolute path
    function resolvePath(relPath, curPath) {
        var url = location;

        // TODO:
        // window.URL is not supported well in mobile, replace with polyfill
        if (curPath) {
            url = new (window.URL || window.webkitURL)(curPath);
        }

        // ignore absolute path
        if (/^(http\:|https\:)/.test(relPath)) {
            return relPath;
        }

        var host = url.hostname;
        var paths = url.pathname.split('/');
        var relPaths = relPath.split('/');
        var protocol = url.protocol;

        paths.pop();

        while(relPaths.length) {
            var part = relPaths.shift();

            if (part === '..') {
                paths.pop();
            }
            else if(part && part !== '.') {
                paths.push(part);
            }
        }

        return protocol + '//' + host + paths.join('/');
    }

    /**
     * 默认规则：在使用 ajax 导航的情况下，一个页面应该只有一个 fox-page
     */
    function parsePage(pagePath, content) {
        var head;
        var body;
        var bodyHTML;
        var pageHTML;
        var title;

        // existed sources
        var existedScripts = fox.query(document, 'script[src]');
        var existedScriptPaths = [];

        existedScripts.forEach(function(script){
            existedScriptPaths.push(resolvePath(script.src, pagePath));
        });

        // TODO:
        // add recursively query
        var existedImports = fox.query(document, 'link[rel=import]');
        var existedImportPaths = [];

        existedImports.forEach(function(link){
            existedImportPaths.push(resolvePath(link.href, pagePath));
        });

        // TODO:
        // add inline style parse
        var existedStyles = fox.query(document, 'link[rel=stylesheet]');
        var existedStylePaths = [];

        existedStyles.forEach(function(link){
            existedStylePaths.push(resolvePath(link.href, pagePath));
        });

        // source in content
        function linkRegexp(type) {
            return new RegExp('<link[^>]*? rel=(?:\'|")' + type + '(?:\'|")[^>]*? href=(?:\'|")(.+?)(?:\'|")[^>]*?>', 'g');
        }

        var rImport = linkRegexp('import');
        // var rStyle = linkRegexp('stylesheet');

        // 清除重复的tag import，防止重复加载
        content = content.replace(rImport, function(match, href) {
            var path = resolvePath(href, pagePath);

            if (existedImportPaths.indexOf(path) > -1) {
                return '';
            }
            else {
                return match;
            }
        });

        //scripts in content
        var scripts = [];

        //styles in content
        var styles = [];

        var rPage = /(<fox-page[^>]*>)([\s\S.]*)(<\/fox-page>)/i;

        if (/<html/i.test(content)) {
            head = document.createElement('div');
            body = document.createElement('div');
            bodyHTML = content.match(/<body[^>]*>([\s\S.]*)<\/body>/i)[0];
            head.innerHTML = content.match(/<head[^>]*>([\s\S.]*)<\/head>/i)[0];

        // Page fragment
        } else {
            head = body = document.createElement('div');
            bodyHTML = content;
        }

        pageHTML = (bodyHTML.match(rPage)||[])[2];

        // 仅将 fox-page 之外的内容放入临时 div 查找
        // 因为 fox-page 的渲染成本比较高
        body.innerHTML = bodyHTML.replace(rPage, function(match, start, html, end) {
            return start + end;
        });

        scripts = scripts.concat(fox.query(head, 'script'));
        scripts = scripts.concat(fox.query(body, 'script'));

        styles = styles.concat(fox.query(head, 'link[rel="stylesheet"]'));
        styles = styles.concat(fox.query(body, 'link[rel="stylesheet"]'));

        var scriptsToLoad = [];

        scripts.forEach(function(script) {
            if ((!script.type || (script.type.toLowerCase() == 'text/javascript'))) {
                if (script.src
                    && existedScriptPaths.indexOf(resolvePath(script.src, pagePath)) === -1 ) {
                    scriptsToLoad.push(script);
                }
                else if (!script.src) {
                    scriptsToLoad.push(script);
                }
            }
        });

        var stylesToLoad = [];

        styles.forEach(function(style) {
            if (style.href
                && existedStylePaths.indexOf(resolvePath(style.href, pagePath)) === -1 ) {
                stylesToLoad.push(style);
            }
        });

        // parse and set title
        title = head.querySelector('title');
        var text = 'innerText' in title ? 'innerText' : 'textContent';
        title = title && title[text].trim();

        return {
            title: title,
            scripts: scriptsToLoad,
            styles: stylesToLoad,
            head: head,
            body: body,
            page: pageHTML
        }
    }

    function Linker(href, placeholder, timeout) {

        if (!href || !placeholder) {
            return;
        }

        this.placeholder = placeholder;
        this.timeout = timeout;
        this.href = resolvePath(href);

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
                var page;
                var pageHTML;
                var responseText = this.xhr.responseText;
                var me = this;

                if (!responseText) {
                    return
                }

                var pageData = parsePage(this.href, responseText);

                if (pageData) {
                    pageData.title && (document.title = pageData.title);

                    // load styles in need
                    if (pageData.styles.length) {
                        pageData.styles.forEach(function(style){
                            if (style.href) {
                                var s = document.createElement('link');
                                s.rel = 'stylesheet';
                                s.href = resolvePath(style.href, me.href);;
                                document.head.appendChild(s);
                            }
                        });
                    }

                    // replace placeholder
                    pageHTML = pageData.page;
                    page = pageData.body.querySelector('fox-page');

                    if (page && me.placeholder.parentNode) {
                        me.placeholder.innerHTML = pageHTML;

                        // copy attributes
                        fox.toArray(page.attributes).forEach(function(attr) {
                            if (attr.name !== 'class') {
                                me.placeholder.setAttribute(attr.name, attr.value);
                            }
                        });

                        fox.toArray(page.classList).forEach(function(cls){
                            if (('.' + cls) !== mainPage) {
                                me.placeholder.classList.add(cls);
                            }
                        });
                    }

                    // load script in need
                    if (pageData.scripts.length) {
                        pageData.scripts.forEach(function(script){
                            if (!script.src) {
                                ( window.execScript || function( data ) {
                                    window[ 'eval' ].call( window, data );
                                } )( script.textContent );
                            }
                            else {
                                var s = document.createElement('script');
                                s.src = resolvePath(script.src, me.href);
                                document.head.appendChild(s);
                            }
                        });
                    }
                }
            },

            failure: function() {
                // TODO
            }
        };
    })();


    // TODO:
    // 存在隐患，如果这段JS在事件触发之后执行的话将导致代码不会运行，应该统一注册方法并检测Imports状态
    document.addEventListener('HTMLImportsLoaded', function(){
        nav.start();

        // 处理问题2
        // TODO: 目前只监听 touchmove，可以精确到 swipe 手势并且从边框开始滑动
        document.addEventListener('touchmove', function(){
            lastTouchMoveTime = Date.now();
        }, false);
    }, false);
})(this);
