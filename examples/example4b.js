var Tarsy = require("../src/tarsy.js")

// For larger examples, its best to define these oft-used functions
var assert = Tarsy.assert,
	test = Tarsy.test,
	section = Tarsy.section

function delayPromise(ms)
{
	return new Promise(function(resolve,reject) {
			setTimeout(resolve,ms)
		})
}

test("1 second test, then error", function() {
		return delayPromise(1000).then(function() {
				bogus.foo = "bar" // this will throw an error
			})
	})

test("immediate pass", function() {
		assert(true)
	})

Tarsy.showResults()
