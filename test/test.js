var qf = document.getElementById('qunit-fixture');


module('Element Inheritance');

asyncTest( 'Base extends', function() {

    expect( 2 );


    fox('w-extend1',{

        lifecycle: {
            created: function() {
                this.name = 'w-extend1';
            }
        },

        accessors: {
            name: {
              attribute: true
            }
        },

        methods: {
            hi: function() {
                return 'w-extend1';
            }
        }
    });

    fox('w-extend2', null, 'w-extend1');

    qf.innerHTML = '<w-extend2></w-extend2>';

    ok(qf.firstChild.hi() == 'w-extend1');
    ok(qf.firstChild.name == 'w-extend1');

    start();
});

asyncTest( 'Overwrite property', function() {

    expect( 1 );


    fox('w-extend3',{

        lifecycle: {
            created: function() {
                this.name = 'w-extend3';
            }
        }
    });

    fox('w-extend4', {
        lifecycle: {
            created: function() {
                this.name = 'w-extend4';
            }
        }
    }, 'w-extend3');

    qf.innerHTML = '<w-extend4></w-extend4>';

    ok(qf.firstChild.name == 'w-extend4');

    start();
});

asyncTest( 'Overwrite method', function() {

    expect( 1 );


    fox('w-extend5',{

        lifecycle: {
            created: function() {
                this.name = 'w-extend5';
            }
        },

        methods: {
            hi: function() {
                return 'hello ' + this.name ;
            }
        }
    });

    fox('w-extend6', {
        lifecycle: {
            created: function() {
                this.name = 'w-extend6';
            }
        },

        methods: {
            hi: function() {
                return 'bye ' + this.name ;
            }
        }
    }, 'w-extend5');

    qf.innerHTML = '<w-extend6></w-extend6>';

    ok(qf.firstChild.hi() == 'bye w-extend6');

    start();
});

asyncTest( 'Independency of property', function() {

    expect( 4 );


    fox('w-extend7', {
        lifecycle: {
            created: function() {
                this.data = {
                    name: 'miller'
                };
            }
        }
    });

    fox('w-extend8', null, 'w-extend7');

    qf.innerHTML = '<w-extend7></w-extend7><w-extend8></w-extend8>';

    ok(qf.firstChild.data.name == 'miller');
    ok(qf.firstChild.data.name == qf.lastChild.data.name);

    qf.firstChild.data.name = 'lucy';

    ok(qf.firstChild.data.name == 'lucy');
    ok(qf.lastChild.data.name == 'miller');

    start();
});

asyncTest( 'Invoke super prototype', function() {

    expect( 1 );


    fox('w-extend9', {
        methods: {
            calc: function(a, b) {
                this.value = a + b;
            }
        }
    });

    fox('w-extend10', {
        methods: {
            calc: function(a, b) {
                this.$super.calc.apply(this, arguments);

                this.value++;
            }
        }
    }, 'w-extend9');

    qf.innerHTML = '<w-extend10></w-extend10>';

    qf.firstChild.calc(1, 2);

    ok(qf.firstChild.value == 4);

    start();
});
