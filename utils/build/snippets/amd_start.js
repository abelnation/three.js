function ( root, factory ) {

	if ( typeof define === 'function' && define.amd ) {

		define( [ 'exports' ], factory );

	} else if ( typeof exports === 'object' ) {

		factory( exports );

	} else {

		factory( root );

	}

}( this, function ( exports ) {


