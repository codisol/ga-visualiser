export class Multivector {
    public components: Float64Array

    // Static Table used for generation
    private static readonly BASIS_BITMASKS = [0b0000, 0b0001, 0b0010, 0b0100, 0b1000, 0b0011, 0b0101, 0b1001, 0b0110, 0b1100, 0b1010, 0b0111, 0b1101, 0b1011, 0b1110, 0b1111]
    private static readonly BASIS_LABELS = [
        "1", "e0", "e1", "e2", "e3", "e01", "e02", "e03", "e12", "e23", "e31", "e012", "e023", "e031", "e123", "e0123"
    ]
    private static readonly BITMASK_TO_INDEX: Map<number, number> = new Map()
    private static readonly SIGNATURE = [0, 1, 1, 1]

    private static readonly FLIPPED_MASKS = new Set([10, 11]);

    private static readonly MUL_INDEX_TABLE: Uint8Array = new Uint8Array(16 * 16)
    private static readonly MUL_SIGN_TABLE: Int8Array = new Int8Array(16 * 16)

    private static readonly WEDGE_INDEX_TABLE: Uint8Array = new Uint8Array(16 * 16)
    private static readonly WEDGE_SIGN_TABLE: Int8Array = new Int8Array(16 * 16)

    private static readonly GRADE_TABLE: Uint8Array = new Uint8Array(16)

    /**
     * Creates a new 3D PGA Multivector.
     * @param components An 16-element array. If not provided, a zero multivector is created.
     */
    constructor(components?: Float64Array | number[]) {
        if (components) {
            this.components = new Float64Array(components)
        } else {
            this.components = new Float64Array(16)
        }
    }

    static {
        for (let i = 0; i < 16; i++) {
            const bitmask = this.BASIS_BITMASKS[i]
            this.BITMASK_TO_INDEX.set(bitmask, i)
            this.GRADE_TABLE[i] = (bitmask.toString(2).match(/1/g) || []).length
        }

        for (let i = 0; i < 16; i++) {
            for (let j = 0; j < 16; j++) {
                const bitmaskA = this.BASIS_BITMASKS[i]
                const bitmaskB = this.BASIS_BITMASKS[j]

                const signA = this.FLIPPED_MASKS.has(bitmaskA) ? -1 : 1;
                const signB = this.FLIPPED_MASKS.has(bitmaskB) ? -1 : 1;
                const inputSign = signA * signB;

                const { bitmask: mulBitmask, sign: mulSignRaw } = this.geometricProduct(bitmaskA, bitmaskB)
                const mulIndex = this.BITMASK_TO_INDEX.get(mulBitmask)!
                const mulResSign = this.FLIPPED_MASKS.has(mulBitmask) ? -1 : 1;
                this.MUL_INDEX_TABLE[i * 16 + j] = mulIndex
                this.MUL_SIGN_TABLE[i * 16 + j] = mulSignRaw * inputSign * mulResSign

                const { bitmask: wedgeBitmask, sign: wedgeSignRaw } = this.outerProduct(bitmaskA, bitmaskB)
                const wedgeIndex = this.BITMASK_TO_INDEX.get(wedgeBitmask)!
                const wedgeResSign = this.FLIPPED_MASKS.has(wedgeBitmask) ? -1 : 1;
                this.WEDGE_INDEX_TABLE[i * 16 + j] = wedgeIndex
                this.WEDGE_SIGN_TABLE[i * 16 + j] = wedgeSignRaw * inputSign * wedgeResSign;
            }
        }

        /*
        for (let i = 0; i < 16; i++) {
            const base = Multivector.BASIS_LABELS
            let indices = Multivector.WEDGE_INDEX_TABLE.slice(i * 16, i * 16 + 16)
            let labels = Array.from(indices, (index) => { return Multivector.BASIS_LABELS[index] })
            let signs = Multivector.WEDGE_SIGN_TABLE.slice(i * 16, i * 16 + 16)
            console.log(labels.map((value, index)=>{return `${base[i]}^${base[index]}=${[value, signs[index]]}`}))
            }
            */
        // for (let i = 0; i < 16; i++) {
        //     const base = Multivector.BASIS_LABELS
        //     let indices = Multivector.MUL_INDEX_TABLE.slice(i * 16, i * 16 + 16)
        //     let labels = Array.from(indices, (index) => { return Multivector.BASIS_LABELS[index] })
        //     let signs = Multivector.MUL_SIGN_TABLE.slice(i * 16, i * 16 + 16)
        //     console.log(labels.map((value, index)=>{return `${base[i]}*${base[index]}=${[value, signs[index]]}`}))
        // }
    }

    private static geometricProduct(bitmaskA: number, bitmaskB: number): { bitmask: number; sign: number } {
        const listA: number[] = []
        const listB: number[] = []
        for (let k = 0; k < 4; k++) {
            if ((bitmaskA & (1 << k)) !== 0) listA.push(k)
            if ((bitmaskB & (1 << k)) !== 0) listB.push(k)
        }

        const list = listA.concat(listB)
        let sign = 1

        for (let i = 0; i < list.length; i++) {
            for (let j = 0; j < list.length - 1 - i; j++) {
                if (list[j] > list[j + 1]) {
                    const temp = list[j]
                    list[j] = list[j + 1]
                    list[j + 1] = temp
                    sign *= -1
                }
            }
        }

        const finalList: number[] = []
        let i = 0
        while (i < list.length) {
            if (i < list.length - 1 && list[i] === list[i + 1]) {
                const k = list[i]
                const metric = this.SIGNATURE[k]
                if (metric === 0) return { bitmask: 0, sign: 0 }
                sign *= metric
                i += 2
            } else {
                finalList.push(list[i])
                i++
            }
        }

        let resultBitmask = 0
        for (const k of finalList) {
            resultBitmask |= (1 << k)
        }

        return { bitmask: resultBitmask, sign }
    }

    private static outerProduct(bitmaskA: number, bitmaskB: number): { bitmask: number, sign: number } {
        if ((bitmaskA & bitmaskB) !== 0) return { bitmask: 0, sign: 0 };
        return this.geometricProduct(bitmaskA, bitmaskB);
    }

    /**
     * Creates a scalar.
     * @param s Scalar
     */
    static scalar(s: number): Multivector {
        const multivector = new Multivector()
        multivector.components[0] = s
        return multivector
    }

    /**
     * Creates a plane (vector).
     * @param nx Normal x
     * @param ny Normal y
     * @param nz Normal z
     * @param d Distance from origin
     */
    static plane(nx: number, ny: number, nz: number, d: number): Multivector {
        const multivector = new Multivector()
        multivector.components[1] = d
        multivector.components[2] = nx
        multivector.components[3] = ny
        multivector.components[4] = nz
        return multivector
    }

    /**
     * Creates a point (trivector)
     * @param x coordinate
     * @param y coordinate
     * @param z coordinate
     */
    static point(x: number, y: number, z: number): Multivector {
        const multivector = new Multivector()
        multivector.components[14] = 1
        multivector.components[12] = x
        multivector.components[13] = y
        multivector.components[11] = z
        return multivector
    }

    /** The Pseudoscalar constant (e0123) */
    static I = new Multivector().set(15, 1)

    /** The Origin point (e123) */
    static Origin = new Multivector().set(14, 1)

    // --- Core Operation ---

    mul(other: Multivector): Multivector {
        const a = this.components
        const b = other.components
        const c = new Float64Array(16)

        for (let i = 0; i < 16; i++) {
            if (a[i] === 0) continue
            for (let j = 0; j < 16; j++) {
                if (b[j] === 0) continue

                const table_index = i * 16 + j
                const resultIndex = Multivector.MUL_INDEX_TABLE[table_index]
                const sign = Multivector.MUL_SIGN_TABLE[table_index]
                // if (table_index == 34) {
                //     for (let i = 0; i < 16; i++) {
                //         const base = Multivector.BASIS_LABELS
                //         let indices = Multivector.MUL_INDEX_TABLE.slice(i * 16, i * 16 + 16)
                //         let labels = Array.from(indices, (index) => { return Multivector.BASIS_LABELS[index] })
                //         let signs = Multivector.MUL_SIGN_TABLE.slice(i * 16, i * 16 + 16)
                //         console.log(labels.map((value, index) => { return `${base[i]}*${base[index]}=${[value, signs[index]]}` }))
                //     }
                // }
                // console.log(`${table_index}, ${resultIndex}, ${sign}`)

                c[resultIndex] += sign * a[i] * b[j]
            }
        }
        // console.log(c.toString())
        return new Multivector(c)
    }

    wedge(other: Multivector): Multivector {
        const a = this.components
        const b = other.components
        const c = new Float64Array(16)

        for (let i = 0; i < 16; i++) {
            if (a[i] === 0) continue
            for (let j = 0; j < 16; j++) {
                if (b[j] === 0) continue

                const table_index = i * 16 + j
                const resultIndex = Multivector.WEDGE_INDEX_TABLE[table_index]
                const sign = Multivector.WEDGE_SIGN_TABLE[table_index]

                if (sign === 0) continue
                c[resultIndex] += sign * a[i] * b[j]
            }
        }
        return new Multivector(c)
    }

    add(other: Multivector): Multivector {
        const c = new Float64Array(16)
        for (let i = 0; i < 16; i++) {
            c[i] = this.components[i] + other.components[i]
        }
        return new Multivector(c)
    }

    sub(other: Multivector): Multivector {
        const c = new Float64Array(16)
        for (let i = 0; i < 16; i++) {
            c[i] = this.components[i] - other.components[i]
        }
        return new Multivector(c)
    }

    scale(scalar: number): Multivector {
        const c = new Float64Array(16)
        for (let i = 0; i < 16; i++) {
            c[i] = this.components[i] * scalar
        }
        return new Multivector(c)
    }

    // --- Unary Operations ---

    reverse(): Multivector {
        const c = new Float64Array(this.components)
        for (let i = 0; i < 16; i++) {
            const grade = Multivector.GRADE_TABLE[i]
            if (grade === 2 || grade === 3) {
                c[i] = -c[i]
            }
        }
        return new Multivector(c)
    }

    dual(): Multivector {
        return this.mul(Multivector.I)
    }

    grade(grade: number): Multivector {
        const multivector = new Multivector()
        for (let i = 0; i < 16; i++) {
            if (Multivector.GRADE_TABLE[i] === grade) multivector.components[i] = this.components[i]
        }
        return multivector
    }

    // --- Transformations ---

    /**
     * Creates a rotor (for rotation around an axis).
     * @param angle The angle of rotation in radians
     * @param line The line of rotation (a normalized bivector)
     */
    static rotor(angle: number, line: Multivector): Multivector {
        const halfAngle = angle / 2
        const scalarPart = Multivector.scalar(Math.cos(halfAngle))
        const bivectorPart = line.scale(Math.sin(halfAngle))

        return scalarPart.sub(bivectorPart)
    }

    /**
     * Creates a translator (for translation)
     * @param x Translation distance
     * @param y Translation distance
     * @param z Translation distance
     */
    static translator(x: number, y: number, z: number): Multivector {
        const multivector = new Multivector()
        multivector.components[0] = 1
        multivector.components[5] = x / 2
        multivector.components[6] = y / 2
        multivector.components[7] = z / 2
        return multivector
    }

    applyMotor(motor: Multivector): Multivector {
        const motor_inverse = motor.reverse()
        return motor.mul(this).mul(motor_inverse)
    }

    // --- Utility ---

    set(index: number, value: number): Multivector {
        this.components[index] = value
        return this
    }

    toString(): string {
        const parts = []
        for (let i = 0; i < 16; i++) {
            if (Math.abs(this.components[i]) > 1e-6) {
                const value = this.components[i].toFixed(4)
                parts.push(`${value}*${Multivector.BASIS_LABELS[i]}`)
            }
        }
        if (parts.length === 0) return "0"
        return parts.join(" + ")
    }
}
