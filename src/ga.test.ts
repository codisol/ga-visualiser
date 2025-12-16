import { describe, expect, test } from 'vitest'
import { Multivector } from "./ga";

describe("GA Test", () => {
    test("Basis Properties", () => {
        const o = new Multivector().set(0, 0)
        const e1 = new Multivector().set(2, 1)
        const e2 = new Multivector().set(3, 1)
        const e3 = new Multivector().set(4, 1)
        const e0 = new Multivector().set(1, 1)

        expect(e1.mul(e1).components[0]).toBeCloseTo(1)
        expect(e2.mul(e2).components[0]).toBeCloseTo(1)
        expect(e3.mul(e3).components[0]).toBeCloseTo(1)
        expect(e0.mul(e0).components[0]).toBeCloseTo(0)
        expect(o.mul(o).components[0]).toBeCloseTo(0)

        const e1e2 = e1.mul(e2)
        const e2e1 = e2.mul(e1)
        expect(e1e2.components[8]).toBeCloseTo(1)
        expect(e2e1.components[8]).toBeCloseTo(-1)

        const oe0 = o.mul(e0)
        expect(oe0.components[1]).toBeCloseTo(0)
    })

    test("Cyclic Basis Handling", () => {
        const e1 = new Multivector().set(2, 1)
        const e3 = new Multivector().set(4, 1)
        
        // e1 ^ e3 = e13 = -e31 (index 10)
        const res = e1.wedge(e3)
        expect(res.components[10]).toBeCloseTo(-1)
    })

    test("Geometric Product Mechanics", ()=>{
        const e1 = new Multivector().set(2, 1)
        const e12 = new Multivector().set(8, 1)

        const result = e1.mul(e12)
        expect(result.components[3]).toBeCloseTo(1)
    })
    
    test("Geometry Factories", ()=>{
        const point = Multivector.point(1, 2, 3)
        
        expect(point.components[14]).toBeCloseTo(1)
        expect(point.components[12]).toBeCloseTo(-1)
        expect(point.components[13]).toBeCloseTo(-2)
        expect(point.components[11]).toBeCloseTo(-3)
    })

    test("Translation (Move point +2 in X)", () => {
        const point = Multivector.point(1, 1, 0)
        const translator = Multivector.translator(2, 0, 0)
        // console.log(translator.toString())
        const new_point = point.applyMotor(translator)

        expect(new_point.components[14]).toBeCloseTo(1)
        expect(new_point.components[12]).toBeCloseTo(-3)
        expect(new_point.components[13]).toBeCloseTo(-1)
    })

    test("Rotation (Rotate point 90 deg around Z)", () => {
        const point = Multivector.point(1, 0, 0)
        const zAxis = new Multivector().set(8, 1) // e12
        const rotor = Multivector.rotor(Math.PI / 2, zAxis)
        
        const new_point = point.applyMotor(rotor)

        // (1,0,0) -> (0,1,0)
        expect(new_point.components[12]).toBeCloseTo(0)
        expect(new_point.components[13]).toBeCloseTo(-1) // y=1 -> -1
        expect(new_point.components[11]).toBeCloseTo(0)
    })

    test("Motor Composition (Translate then Rotate)", () => {
        const point = Multivector.point(0, 0, 0)
        const T = Multivector.translator(2, 0, 0)
        const R = Multivector.rotor(Math.PI / 2, new Multivector().set(8, 1))
        
        // M = R * T
        const M = R.mul(T)
        const new_point = point.applyMotor(M)

        // (0,0,0) -> (2,0,0) -> (0,2,0)
        expect(new_point.components[12]).toBeCloseTo(0)
        expect(new_point.components[13]).toBeCloseTo(-2) // y=2 -> -2
    })
})