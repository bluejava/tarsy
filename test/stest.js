section("full", function() {

section("s1", function() {
	test("t1", function() { return delay(100) })
	test("t2", function() { return delay(100) })
	test("t3", function() { return delay(100) })
})

section("s2", function() {
	test("t4", function() { return delay(100) })
	test("t5", function() { return delay(100) })
	test("t6", function() { return delay(100) })
})

}, {async: false})

function delay(ms)
{
	return new Promise(function(y) {
		setTimeout(y,ms)
		})
}
