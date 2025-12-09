import { describe, expect, test } from 'vitest'
import { Multivector } from "./ga";

describe("GA Test", () => {
    test("Basis Properties", () => {
        const e1 = new Multivector().set(2, 1)
        const e2 = new Multivector().set(3, 1)
        const e3 = new Multivector().set(4, 1)
        const e0 = new Multivector().set(1, 1)

        expect(e1.mul(e1).components[0]).toBeCloseTo(1)
        expect(e2.mul(e2).components[0]).toBeCloseTo(1)
        expect(e3.mul(e3).components[0]).toBeCloseTo(1)
        expect(e0.mul(e0).components[0]).toBeCloseTo(0)

        const e1e2 = e1.mul(e2)
        const e2e1 = e2.mul(e1)
        expect(e1e2.components[8]).toBeCloseTo(1)
        expect(e2e1.components[8]).toBeCloseTo(-1)
    })
})

class TestRunner {
    static passed = 0
    static failed = 0

    static assert(condition: boolean, message: string) {
        if (condition) {
            console.log(`✅ PASS: ${message}`)
            this.passed++
        } else {
            console.error(`❌ FAIL: ${message}`)
            this.failed++
        }
    }

    static assertCloseTo(actual: number, expected: number, message: string, tolerance = 1e-5) {
        if (Math.abs(actual - expected) < tolerance) {
            console.log(`✅ PASS: ${message} (Got ${actual.toFixed(4)})`)
            this.passed++
        } else {
            console.error(`❌ FAIL: ${message}`)
            console.error(`   Expected: ${expected}`)
            console.error(`   Actual:   ${actual}`)
            this.failed++
        }
    }

    static assertComponent(multivector: Multivector, index: number, expected: number, label: string) {
        const value = multivector.components[index]
        this.assertCloseTo(value, expected, `${label} [index ${index}] should be ${expected}`)
    }

    static summary() {
        console.log(`\n--- Test Summary ---`)
        console.log(`Total: ${this.passed + this.failed}`)
        console.log(`Passed: ${this.passed}`)
        console.log(`Failed: ${this.failed}`)
    }
}

console.log("Starting Tests\n")

{
    console.log("--- Test 1: Basis Properties ---")
    const e1 = new Multivector().set(2, 1)
    const e2 = new Multivector().set(3, 1)
    const e3 = new Multivector().set(4, 1)
    const e0 = new Multivector().set(1, 1)

    TestRunner.assertComponent(e1.mul(e1), 0, 1, "e1 * e1 = 1")
    TestRunner.assertComponent(e2.mul(e2), 0, 1, "e2 * e2 = 1")
    TestRunner.assertComponent(e3.mul(e3), 0, 1, "e3 * e3 = 1")
    TestRunner.assertComponent(e0.mul(e0), 0, 0, "e0 * e0 = 0")

    const e1e2 = e1.mul(e2)
    const e2e1 = e2.mul(e1)
    TestRunner.assertComponent(e1e2, 8, 1, "e1 * e2 = e12")
    TestRunner.assertComponent(e2e1, 8, -1, "e2 * e1 = -e12")
}

TestRunner.summary()
