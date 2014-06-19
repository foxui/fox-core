/**
 * ## 为所有非数据源组件添加数据源功能
 *
 * ### data setter/getter (property)
 *
 * 所有非数据源组件都包括 data 属性，data 属性变化时会尝试调用组件的以下方法：
 *
 * * datasourceChanged: 组件在此方法中可以针对数据源变更进行处理
 * * datasourceFiler: 将次方法返回的数据作为最终的数据源，可以自行设定过滤规则
 *
 * ### 关联数据源组件
 *
 * 可以将组件关联对应的数据源组件，当数据源发生变化时会将最新的数据同步到关联组件上。
 *
 * #### sourceSelector (attribute)
 *
 * 通过该属性可以设定组件关联的数据源组件，有以下两种类型
 *
 * * 选择符：为 CSS Selector，例如 #movieData
 * * 全局数据：以 @ 开头，会从全局数据中获取，例如 @data.products
 *
 * #### 内嵌数据源
 *
 * 例如：
 * <fox-my>
 *     <fox-json></fox-json>
 * </fox-my>
 */

(function( env ) {

    var fox = env.fox;
    var dataTags = ['fox-json', 'fox-ajax'];
    var callback = 'datasourceChanged';
    var dataFilter = 'datasourceFilter';

    /**
     * 数据源声明的三种场景：
     * 优先级为：1,2 > 3
     * 1.
     * <fox-element sourceSelector="fox-json"></fox-element>
     *
     * 2.
     * <fox-element sourceSelector="@data.items"></fox-element>
     * <script>
     * var data = {
     *     items: []
     * };
     * </script>
     *
     * 3.
     * <fox-element>
     *     <fox-json></fox-json>
     * </fox-element>
     */
    function parseDataSource() {
        var ss = this.getAttribute('sourceSelector');
        var isGlobalData = ss && (ss.indexOf('@') === 0);
        var targetDom = ss && !isGlobalData;
        var me = this;

        // 全局数据是立即读取的，因此要求数据存在于组件创建之前
        if (isGlobalData) {
            var oldVal = this.data;
            this.data = eval(ss.substring(1));
        }
        else if(targetDom) {

            // 当数据结点已创建完成时(只取第一个数据源结点)
            var dataEl = fox.query(document, ss)[0];

            if (dataEl && dataEl.data) {
                this.data = dataEl.data;
            }

            // 当数据结点未创建或者后续数据变更时(实际上允许多个数据源，但和初始时不一致)
            document.addEventListener('data-change', function(e){

                // layzy query: 可以不依赖数据源结点的生成时机
                var targets = fox.toArray(document.querySelectorAll(ss));

                if (targets.indexOf(e.target) > -1) {
                    me.data = e.detail.newVal;
                }
            }, false);
        }

        // 监听内部 data-change(过滤掉非直接子结点数据源元素)
        else {
            // 元素创建顺序决定于元素文件的载入顺序，因此在创建时内部结点的状态是不确定的

            // 当数据结点已创建完成时(只取第一个数据源结点)
            var dataEl = fox.queryChildren(this, dataTags.join())[0];

            if (dataEl && dataEl.data) {
                this.data = dataEl.data;
            }

            // 当数据结点未创建或者后续数据变更时(实际上允许多个数据源，但和初始时不一致)
            this.addEventListener('data-change', function(e){
                if (e.target.parentNode === me) {
                    me.data = e.detail.newVal;
                }
            }, false);
        }
    }

    // 将 data 注册为setter/getter
    function dataSetterGetter(options){
        options.accessors = options.accessors || {};

        options.accessors.data = {
            get: function(){
                return this._data_;
            },
            set: function(data){
                var oldVal = this._data_;

                this._data_ = this[dataFilter] ? this[dataFilter](data) : data;
                this[callback] && this[callback](this._data_, oldVal);
            }
        };
    }

    fox.fn.datasource = function (options) {
        var originCreated;
        var lifecycle = options.lifecycle || (options.lifecycle = {});

        if (lifecycle.created) {
            originCreated = lifecycle.created;
        }

        dataSetterGetter(options);

        options.lifecycle.created = function() {
            if (dataTags.indexOf(this.tagName) === -1) {
                parseDataSource.call(this);
            }

            originCreated && originCreated.apply(this, arguments);
        }
    };

})(this);
