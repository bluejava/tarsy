var Tarsy = require("..")

// For larger examples, its best to define these oft-used functions
var assert = Tarsy.assert,
    test = Tarsy.test,
    section = Tarsy.section

section("math", function() {
	section("algebra", function() {
			test("Math.pow", function() {
					assert.equal(Math.pow(3,3),27)
				})
		})

	section("geometry", function() {
		// geometry testing goes here
		test("sin", function() {
			assert.equal(Math.sin(0), 0)
			assert.equal(Math.sin(Math.PI / 2), 1)
			assert.equal(Math.sin(Math.PI), 0)
		})
	})
})
