var fs = require("fs");
var path = require("path");
var argparse =  require( "argparse" );
var uglify = require("uglify-js");
var spawn = require('child_process').spawn;
var concat = require('concat-with-sourcemaps')

var scriptDir = __dirname;
var baseDir = path.resolve( scriptDir, '../..' );
var includesDir = path.resolve( scriptDir, 'includes' );
var externsDir = path.resolve( scriptDir, 'externs' );
var compilerDir = path.resolve( scriptDir, 'compiler' );

var resultsDir = path.resolve( scriptDir, '../../build' );

function processSourceContent(sourceRelPath) {
	var sourceAbsPath = path.resolve(baseDir, sourceRelPath);
	var sourceExtension = path.extname(sourceAbsPath);
	var sourceFilename = path.basename(sourceRelPath, sourceExtension);

	var content = fs.readFileSync(sourceAbsPath, 'utf8');

	if( sourceExtension === '.glsl' ) {

		content = 'THREE.ShaderChunk[ \'' +
			sourceFilename + '\' ] =' +
			JSON.stringify( content ) + ';\n';

	}

	// add file path comment
	content = '// File: ' + sourceRelPath + '\n\n' + content;

	return {
		absPath: sourceAbsPath,
		relPath: sourceRelPath,
		content: content,
		ext: sourceExtension
	};
}

function main() {

	"use strict";

	var parser = new argparse.ArgumentParser();
	parser.addArgument( ['--include'], { action: 'append', required: true } );
	parser.addArgument( ['--externs'], { action: 'append', defaultValue: [ path.resolve( externsDir, 'common.js' ) ] } );
	parser.addArgument( ['--amd'], { action: 'storeTrue', defaultValue: false } );
	parser.addArgument( ['--minify'], { action: 'storeTrue', defaultValue: false } );
	parser.addArgument( ['--output'], { defaultValue: path.resolve( resultsDir, 'three.js' ) } );
	parser.addArgument( ['--sourcemaps'], { action: 'storeTrue', defaultValue: true } );

	var args = parser.parseArgs();

	var output = args.output;
	var outputDir = path.dirname(output)
	var outputFilename = path.basename(output)

	console.log(' * Building ' + output);

	var sourcemap = '';
	var sourcemapFile;
	var sourcemapPath;
	var sourcemapping = '';

	if ( args.sourcemaps ){

		sourcemapFile = outputFilename + '.map';
		sourcemapPath = path.resolve(outputDir, sourcemapFile);
		sourcemapping = '\n//# sourceMappingURL=' + sourcemapFile;

	}

	var sources = [
		processSourceContent( 'utils/build/snippets/license.js' )
	];

	if ( args.amd ) {

		sources.push( processSourceContent( 'utils/build/snippets/amd_start.js' ) );

	}

	for ( var i = 0; i < args.include.length; i++ ) {

		var contents = fs.readFileSync( path.resolve( includesDir, args.include[ i ] + '.json' ), 'utf8' );
		var files = JSON.parse( contents );

		for ( var j = 0; j < files.length; j++ ) {

			sources.push( processSourceContent( files[ j ] ) );

		}

	}

	if ( args.amd ) {

		sources.push( processSourceContent( 'utils/build/snippets/amd_end.js' ) );

	}

	if ( ! args.minify ) {

		// build uncompressed file
		var concatter = new concat( true, output, '\n\n' );
		for ( var i = 0; i < sources.length; i++ ) {

			// sourcemap paths need to be relative to where build file is
			concatter.add(
				path.relative( outputDir, sources[ i ].relPath ),
				sources[ i ].content );

		}

		var buildSrc = concatter.content;

		if ( args.sourcemaps ) {

			buildSrc += sourcemapping;
			fs.writeFileSync( sourcemapPath, concatter.sourceMap , 'utf8' );

		}

		fs.writeFileSync( output, buildSrc, 'utf8' );

	} else {

		// see: https://github.com/mishoo/UglifyJS2#the-hard-way
		// Parsing

		var toplevel = null;

		sources.forEach( function( source ) {

			toplevel = uglify.parse( source.content, {
				filename: path.relative( outputDir, source.relPath ),
				toplevel: toplevel
			} );

		} );

		toplevel.figure_out_scope(); // Necessary before doing any other operations

		// Compression

		var compressor = uglify.Compressor( {} );
		var compressed_ast = toplevel.transform( compressor );

		// Mangling

		compressed_ast.figure_out_scope(); // recommended after compression

		compressed_ast.compute_char_frequency();
		compressed_ast.mangle_names();

		// Output

		var outputOptions = { comments: new RegExp('threejs\.org\/license') };
		if ( args.sourcemaps ) {

			outputOptions.source_map = uglify.SourceMap( { file: outputFilename } );

		}

		var stream = uglify.OutputStream( outputOptions );
		compressed_ast.print( stream );
		var code = stream.toString();

		if ( args.sourcemaps ) {

			code += sourcemapping;
			fs.writeFileSync( sourcemapPath, outputOptions.source_map.toString(), 'utf8' );

		}

		fs.writeFileSync( output, code, 'utf8' );

	}

}

main();
