#! /usr/bin/env node

/*
	This is the command line program.

	To install:
		npm install -g tarsy

	To run:
		tarsy testfile1.js [testfile2.js...]

	or, to process all .js files within a directory:
		tarsy <test directory>

	or use wildcards:
		tarsy src/test-*.js

	Test files are simply javascript modules and will have access to Tarsy, section, test and assert. If the test file contains no
	Node-specific code (such as extra asserts), it can be used within the browser as well.
*/
var path = require("path"),
    	fs = require("fs")

var Tarsy = require("./tarsy.js")

// place Tarsy and the 3 key functions into global space
global.Tarsy = Tarsy
global.section = Tarsy.section
global.test = Tarsy.test
global.assert = Tarsy.assert

// treat each argument as a file (or directory) to process
var promises = []
for(var x=2;x<process.argv.length;x++)
	promises.push(handleFileOrDir(process.cwd(),process.argv[x]))

Promise.all(promises)
	.then(Tarsy.waitForCompletion)
	.then(function() { return Tarsy.showResults() })	// this actually waits for completion itself, but leave above in for clarity
	.then(function() {
			process.on('exit', function() {
					process.exit(Tarsy.getFailCount() ? 1 : 0) // return status of 0 for all tests passed, 1 for errors
				})
		})
	.catch(function(err) {
			if(err.stack)
				console.log(err.stack)
			else
				console.log(err)
		})

// Determine the file the user wishes to process - if it is a directory, process all javascript contained
function handleFileOrDir(parentDir,name)
{
	return new Promise(function(resolve,reject) {
			var filename = path.format({dir: parentDir, base:name})
			fs.stat(filename, function(err, stats) {
					if(err)
						reject(Error("Error processing " + filename + "\n" + err))
					else
						if(stats.isDirectory())
							fs.readdir(filename, function(err, files) {
									if(err)
										reject(Error("Error processing directory " + filename + "\n" + err))
									else
										resolve(processFiles(filename,files))
								})
						else
						{
							require(filename)
							resolve(filename)
						}
				})
		})
}

// This function handles an array of file names that are contained within a
// parent directory. First, filter out any non-js files, then process them.
// TODO: consider recursively processing subdirectories as well (as option?)
function processFiles(directory,files)
{
	return Promise.all(
		files
			.filter(function(f) { return f.endsWith(".js") })
			.map(function(f) {
					return handleFileOrDir(directory,f)
				}))
}