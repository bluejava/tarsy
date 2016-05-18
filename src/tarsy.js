/*
	Tarsy - The little test suite with BIG EYES
	see https://github.com/bluejava/tarsy.git
	version 0.2.4
	Licence: MIT
*/

// UMD (Universal Module Definition)
// Works with CommonJS, AMD or globally defines Tarsy object
(function(root, factory) {

		if(typeof define === "function" && define.amd)
			define(factory)
		else if(typeof exports === "object")
			module.exports = factory()
		else
			root.Tarsy = factory()
	}(this, function() {

			"use strict"

			// Lean towards Zousan, but use native Promise (or shim) if Zousan not available (see github.com/bluejava/zousan)
			var Prom = typeof Zousan !== "undefined" ? Zousan : typeof Promise !== "undefined" ? Promise : null,
				logQueue = [], // hold any log lines while browser gets ready..
				lastTestProm,
				spaces = "                                                                   " // used for  indenting console log lines

			if(!Prom)
				throw Error("No Promise Library Found")

			// supports browser output, colored TTY output, or plain text
			var txtMode = typeof process === "object" && process.stdout && process.stdout.isTTY ?
				"TTY" : typeof window == "object" ? "browser" : "plain"

			// If this is a browser, add our stylesheet (so you don't have to link it in seperately)
			if(txtMode === "browser")
				log("<style> .Tarsy-color31 { color: red } .Tarsy-color32 { color: green } .Tarsy-indent { display: inline-block; } .Tarsy-indent0 { } .Tarsy-indent1 { margin-left: 2em; } .Tarsy-indent2 { margin-left: 4em; } .Tarsy-indent3 { margin-left: 6em; } .Tarsy-indent4 { margin-left: 8em; }  .Tarsy-indent5 { margin-left: 10em; } </style>") // eslint-disable-line max-len

			function js(o) { return JSON.stringify(o) } // JSON.stringify - but easier to type

			// Returns an object that can be used (along with end() below) to "time" an
			// operation or activity. Pay no attention to the object that is returned, but
			// hold on to it to pass to the end function which will return the ms elapsed
			// as accurately as possible.
			function start()
			{
				if(typeof process === "object")
					return process.hrtime()

				if(typeof performance === "object")
					return performance.now()

				return Date.now()
			}

			// Used in conjunction with start() above (read comment above start())
			// Pass in the value returned from start to get an accurate (as possible)
			// elapsed time (in ms).
			function end(timer)
			{
				// for node, use the process.hrtime
				if(typeof process === "object")
				{
					var diff = process.hrtime(timer)
					return (diff[0] * 1e9 + diff[1]) / 1e6
				}

				if(typeof performance === "object")
					return performance.now() - timer

				return Date.now() - timer
			}

			// Used for stylized (colored/bold) text in the console (TTY) window
			// Numbers in this chunk stolen from https://github.com/Marak/colors.js/blob/master/lib/styles.js
			function styleCode(v) { return "\u001b[" + v + "m" }

			// Returns the text msg wrapped in codes for making it a specific color
			function colorTxt(code, msg)
			{
				if(txtMode === "TTY")
					return styleCode(code) + msg + styleCode(39)
				if(txtMode === "browser")
					return "<span class=\"Tarsy-color" + code + "\">" + msg + "</span>"
				return msg // plain
			}

			// Returns the text msg wrapped in codes for making it bold
			function boldTxt(msg)
			{
				if(txtMode === "TTY")
					return styleCode(1) + msg + styleCode(22)
				if(txtMode === "browser")
					return "<b>" + msg + "</b>"
				return msg // plain
			}

			//function underlineTxt(msg) { return styleCode(4) + msg + styleCode(24) }

			function redTxt(msg) { return colorTxt(31, msg) }
			function greenTxt(msg) { return colorTxt(32, msg) }
			function blueTxt(msg) { return colorTxt(34, msg) }

			// The simplest templating "system" evah! Simply loops through your data and does a search/replace
			// in your string with {name} - obviously this will only work for simple cases.
			function simpleTemplate(str, args)
			{
				for(var x in args)
					str = str.replace(new RegExp("{" + x + "}", "g"), function() { return args[x]}) // eslint-disable-line no-loop-func
				return str
			}

			// Create a new section object.
			//	name : Used in reporting to identify the section
			//	opts : optional configuration overrides for this section
			//	parentSection : If this is a subsection, this is the parent section object
			//	indent : The level deep this section is - used for report indenting
			function newSection(name, opts, parentSection, indent)
			{
				opts = opts || {}
				indent = indent || 0

				return {
					childSections: [],	// our child sections
					childPromises: [],	// A combination of test promises and section promises directly contained in this section
					childTests: [],		// tests directly contained in this section
					failCount: 0,			// failed tests directly contained in this section. For all child sections/tests must derive
					indent: indent,
					name: name,	// the name of our section
					opts: opts,		// opts overrides for this section (and its children, lest they be overridden)
					parent: parentSection,
					passCount: 0,		// passed tests directly contained in this section
					timer: start()
				}
			}

			// Returns a promise that will resolve when the specified section completes (all child sections and
			// contained tests complete)
			function waitForSectionCompletion(section)
			{
				return Prom.all(section.childPromises)
			}

			// the root section - parent of any tests not contained within a defined section
			var rootSection = newSection("Total Test Run", {
						async: true,			// if false, each test waits for previous to finish
						maxFailures: 10,		// maximum failures allows within this section
						timeout: 5000,			// timeout for any given test
						sectionTimeout: 0	// Timeout for this entire section
					}),
				currentSections = [rootSection]
			rootSection.timer = start()

			// sets the root section options as specified here. Any options not specified here
			// remain as they are currently.
			function setRootOpts(opts)
			{
				for(var k in opts)
					rootSection.opts[k] = opts[k]
			}

			// When we enter a new section, run this function which creates the new section object
			// based on the context of the sections stack and returns it.
			//	sections : The section stack which reflects the "context" of this section
			//	name : The section descriptor used in reporting
			//	opts : The optional config overrides
			function sectionOpen(sections, name, opts)
			{
				var parent = sections[sections.length - 1]
				var section = newSection(name, opts, parent, sections.length - 1)

				sections.push(section)

				if(section.parent)
					section.parent.childSections.push(section)

				return section
			}

			// Should be called when we exit a section function within a given context.
			// Note: Child tests may still be running - this section is not "complete"
			//	sections : The section stack which reflects the "context" of this section
			//	section : The section whose function we are exiting
			function sectionClose(sections, section)
			{
				// Create a promise to return from the section function - it resolves when all "child promises" resolve
				// Child promises are sub-section promises and immediately contained test promises
				section.promise = Prom.all(section.childPromises)

				if(section.parent)
					section.parent.childPromises.push(section.promise)

				// When all child promises resolve, we can stop the timer
				section.promise.then(function() {
						section.time = end(section.timer)
					})

				return sections.pop()
			}

			// This is the public API function for "section" - it creates the new section and runs the
			// section function that is passed.
			//	name : The section descriptor used in reporting
			//	fn : The section function which contains the tests and subsections
			//	opts : The optional config overrides for this section
			function section(name, fn, opts)
			{
				// create a new section object
				var section = sectionOpen(currentSections, name, opts)

				log(blueTxt("Started") + " section: " + getSectionNum(section) + " - " + name, section.indent)

				// Run the section function
				fn()

				// close this section - The section function has completed.
				// But note - tests within this section may still be running!
				sectionClose(currentSections, section)

				section.promise.then(function() {
						log(blueTxt("Finished") + " section: " + getSectionNum(section) + " - " + name, section.indent)
						log("")
					})

				// create new promise to return so we can resolve to section object
				return new Prom(function(resolve) {
						section.promise.then(function() {
								resolve(section)
							})
					})
			}

			// Returns the dot-separated numeric representation of this section (i.e. 1.2.1). It is determined by
			// traversing up the parental stack and numbering each section based on its place within
			// its parent's list of subsections. The "root" section (no parent) returns an empty string.
			//	section : The section for which to return a section number
			function getSectionNum(section)
			{
				if(section.parent)
					return getSectionNum(section.parent) +
						(section.parent === rootSection ? "" : ".") + (section.parent.childSections.indexOf(section) + 1)
				else
					return ""
			}

			// utility function to set appropriate properties in the test object for a test that has failed,
			// and to complete the test.
			function failTest(test, e)
			{
				test.failed = true
				test.e = e
				test.section.failCount++

				return testDone(test)
			}

			// utility function to set appropriate properties in the test object for a test that has passed,
			// and to complete the test.
			function passTest(test, ret)
			{
				test.passed = true
				test.ret = ret
				test.section.passCount++
				return testDone(test)
			}

			// utility function to complete a test - it stops the timer, sets complete to true and logs any
			// exception messages.
			function testDone(test)
			{
				test.time = end(test.timer)
				test.complete = true
				showTestResult(test, test.indent)
				if(test.e)
					log(redTxt(test.e.message), test.indent + 1)

				/*if(section.failCount >= abortOnFailCount)
					reject("Maximum failures reached (" + abortOnFailCount + "). Aborting testing.")
				else*/
				return test
			}

			// Returns an option value for a given test or section by traversing up the parental hierarchy until
			// it finds a setting for that option. If no setting is found, undefined is returned.
			//	o : The object upon which an option is to be determined (a test or section)
			//	name : The option name to be determined.
			function getOpt(o, name)
			{
				if(o.opts[name] !== undefined)
					return o.opts[name]

				// return the parent opt value (for test, its containing section, for sections, its parent) else, undefined
				return o.section ? getOpt(o.section, name) : o.parent ? getOpt(o.parent, name) : undefined
			}

			// Public facing test function  - creates a test within the currently active section and launches
			// the test asyncronously. Returns a promise that resolves when the test completes (regardless
			// of test pass or fail)
			//	name : The name or descriptor of the test - used in reporting
			//	fn : The function to call for this test, containing the asserts and testing code
			//	opts : Optional configuration overrides for this test
			function test(name, fn, opts)
			{
				opts = opts || { }

				var section = currentSections[currentSections.length - 1]
				var test = { name: name, section: section, opts: opts, indent: section.indent + 1 }

				var runtest = function runtest(resolve, reject) // eslint-disable-line no-unused-vars
				{
					test.section.childTests.push(test)

					test.timer = start()

					try
					{
						var ret = fn()
						if(ret instanceof Error)
							resolve(failTest(test, ret))
						else
							if(typeof ret !== "undefined" && ret && ret.then && typeof ret.then == "function")  // eslint-disable-line curly
							{
								ret.then(function(ret) {
										if(!test.complete)
											resolve(passTest(test, ret))
									})
									.catch(function(e) {
											if(!test.complete)
												resolve(failTest(test, e))
										})
							}
							else
								resolve(passTest(test, ret))
					}
					catch (e)
					{
						resolve(failTest(test, e))
					}
				}

				var testPromise = new Prom(function(resolve, reject) {

						function start()
						{
							runtest(resolve, reject)
							var testTimeout = getOpt(test, "timeout")
							var timeoutHandle = setTimeout(function() {
									if(!test.complete)
									{
										failTest(test, Error("Timeout (" + testTimeout + "ms)"))
										resolve(test)
									}
								}, testTimeout)
							testPromise.then(function() { clearTimeout(timeoutHandle) })
						}

						if(!getOpt(test, "async") && lastTestProm)
							lastTestProm.then(start, start)
						else
							setTimeout(start, 0)

					})

				lastTestProm = testPromise
				section.childPromises.push(testPromise)
				return testPromise
			}

			// simply appends an output line to the browser - currently this done in a very
			// primitive way (appending to body) - but should work well enough for a test suite.
			//	msg : Text message to display
			//	indent : Indent level (0-5) which sets a class for indenting the text
			function appendLineToBrowserWindow(msg, indent)
			{
				// completely empty DIV elements have no height - so force some conten (non-breaking space)
				if(msg === "")
					msg = "&nbsp;"
				document.body.innerHTML += "<div class=\"Tarsy-indent" + indent + "\">" + msg + "</div>"
			}

			// Once the browser DOM is ready, we can output any lines that were queued for output
			// (this is all to avoid waiting for DOMReady which would require the whole test suite be contained
			// within a function)
			function flushLog()
			{
				if(document.readyState === "complete")
				{
					logQueue.forEach(function(msgOb) { appendLineToBrowserWindow(msgOb.msg, msgOb.indent)})
					logQueue.length = 0
				}
				else
					setTimeout(flushLog, 50)
			}

			// logs an output line to the browser with a given indent level. If the browser DOM is not ready
			// we hold the line and dump it once the browser DOM is ready.
			//	msg : Text message to display
			//	indent : Indent level (0-5) which sets a class for indenting the text
			function logBrowser(msg, indent)
			{
				// If the DOM is ready, append away!
				if(document.readyState === "complete")
				{
					// now that DOM is ready, if there are pending lines, flush em
					if(logQueue.length)
						flushLog()

					appendLineToBrowserWindow(msg, indent)
				}
				else
				{
					// If the DOM is not ready yet, place the output line in a logQueue to be flushed later
					logQueue.push({msg: msg, indent: indent})
					flushLog()
				}
			}

			//var clogTimeStart = Date.now()

			// Console log function - indent level supported with 4 spaces for each indent level.
			//	msg : Text message to display
			//	indent : Indent level (0-5) which prepends spaces (4 per level)
			function clog(msg, indent)
			{
				indent = indent || 0
				//var ts = Date.now() - clogTimeStart
				console.log(spaces.substring(0, indent * 4) + /*ts + ": " +*/ msg)
			}

			// Log an output line to the appropriate context (browser or console)
			//	msg : Text message to display
			//	indent : Indent level (0-5) used in formating
			function log(msg, indent)
			{
				indent = indent || 0
				if(txtMode === "browser")
					logBrowser(msg, indent)
				else
					clog(msg, indent)
			}

			// Returns the number of failed tests (so far). To get a final count, call this
			// after first calling waitForCompletion().
			function getFailCount()
			{
				return getPassFailCount(rootSection).fail
			}

			// recursively sum the pass/fail of our subsections, then add our own pass/fail counts
			// To get a final count, call this after first calling waitForCompletion().
			//	section : optional section object which limits the pass/count to this section only
			function getPassFailCount(section)
			{
				section = section || rootSection
				var subsectionPF = section.childSections
					.map(getPassFailCount)
					.reduce(function(pfTally, pf) {
							return {pass: pfTally.pass + pf.pass, fail: pfTally.fail + pf.fail}
						}, {pass: 0, fail: 0})

				return {pass: subsectionPF.pass + section.passCount, fail: subsectionPF.fail + section.failCount}
			}

			/*			REPORTING 		*/

			// Displays the test report
			//	section : optional section for which this report will be limited to.
			function showResults(section)
			{
				section = section || rootSection

				return waitForSectionCompletion(section)
					.catch(function(e) {
						log("")
						log("Error: " + e)
					})
					.then(function() {

						// Update Total test time, as this is never explicitly closed by the user - so it acts like
						// a "running total" for the entire test run
						if(section === rootSection)
							rootSection.time = end(rootSection.timer)

						log("")
						log("----------------------------------")
						log("Results for " + section.name)
						log("----------------------------------")

						showSectionResults(section, 0)

						/*if(failures >= abortOnFailCount)
						{
							log("")
							log(redTxt("Maximum failures reached (" + abortOnFailCount + "). Aborting testing."))
							log("")
						}*/
					})
			}

			// silly little function for adding an "s"  at the end of a word if the count (c) is 0 or more than 1.
			// i.e.
			// s(1,"test") + " failed." =  "1 test failed."
			// s(2,"test") + " failed." = "2 tests failed."
			function s(c, w) { return c + " " + (c === 1 ? w : w + "s") }

			// Logs a nicely formatted line showing the results of a single test with a given indent level.
			function showTestResult(test, indent)
			{
				log(
					simpleTemplate("{mark} {sectionNum} | {questionNum} - {name} {passfail} ({time}ms)", {
								mark: test.passed ? greenTxt("✓") : redTxt("✗"),
								sectionNum: getSectionNum(test.section),
								questionNum: test.section.childTests.indexOf(test) + 1,
								name: boldTxt(test.name),
								passfail: test.passed ? greenTxt("Passed") : redTxt("Failed"),
								time: Math.round(test.time * 100) / 100
							}), indent)
			}

			// Displays a comprehensive report on each section/test with pass/fail counts and times.
			function showSectionResults(section, indent)
			{
				log("")
				if(section !== rootSection)
					log(boldTxt("Section " + getSectionNum(section) + " - " + section.name), indent)

				// First, display subsection results
				section.childSections.forEach(function(ss) { showSectionResults(ss, indent + 1) })

				// Then show our own test results
				section.childTests.forEach(function(test) {
						showTestResult(test, indent + 1)
						if(test.failed)
							if(test.e)
							{
								// suppress the stack trace if it is an assertion error or a timeout (IDEA: option to override suppression?)
								if(test.e.stack && test.e.message.indexOf("Assertion") < 0 && test.e.message.indexOf("Timeout") < 0)
									log(redTxt(test.e.stack), indent + 2)
								else
									log(redTxt(test.e.message), indent + 2)
							}
				})

				// If this is the root and it directly contains no tests and only 1 subsection, don't bother reporting
				if(section === rootSection && section.childTests.length === 0 && section.childSections.length < 2)
					return

				// And finally show a total tally of pass/fail
				var pf = getPassFailCount(section)

				log(boldTxt(simpleTemplate("➟ {sectionNum}{sectionName}: {passes}, {fails} ({time}ms)", {
								sectionNum: section === rootSection ? "" : "Section " + getSectionNum(section) + " - ",
								sectionName: blueTxt(section.name),
								passes: greenTxt(s(pf.pass, "test") + " passed"),
								fails: pf.fail > 0 ? redTxt(s(pf.fail, "test") + " failed") : "0 tests failed",
								time: Math.round(section.time * 100) / 100
						})), indent)
				log("")
			}

		/*			ASSERT			*/

		// This is our assert implementation. Pretty standard stuff here, with the exception that we lean towards minimalism
		// and strict tests. i.e. under most assert libraries, assert.equal(0,null) is true, but we call it false.
		var assert = (function() {

			// An object equality tester that considers prototypes (as Node's assert.deepEqual does not)
			function equals(a, b, deep)
			{
				// for native types, use ===
				if(typeof a != "object" || typeof b != "object")
					return a === b

				// if one or both are null, thats easy
				if(a === null)
					if(b === null) return true
					else return false
				else
					if(b === null) return false

				// ok, so they are both a non-null object/Array type - so check props on each of a
				for(var ak in a)
					if(deep)
					{
						if(!equals(a[ak], b[ak], true))
							return false
					}
					else
						if(a[ak] !== b[ak])
							return false

				// then ensure there are no "extra" types in b
				for(var bk in b)
					if(a[bk] === undefined)
						return false

				// we passed all the object tests, so we are equal!
				return true
			}

			var ret = function(bool) {
					if(bool !== true)
						throw Error("Assertion failure.  Expected true assertion, but received " + js(bool))
				}

			ret.equal = function(actual, expected) {
					if(actual !== expected)
						throw Error("Assertion equal failure between actual (" + js(actual) + ") and expected (" + js(expected) + ") values.")
				}

			ret.deepEqual = function(actual, expected) {
					if(!equals(actual, expected, true))
						throw Error("Assertion deepEqual failure between actual (" + js(actual) + ") and expected (" + js(expected) + ") values.")
				}

			ret.notDeepEqual = function(actual, expected) {
					if(equals(actual, expected, true))
						throw Error("Assertion notDeepEqual failure between actual (" + js(actual) + ") and expected (" + js(expected) + ") values.")
				}

			ret.throws = function(fn) {
					try {
							fn()	// we expect this will throw an error and skip the next line
							throw Error("Assertion throws failed to throw error.")
						}
					catch (err) { /* swallow the error, as it was expected */ }
				}

			ret.rejects = function(fn) {
					var ret = fn()	// this should be a promise
					if(!ret || !ret.then || !(typeof ret.then == "function"))
						throw Error("Assertion failure. Function passed to assert.rejects did not return a Promise")

					return new Prom(function(resolve, reject) {
						ret.then(function() { reject(Error("Assertion failure. assert.rejects did not reject")) }, resolve) // we flip it!
					})
				}

			return ret
		}())

		return {
			assert: assert,
			getFailCount: getFailCount,
			getPassFailCount: getPassFailCount,
			getRootSection: function() { return rootSection },
			section: section,
			setRootOpts: setRootOpts,
			showResults: showResults,
			test: test,
			waitForCompletion: function() { return waitForSectionCompletion(rootSection) }
		}

})); // eslint-disable-line semi