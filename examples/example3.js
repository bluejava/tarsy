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

Tarsy.test("a 1 second test", function() {
		return delayPromise(1000)
	})

Tarsy.test("another 1 second test", function() {
		return delayPromise(1000)
	})

Tarsy.test("one more 1 second test", function() {
		return delayPromise(1000)
	})

Tarsy.showResults()
