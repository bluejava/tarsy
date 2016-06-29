// The following is unnecessary if using CLI tarsy, but needed in browser testing
var section = Tarsy.section,
    assert = Tarsy.assert,
    test = Tarsy.test

section("Tarsy.assert", function() {
	test("assert(bool)", function() {

			// a simple assert
			assert(true)

			// a true comparison
			assert(10 == 10)

			// Ensure that an assert of a "truthy" value throws an exception
			assert.throws(function() {
					assert("false")
				})

			// Here is another truthy value - should throw
			assert.throws(function() {
					assert(1)
				})

			// An object is also truthy - make sure it throws
			assert.throws(function() {
					assert({a:1})
				})
		})

		test("assert.equal", function() {

			assert.equal(Math.pow(2,3),8)

			assert.equal(1,1)

			// these values simply are not equal
			assert.throws(function() {
					assert.equal(2,3)
				})

			// We don't coerc types, so this should throw
			assert.throws(function() {
					assert.equal(1,"1")
				})

			// This should also throw
			assert.throws(function() {
					assert.equal(null,undefined)
				})

			// This should also throw - use deepEqual for this
			assert.throws(function() {
					assert.equal({a:1},{a:1})
				})
		})

		test("assert.deepEqual", function() {

			// looks same to me!
			assert.deepEqual({a:1},{a:1})

			// extra property in expected value should fail it
			assert.throws(function() {
					assert.deepEqual({a:1},{a:1,b:2})
				})

			// These arrays are same
			assert.deepEqual([1,2,3,4],[1,2,3,4])

			// here we change the order, which should fail it
			assert.throws(function() {
					assert.deepEqual([1,2,3,4],[4,3,2,1])
				})

			//  these properties are in different order, but shouldn't matter
			assert.deepEqual({a:1,b:2},{b:2,a:1})
		})

		test("assert.notDeepEqual", function() {

			// these ARE equal, so should fail
			assert.throws(function() {
					assert.notDeepEqual({a:1},{a:1})
				})

			// extra property in expected value makes them different
			assert.notDeepEqual({a:1},{a:1,b:2})

			// These arrays are same - so should fail a notDeepEqual
			assert.throws(function() {
					assert.notDeepEqual([1,2,3,4],[1,2,3,4])
				})

			// here we change the order, which passes notDeepEqual
			assert.notDeepEqual([1,2,3,4],[4,3,2,1])

			//  these properties are in different order, but shouldn't matter, so fails notDeepEqual
			assert.throws(function() {
					assert.notDeepEqual({a:1,b:2},{b:2,a:1})
				})
		})

		test("assert.throws", function() {

				assert.throws(function() {
						bogus.foo = "bar"	// bogus variable does not exist. This throws and passes assertion
					})

				assert.throws(function() {
						var c = Math.double(3)	// Math.double is not a function - throws
					})

				assert.throws(function() {
						speedUp	 // pretty sure this command doesn't exist in javascript
					})

			})

		test("assert.rejects", function() {

			// This assert returns a promise that must be returned to the test..
			return assert.rejects(function() {
					return new Promise(function(resolve,reject) {
							// The promise must be rejected in order for this test to pass..
							setTimeout(reject, 500)
						})
				})

		})
	})

section("pass and fail counts setup", function() {

		// 3 passing tests
		test("dummy test 1", function() {})
		test("dummy test 2", function() {})
		test("dummy test 3", function() {})

	}).then(function(thisSection) {	// this promise resolves with the section object when the sections tests all finish

		// This is a wierd construct - defining a section in a promise handler - so this section may not appear
		// in the report immediately after the "pass and fail counts setup" - its ok.
		section("pass and fail counts", function() {

					test("getPassFailCount", function() {
							var pfCount = Tarsy.getPassFailCount(thisSection)
							assert.equal(pfCount.pass, 3)
							assert.equal(pfCount.fail, 0)
						})
			})
	}) // end of then

section("timeout tests and options", function() {

		// returns a promise that resolves after then specified number of milliseconds
		function delay(ms)
		{
			return new Promise(function(resolve,reject) {
					setTimeout(resolve,ms)
				})
		}

		// The default timeout is 5 seconds.  So this should pass
		test("4 second delay", function() {
				return delay(4000)
			})

		test("6 second delay with 7 second timeout option", function() {
				return delay(6000)
			}, { timeout: 7000 })
})

section("asynchronous testing", function() {

		var asyncCounter = 1

		// 3 tests, should run simultaneously and thus asyncCounter will be 1 each time
		test("async test 1", function() {
			assert.equal(asyncCounter,1)
			return delay(1000)
				.then(function() { asyncCounter++})
		})

		test("async test 2", function() {
			assert.equal(asyncCounter,1)
			return delay(1000)
				.then(function() { asyncCounter++})
		})

		test("async test 3", function() {
			assert.equal(asyncCounter,1)
			return delay(1000)
				.then(function() { asyncCounter++})
		})
})

section("synchronous testing", function() {

		var syncCounter = 1

		// 3 tests, should run in series and thus syncCounter will be 1,2,3 respectively
		test("sync test 1", function() {
			assert.equal(syncCounter,1)
			return delay(1000)
				.then(function() { syncCounter++})
		})

		test("sync test 2", function() {
			assert.equal(syncCounter,2)
			return delay(1000)
				.then(function() { syncCounter++})
		})

		test("sync test 3", function() {
			assert.equal(syncCounter,3)
			return delay(1000)
				.then(function() { syncCounter++})
		})
}, { async: false })

section("Adding Tests Asynchronously", function(ataSection) {

		return new Promise(function(resolve,reject) {
				setTimeout(function() {
						test("ATA test 1", function() { assert(true) }, {section: ataSection})
						resolve()
					}, 300)
			})

})

// returns a promise that resolves after then specified number of milliseconds
function delay(ms)
{
	return new Promise(function(resolve,reject) {
			setTimeout(resolve,ms)
		})
}
