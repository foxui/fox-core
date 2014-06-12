document.addEventListener('HTMLImportsLoaded', function() {
    var qf = document.getElementById('qunit-fixture');

    module('::init::');

    asyncTest( 'init via innerHTML', function() {

        expect( 1 );

        qf.innerHTML = '<fox-foo foo=1></fox-foo><fox-blank></fox-blank>';

        ok(qf.firstChild.foo === '1');

        start();

    });

    asyncTest( 'init via createElement', function() {

        expect( 1 );

        var foo = document.createElement('fox-foo');
        foo.foo = '1';

        ok(foo.hasAttribute('foo'));

        start();

    });

    module('::attributes::');

    asyncTest( 'asign value via attribute', function() {

        expect( 2 );

        // fox-foo's attributes:foo boolfoo
        qf.innerHTML = '<fox-foo foo=1 non=2></fox-foo>';

        // property can only be visited when defined in attributes
        ok(qf.firstChild.foo === '1');
        ok(qf.firstChild.non === undefined);

        start();

    });

    asyncTest( 'change attribute value via property', function() {

        expect( 2 );

        qf.innerHTML = '<fox-foo foo=1></fox-foo>';

        //change property
        qf.firstChild.foo = 2;
        qf.firstChild.non = 2;

        ok(qf.firstChild.getAttribute('foo') === '2');
        ok(!qf.firstChild.hasAttribute('non'));

        start();

    });

    asyncTest( 'boolean attribute', function() {

        expect( 2 );

        qf.innerHTML = '<fox-foo boolfoo></fox-foo><fox-foo></fox-foo>';

        ok(qf.firstChild.boolfoo === true);
        ok(qf.lastChild.boolfoo === false);

        start();

    });

    asyncTest( 'attribute changed', function() {

        expect( 3 );

        qf.innerHTML = '<fox-foo foo=1></fox-foo>';

        qf.firstChild.addEventListener('attribute-change', function(evt) {
            var data = evt.detail;

            ok(data.attr == 'foo');
            ok(data.oldVal == '1');
            ok(data.newVal == '2');

            start();

        }, false);

        qf.firstChild.foo = 2;

    });


    module('::methods::');

    asyncTest( 'normal invoke', function() {

        expect( 1 );

        qf.innerHTML = '<fox-foo foo=miller></fox-foo>';

        ok(qf.firstChild.hi() == 'hello miller');

        start();

    });

    module('::extend::');

    asyncTest( 'inherit attribute from super tag', function() {

        expect( 3 );

        qf.innerHTML = '<fox-bar foo=1 bar=2></fox-bar>';

        ok(qf.firstChild.foo == '1');
        ok(qf.firstChild.bar == '2');
        ok(qf.firstChild.prop1 == 'fox-foo');

        start();

    });

    asyncTest( 'inherit method from super tag', function() {

        expect( 1 );

        qf.innerHTML = '<fox-bar foo=miller></fox-bar>';

        ok(qf.firstChild.hi() == 'hello miller');

        start();

    });

    asyncTest( 'override method', function() {

        expect( 2 );

        qf.innerHTML = '<fox-foo></fox-foo><fox-bar></fox-bar>';

        qf.firstChild.calc(1, 2);
        qf.lastChild.calc(1, 2);

        ok(qf.firstChild.value == 3);
        ok(qf.lastChild.value == 2);

        start();

    });

    asyncTest( 'override property', function() {

        expect( 2 );

        qf.innerHTML = '<fox-foo></fox-foo><fox-bar></fox-bar>';

        ok(qf.firstChild.prop2 == 'fox-foo');
        ok(qf.lastChild.prop2 == 'fox-bar');

        start();

    });

    asyncTest( 'instance property', function() {

        expect( 4 );

        qf.innerHTML = '<fox-foo></fox-foo><fox-bar></fox-bar>';

        ok(qf.firstChild.data.name == 'miller');
        ok(qf.lastChild.data.name == 'miller');

        qf.lastChild.data.name = 'tester';

        ok(qf.firstChild.data.name == 'miller');
        ok(qf.lastChild.data.name == 'tester');

        start();

    });

    asyncTest( 'call method in super prorotype', function() {

        expect( 1 );

        qf.innerHTML = '<fox-bar></fox-bar>';

        qf.firstChild.calcPlus(1, 2);

        ok(qf.firstChild.value == 4);

        start();

    });
}, false);
