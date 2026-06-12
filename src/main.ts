import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { Multivector } from './ga'

const canvas = document.getElementById("main")!

const scene = new THREE.Scene()

const aspect = window.innerWidth / window.innerHeight
const camera = new THREE.PerspectiveCamera(90, aspect, 0.125, 1024)
camera.position.set(0, 8, 0)
camera.lookAt(0, 0, 0)

const controls = new OrbitControls(camera, canvas)
controls.target.set(0, 0, 0)
controls.update()

function addGridLines() {
    let grid = new THREE.GridHelper(100, 100, 0x7f7f7f, 0x3f3f3f)
    scene.add(grid)
}
addGridLines()

class PickHelper {
    raycaster: THREE.Raycaster
    pickedObject: THREE.Object3D | null

    constructor() {
        this.raycaster = new THREE.Raycaster()
        this.pickedObject = null
    }

    pick(normalisedPosition: THREE.Vector2, scene: THREE.Scene, camera: THREE.Camera) {
        this.raycaster.setFromCamera(normalisedPosition, camera)

        if (this.pickedObject) {
            if (this.pickedObject instanceof THREE.Mesh) {
                this.pickedObject.material.opacity = 1
                this.pickedObject = null
            }
        }

        const intersectedObjects = this.raycaster.intersectObjects(scene.children)
        if (intersectedObjects.length) {
            if (intersectedObjects[0].object instanceof THREE.Mesh) {
                intersectedObjects[0].object.material.opacity = 0.75
                this.pickedObject = intersectedObjects[0].object
            }
        } else {
            clearPickPosition()
        }
    }
}

const pickHelper = new PickHelper()
const pickPosition = new THREE.Vector2(Infinity, Infinity)

function getCanvasRelativePosition(event: MouseEvent | PointerEvent) {
    const canvasRectangle = canvas.getBoundingClientRect()
    return new THREE.Vector2(
        (event.clientX - canvasRectangle.left) * canvas.clientWidth / canvasRectangle.width,
        (event.clientY - canvasRectangle.top) * canvas.clientHeight / canvasRectangle.height,
    )
}

function setPickPosition(event: MouseEvent | PointerEvent) {
    const position = getCanvasRelativePosition(event)
    pickPosition.x = (position.x / canvas.clientWidth) * 2 - 1
    pickPosition.y = (position.y / canvas.clientHeight) * -2 + 1
}

function clearPickPosition() {
    pickPosition.set(Infinity, Infinity)
}

const renderer = new THREE.WebGLRenderer({ antialias: true, canvas })
renderer.clear()

function resizeRendererToDisplaySize(renderer: THREE.WebGLRenderer) {
    const canvas = renderer.domElement
    const width = canvas.clientWidth
    const height = canvas.clientHeight
    const needResize = canvas.width != width || canvas.height != height
    if (needResize) renderer.setSize(width, height, false)
    return needResize
}

function render() {
    if (resizeRendererToDisplaySize(renderer)) {
        if (camera instanceof THREE.OrthographicCamera) {
            camera.left = canvas.clientWidth / -2
            camera.right = canvas.clientWidth / 2
            camera.top = canvas.clientHeight / 2
            camera.bottom = canvas.clientHeight / -2
        } else
            camera.aspect = canvas.clientWidth / canvas.clientHeight;
        camera.updateProjectionMatrix()
    }

    pickHelper.pick(pickPosition, scene, camera)
    controls.update()
    renderer.render(scene, camera)
}

renderer.setAnimationLoop(render)

const raycaster = new THREE.Raycaster()
const dragPlane = new THREE.Plane()
const planeIntersect = new THREE.Vector3()
const dragOffset = new THREE.Vector3()
let isDragging = false
let draggedObject: THREE.Mesh | null = null

const selectionHelper = new THREE.BoxHelper(new THREE.Object3D(), 0xffff00)
selectionHelper.visible = false
scene.add(selectionHelper)
let selectedRow: HTMLElement | null = null

// Registry to store named variables for operations
const variables = new Map<string, { mv: Multivector, mesh: THREE.Object3D }>()

const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()

function playClickSound() {
    if (audioCtx.state === 'suspended') {
        audioCtx.resume()
    }
    const oscillator = audioCtx.createOscillator()
    const gainNode = audioCtx.createGain()

    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(600, audioCtx.currentTime)
    oscillator.frequency.exponentialRampToValueAtTime(300, audioCtx.currentTime + 0.1)

    gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1)

    oscillator.connect(gainNode)
    gainNode.connect(audioCtx.destination)

    oscillator.start()
    oscillator.stop(audioCtx.currentTime + 0.1)
}

window.addEventListener('pointerdown', (event) => {
    setPickPosition(event)
    raycaster.setFromCamera(pickPosition, camera)
    const intersects = raycaster.intersectObjects(scene.children)
    const found = intersects.find(i => i.object instanceof THREE.Mesh)

    if (found) {
        playClickSound()
        isDragging = true
        draggedObject = found.object as THREE.Mesh
        controls.enabled = false

        const normal = new THREE.Vector3()
        camera.getWorldDirection(normal)
        dragPlane.setFromNormalAndCoplanarPoint(normal, found.point)
        raycaster.ray.intersectPlane(dragPlane, planeIntersect)
        dragOffset.subVectors(draggedObject.position, planeIntersect)
    }
})

window.addEventListener('pointermove', (event) => {
    setPickPosition(event)

    if (isDragging && draggedObject) {
        raycaster.setFromCamera(pickPosition, camera)
        if (raycaster.ray.intersectPlane(dragPlane, planeIntersect)) {
            const target = new THREE.Vector3().addVectors(planeIntersect, dragOffset)

            // Use GA to calculate the new position via translation
            const currentPoint = Multivector.point(draggedObject.position.x, draggedObject.position.y, draggedObject.position.z)
            
            const dx = target.x - draggedObject.position.x
            const dy = target.y - draggedObject.position.y
            const dz = target.z - draggedObject.position.z
            const translator = Multivector.translator(dx, dy, dz)

            const newPoint = currentPoint.applyMotor(translator)

            draggedObject.position.set(-newPoint.components[12], -newPoint.components[13], -newPoint.components[11])

            if (draggedObject.userData.type && variables.has(draggedObject.userData.type)) {
                variables.get(draggedObject.userData.type)!.mv = newPoint
            }

            if (draggedObject.userData.uiInput) {
                const { x, y, z } = draggedObject.position
                draggedObject.userData.uiInput.value = `${draggedObject.userData.type} ${x.toFixed(2)} ${y.toFixed(2)} ${z.toFixed(2)}`
            }

            if (draggedObject.userData.dependents) {
                for (const dep of draggedObject.userData.dependents) {
                    updateDependent(dep)
                }
            }

            if (selectionHelper.visible) selectionHelper.update()
        }
    }
})

window.addEventListener('pointerup', () => {
    isDragging = false
    draggedObject = null
    controls.enabled = true
})

window.addEventListener('pointerleave', clearPickPosition)

const inputField = document.querySelector('.math-input') as HTMLInputElement

if (inputField) {
    inputField.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            const text = inputField.value.trim()
            const equationParts = text.replace(/([&^|*+-])/g, " $1 ").trim().split(/\s+/)
            const operators = ['&', '^', '*', '|', '+', '-']

            if (text.includes('=') || (equationParts.length === 3 && operators.includes(equationParts[1]))) {
                handleEquation(text)
                inputField.value = ''
                return
            }
            const parts = text.split(/\s+/)
            const type = parts[0].toLowerCase()

            let geometry
            if (type === 'cube') geometry = new THREE.BoxGeometry(2, 2, 2)
            else if (type === 'point') geometry = new THREE.SphereGeometry(0.5, 32, 16)
            else if (type === 'line') {
                if (parts.length < 7) return
                const x1 = parseFloat(parts[1]) || 0
                const y1 = parseFloat(parts[2]) || 0
                const z1 = parseFloat(parts[3]) || 0
                const x2 = parseFloat(parts[4]) || 0
                const y2 = parseFloat(parts[5]) || 0
                const z2 = parseFloat(parts[6]) || 0

                const pointGeo = new THREE.SphereGeometry(0.5, 16, 8)
                const pointMat = new THREE.MeshBasicMaterial({ color: 0xff0000 })

                const p1Name = getNextName('P')
                const p1Mesh = new THREE.Mesh(pointGeo, pointMat)
                p1Mesh.position.set(x1, y1, z1)
                scene.add(p1Mesh)
                const p1 = Multivector.point(x1, y1, z1)
                variables.set(p1Name, { mv: p1, mesh: p1Mesh })
                createObjectUI(p1Name, `point ${x1} ${y1} ${z1}`, p1Mesh)

                const p2Name = getNextName('P')
                const p2Mesh = new THREE.Mesh(pointGeo, pointMat)
                p2Mesh.position.set(x2, y2, z2)
                scene.add(p2Mesh)
                const p2 = Multivector.point(x2, y2, z2)
                variables.set(p2Name, { mv: p2, mesh: p2Mesh })
                createObjectUI(p2Name, `point ${x2} ${y2} ${z2}`, p2Mesh)

                const lineMV = Multivector.line(p1, p2)
                
                const lineObj = createLineFromMultivector(lineMV)
                if (lineObj) {
                    const lineName = getNextName('L')
                    scene.add(lineObj)
                    variables.set(lineName, { mv: lineMV, mesh: lineObj })
                    createObjectUI(lineName, text, lineObj)
                    
                    p1Mesh.userData.dependents = [lineObj]
                    p2Mesh.userData.dependents = [lineObj]
                    lineObj.userData.parents = [p1Mesh, p2Mesh]

                    inputField.value = ''
                }
                return
            }
            else if (type === 'plane') {
                if (parts.length < 5) return
                const nx = parseFloat(parts[1]) || 0
                const ny = parseFloat(parts[2]) || 0
                const nz = parseFloat(parts[3]) || 0
                const d = parseFloat(parts[4]) || 0

                const planeMV = Multivector.plane(nx, ny, nz, d)
                const planeMesh = createPlaneFromMultivector(planeMV)
                
                const name = getNextName('Pl')
                scene.add(planeMesh)
                variables.set(name, { mv: planeMV, mesh: planeMesh })
                createObjectUI(name, text, planeMesh)
                
                inputField.value = ''
                return
            }

            if (geometry) {
                const material = new THREE.MeshBasicMaterial({
                    color: Math.random() * 0xffffff,
                    transparent: true,
                    opacity: 0.8
                })
                const mesh = new THREE.Mesh(geometry, material)
                mesh.position.set(parseFloat(parts[1]) || 0, parseFloat(parts[2]) || 0, parseFloat(parts[3]) || 0)
                scene.add(mesh)
                
                // Register variable if it is a point
                if (type === 'point') {
                    const x = parseFloat(parts[1]) || 0
                    const y = parseFloat(parts[2]) || 0
                    const z = parseFloat(parts[3]) || 0
                    const mv = Multivector.point(x, y, z)
                    const name = getNextName('P')
                    variables.set(name, { mv, mesh })
                    createObjectUI(name, text, mesh)
                } else {
                    createObjectUI(type, text, mesh)
                }
                
                inputField.value = ''
            }
        }
    })
}

function getNextName(prefix: string): string {
    let i = 1
    while (variables.has(`${prefix}${i}`)) i++
    return `${prefix}${i}`
}

function handleEquation(text: string) {
    let lhs = ''
    let rhs = ''

    if (text.includes('=')) {
        const parts = text.split('=')
        lhs = parts[0].trim()
        rhs = parts[1].trim()
    } else {
        rhs = text.trim()
    }

    if (!rhs) return

    // Simple parser for binary operations: A op B
    // Supported ops: & (Join/Regressive), ^ (Wedge/Meet), * (Geometric), | (Projection)
    const tokens = rhs.replace(/([&^|*+-])/g, " $1 ").trim().split(/\s+/)
    if (tokens.length === 3) {
        const [op1Name, op, op2Name] = tokens
        const v1 = variables.get(op1Name)
        const v2 = variables.get(op2Name)

        if (v1 && v2) {
            let resultMultivector: Multivector | null = null

            // Check if operands are points for special handling
            const isV1Point = Math.abs(v1.mv.components[14]) > 1e-6
            const isV2Point = Math.abs(v2.mv.components[14]) > 1e-6

            if (op === '&') {
                // General Join (Regressive Product)
                // P & P -> Line
                // L & P -> Plane (or P & L)
                resultMultivector = v1.mv.dual().wedge(v2.mv.dual()).dual()
            } else if (op === '^') {
                // If both are points, wedge is 0, so we assume user meant join
                if (isV1Point && isV2Point) {
                    resultMultivector = Multivector.line(v1.mv, v2.mv)
                } else if (isLine(v1.mv) && isLine(v2.mv)) {
                    resultMultivector = intersectLines(v1.mv, v2.mv)
                } else {
                    resultMultivector = v1.mv.wedge(v2.mv)
                }
            } else if (op === '|') {
                // Projection: (P . L) ^ L
                if (isV1Point && !isV2Point) {
                    // Project v1 (Point) onto v2 (Line)
                    const plane = v1.mv.mul(v2.mv)
                    resultMultivector = plane.wedge(v2.mv)
                }
            } else if (op === '*') resultMultivector = v1.mv.mul(v2.mv)
            else if (op === '+') resultMultivector = v1.mv.add(v2.mv)
            else if (op === '-') resultMultivector = v1.mv.sub(v2.mv)

            if (resultMultivector) {
                const mesh = visualizeMultivector(resultMultivector)
                if (mesh) {
                    if (!lhs) {
                        if (mesh instanceof THREE.Line) lhs = getNextName('L')
                        else if (mesh instanceof THREE.Mesh && mesh.geometry instanceof THREE.SphereGeometry) lhs = getNextName('P')
                        else if (mesh instanceof THREE.Mesh && mesh.geometry instanceof THREE.PlaneGeometry) lhs = getNextName('Pl')
                        else lhs = getNextName('O')
                    }

                    scene.add(mesh)
                    variables.set(lhs, { mv: resultMultivector, mesh })
                    
                    const displayText = text.includes('=') ? text : `${lhs} = ${rhs}`
                    createObjectUI(lhs, displayText, mesh)

                    const confirmDialog = document.getElementById('confirm-dialog')
                    // if (confirmDialog) confirmDialog.style.display = 'block'

                    // Store operation for updates
                    mesh.userData.op = op

                    // Add dependency for automatic updates if the parents are points
                    // Case 1: Point & Point -> Line
                    if (isV1Point && isV2Point && (op === '&' || op === '^')) {
                        if (!v1.mesh.userData.dependents) v1.mesh.userData.dependents = []
                        v1.mesh.userData.dependents.push(mesh)
                        if (!v2.mesh.userData.dependents) v2.mesh.userData.dependents = []
                        v2.mesh.userData.dependents.push(mesh)
                        mesh.userData.parents = [v1.mesh, v2.mesh]
                    }
                    // Case 2: Line ^ Line -> Point (Intersection)
                    else if (!isV1Point && !isV2Point && op === '^') {
                        if (!v1.mesh.userData.dependents) v1.mesh.userData.dependents = []
                        v1.mesh.userData.dependents.push(mesh)
                        if (!v2.mesh.userData.dependents) v2.mesh.userData.dependents = []
                        v2.mesh.userData.dependents.push(mesh)
                        mesh.userData.parents = [v1.mesh, v2.mesh]
                    }
                    // Case 3: Point | Line -> Point (Projection)
                    else if (isV1Point && !isV2Point && op === '|') {
                        if (!v1.mesh.userData.dependents) v1.mesh.userData.dependents = []
                        v1.mesh.userData.dependents.push(mesh)
                        if (!v2.mesh.userData.dependents) v2.mesh.userData.dependents = []
                        v2.mesh.userData.dependents.push(mesh)
                        mesh.userData.parents = [v1.mesh, v2.mesh]
                    }
                    // Case 4: Line & Point (or Point & Line) -> Plane
                    else if (((!isV1Point && isV2Point) || (isV1Point && !isV2Point)) && op === '&') {
                        if (!v1.mesh.userData.dependents) v1.mesh.userData.dependents = []
                        v1.mesh.userData.dependents.push(mesh)
                        if (!v2.mesh.userData.dependents) v2.mesh.userData.dependents = []
                        v2.mesh.userData.dependents.push(mesh)
                        mesh.userData.parents = [v1.mesh, v2.mesh]
                    }
                }
            }
        }
    }
}

function visualizeMultivector(mv: Multivector): THREE.Object3D | null {
    const mag1 = Math.abs(mv.components[1]) + Math.abs(mv.components[2]) + Math.abs(mv.components[3]) + Math.abs(mv.components[4])
    const mag2 = Math.abs(mv.components[5]) + Math.abs(mv.components[6]) + Math.abs(mv.components[7]) + Math.abs(mv.components[8]) + Math.abs(mv.components[9]) + Math.abs(mv.components[10])
    const mag3 = Math.abs(mv.components[11]) + Math.abs(mv.components[12]) + Math.abs(mv.components[13]) + Math.abs(mv.components[14])

    // Identify dominant grade
    if (mag1 > mag2 && mag1 > mag3 && mag1 > 1e-6) {
        return createPlaneFromMultivector(mv)
    }

    if (mag2 > mag1 && mag2 > mag3 && mag2 > 1e-6) {
        return createLineFromMultivector(mv)
    }

    if (mag3 > mag1 && mag3 > mag2 && mag3 > 1e-6) {
        const p = mv
        if (Math.abs(p.components[14]) < 1e-6) return null
        const geometry = new THREE.SphereGeometry(0.5, 32, 16)
        const material = new THREE.MeshBasicMaterial({ color: Math.random() * 0xffffff })
        const mesh = new THREE.Mesh(geometry, material)
        mesh.position.set(-p.components[12]/p.components[14], -p.components[13]/p.components[14], -p.components[11]/p.components[14])
        return mesh
    }
    return null
}

function createObjectUI(label: string, command: string, mesh: THREE.Object3D) {
    const row = document.createElement('div')
    row.className = 'input-row'

    const labelDiv = document.createElement('div')
    labelDiv.className = 'input-label'
    labelDiv.textContent = label

    const inputDisplay = document.createElement('input')
    inputDisplay.type = 'text'
    inputDisplay.className = 'math-input'
    inputDisplay.value = command

    inputDisplay.addEventListener('change', () => {
        const parts = inputDisplay.value.trim().split(/\s+/)
        const x = parseFloat(parts[1])
        const y = parseFloat(parts[2])
        const z = parseFloat(parts[3])
        if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
            const p = Multivector.point(x, y, z)
            mesh.position.set(-p.components[12], -p.components[13], -p.components[11])
            if (selectionHelper.visible) selectionHelper.update()
        }
    })

    mesh.userData = { uiInput: inputDisplay, type: label }

    const deleteBtn = document.createElement('button')
    deleteBtn.className = 'delete-btn'
    deleteBtn.innerHTML = '&times;'
    deleteBtn.onclick = (e) => {
        e.stopPropagation()
        
        if (mesh.userData.dependents) {
            for (const dep of mesh.userData.dependents) {
                scene.remove(dep)
                if (dep.userData.uiInput) {
                    const depRow = dep.userData.uiInput.closest('.input-row')
                    if (depRow) depRow.remove()
                }
            }
        }

        scene.remove(mesh)
        if (variables.has(label)) variables.delete(label)
        row.remove()
        if (selectedRow === row) {
            selectionHelper.visible = false
            selectedRow = null
        }
    }

    row.addEventListener('click', () => {
        if (selectedRow) selectedRow.classList.remove('selected')
        row.classList.add('selected')
        selectedRow = row
        selectionHelper.setFromObject(mesh)
        selectionHelper.visible = true
    })

    row.appendChild(labelDiv)
    row.appendChild(inputDisplay)
    row.appendChild(deleteBtn)

    const mainInputRow = inputField.closest('.input-row')
    if (mainInputRow && mainInputRow.parentNode) {
        mainInputRow.parentNode.insertBefore(row, mainInputRow)
    }
}

function createLineFromMultivector(mv: Multivector): THREE.Line | null {
    const geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()])
    const material = new THREE.LineBasicMaterial({ color: Math.random() * 0xffffff })
    const line = new THREE.Line(geometry, material)

    updateLineFromMultivector(line, mv)

    if (!line.visible) return null
    return line
}

function updateLineFromMultivector(line: THREE.Line, mv: Multivector) {
    const dx = mv.components[9]
    const dy = mv.components[10]
    const dz = mv.components[8]
    const direction = new THREE.Vector3(dx, dy, dz)

    const mx = mv.components[5]
    const my = mv.components[6]
    const mz = mv.components[7]
    const moment = new THREE.Vector3(mx, my, mz)

    const lengthSq = direction.lengthSq()
    if (lengthSq < 1e-6) {
        line.visible = false
        return
    }
    line.visible = true

    const origin = new THREE.Vector3().crossVectors(direction, moment).divideScalar(lengthSq)
    const scale = 1000
    const pStart = new THREE.Vector3().copy(origin).addScaledVector(direction, scale)
    const pEnd = new THREE.Vector3().copy(origin).addScaledVector(direction, -scale)

    const positions = line.geometry.attributes.position.array as Float32Array
    positions[0] = pStart.x; positions[1] = pStart.y; positions[2] = pStart.z
    positions[3] = pEnd.x;   positions[4] = pEnd.y;   positions[5] = pEnd.z
    line.geometry.attributes.position.needsUpdate = true
    line.geometry.computeBoundingSphere()
}

function updateLineGeometry(line: THREE.Line, p1: THREE.Vector3, p2: THREE.Vector3) {
    const mv1 = Multivector.point(p1.x, p1.y, p1.z)
    const mv2 = Multivector.point(p2.x, p2.y, p2.z)
    const lineMV = Multivector.line(mv1, mv2)
    updateLineFromMultivector(line, lineMV)
}

function createPlaneFromMultivector(mv: Multivector): THREE.Mesh {
    const nx = mv.components[2]
    const ny = mv.components[3]
    const nz = mv.components[4]
    const d = mv.components[1]

    const normal = new THREE.Vector3(nx, ny, nz)
    const length = normal.length()
    
    // Normalize
    if (length > 1e-6) {
        normal.multiplyScalar(1/length)
    }
    const constant = d / length

    const geometry = new THREE.PlaneGeometry(10, 10)
    const material = new THREE.MeshBasicMaterial({ 
        color: Math.random() * 0xffffff, 
        side: THREE.DoubleSide, 
        transparent: true, 
        opacity: 0.3,
        depthWrite: false
    })
    const mesh = new THREE.Mesh(geometry, material)

    // Orient mesh: PlaneGeometry is in XY plane (normal Z). We align Z to our normal.
    const zAxis = new THREE.Vector3(0, 0, 1)
    mesh.quaternion.setFromUnitVectors(zAxis, normal)
    
    // Position: -constant * normal (PGA plane equation d*e0 + n*e_i corresponds to n.x + d = 0)
    mesh.position.copy(normal).multiplyScalar(-constant)

    return mesh
}

function updatePlaneGeometry(mesh: THREE.Mesh, mv: Multivector) {
    const nx = mv.components[2]
    const ny = mv.components[3]
    const nz = mv.components[4]
    const d = mv.components[1]

    const normal = new THREE.Vector3(nx, ny, nz).normalize()
    const length = Math.sqrt(nx*nx + ny*ny + nz*nz)
    const constant = d / length

    const zAxis = new THREE.Vector3(0, 0, 1)
    mesh.quaternion.setFromUnitVectors(zAxis, normal)
    mesh.position.copy(normal).multiplyScalar(-constant)
}

function getMultivectorFromMesh(mesh: THREE.Object3D): Multivector | null {
    // If it's a point (Mesh with sphere geometry)
    if (mesh instanceof THREE.Mesh && mesh.geometry instanceof THREE.SphereGeometry) {
        return Multivector.point(mesh.position.x, mesh.position.y, mesh.position.z)
    } 
    // If it's a line defined by parents
    else if (mesh instanceof THREE.Line && mesh.userData.parents) {
        const p1 = getMultivectorFromMesh(mesh.userData.parents[0])
        const p2 = getMultivectorFromMesh(mesh.userData.parents[1])
        if (p1 && p2) return Multivector.line(p1, p2)
    }
    // If it's a plane
    else if (mesh instanceof THREE.Mesh && mesh.geometry instanceof THREE.PlaneGeometry) {
        const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(mesh.quaternion)
        // d = - n . p
        const d = -normal.dot(mesh.position)
        return Multivector.plane(normal.x, normal.y, normal.z, d)
    }
    return null
}

function updateDependent(object: THREE.Object3D) {
    if (!object.userData.parents) return

    if (object instanceof THREE.Line) {
        const p1Obj = object.userData.parents[0]
        const p2Obj = object.userData.parents[1]

        // Check if parents are points (Standard Join)
        if (p1Obj.geometry instanceof THREE.SphereGeometry && p2Obj.geometry instanceof THREE.SphereGeometry) {
            updateLineGeometry(object, p1Obj.position, p2Obj.position)
        } else {
            // General case (e.g. Plane ^ Plane)
            const mv1 = getMultivectorFromMesh(p1Obj)
            const mv2 = getMultivectorFromMesh(p2Obj)
            const op = object.userData.op || '^'

            if (mv1 && mv2) {
                let result: Multivector | null = null
                if (op === '^') result = mv1.wedge(mv2)
                else if (op === '&') result = mv1.dual().wedge(mv2.dual()).dual()
                
                if (result) updateLineFromMultivector(object, result)
            }
        }
    } else if (object instanceof THREE.Mesh && object.geometry instanceof THREE.PlaneGeometry) {
        // Update Plane from (Line & Point) or (Point & Line)
        const op1 = getMultivectorFromMesh(object.userData.parents[0])
        const op2 = getMultivectorFromMesh(object.userData.parents[1])
        if (op1 && op2) {
            const planeMV = op1.dual().wedge(op2.dual()).dual()
            updatePlaneGeometry(object, planeMV)
        }
    } else if (object instanceof THREE.Mesh) { 
        // Update Point from two Lines (Meet)
        const l1 = getMultivectorFromMesh(object.userData.parents[0])
        const l2 = getMultivectorFromMesh(object.userData.parents[1])

        // Check if parents are Point and Line (Projection)
        const isP1Point = Math.abs(l1?.components[14] || 0) > 1e-6
        const isP2Point = Math.abs(l2?.components[14] || 0) > 1e-6
        
        if (l1 && l2) {
            let result: Multivector | null = null

            if (!isP1Point && !isP2Point) {
                if (isLine(l1) && isLine(l2)) {
                    result = intersectLines(l1, l2)
                } else {
                    result = l1.wedge(l2) // Line ^ Line
                }
            } else if (isP1Point && !isP2Point) {
                result = l1.mul(l2).wedge(l2) // Point | Line
            }

            // Check if intersection exists (w component != 0)
            if (result && Math.abs(result.components[14]) > 1e-6) {
                object.position.set(
                    -result.components[12]/result.components[14],
                    -result.components[13]/result.components[14],
                    -result.components[11]/result.components[14]
                )
                object.visible = true
                
                if (object.userData.uiInput) {
                    const { x, y, z } = object.position
                    object.userData.uiInput.value = `${object.userData.type} ${x.toFixed(2)} ${y.toFixed(2)} ${z.toFixed(2)}`
                }
            } else {
                object.visible = false // Lines are parallel or skew
            }
        }
    }

    if (object.userData.type && variables.has(object.userData.type)) {
        const mv = getMultivectorFromMesh(object)
        if (mv) {
            variables.get(object.userData.type)!.mv = mv
        }
    }

    // Recursively update children
    if (object.userData.dependents) {
        for (const dep of object.userData.dependents) {
            updateDependent(dep)
        }
    }
}

function isLine(mv: Multivector): boolean {
    const mag1 = Math.abs(mv.components[1]) + Math.abs(mv.components[2]) + Math.abs(mv.components[3]) + Math.abs(mv.components[4])
    const mag2 = Math.abs(mv.components[5]) + Math.abs(mv.components[6]) + Math.abs(mv.components[7]) + Math.abs(mv.components[8]) + Math.abs(mv.components[9]) + Math.abs(mv.components[10])
    const mag3 = Math.abs(mv.components[11]) + Math.abs(mv.components[12]) + Math.abs(mv.components[13]) + Math.abs(mv.components[14])
    return mag2 > mag1 && mag2 > mag3 && mag2 > 1e-6
}

function intersectLines(mv1: Multivector, mv2: Multivector): Multivector | null {
    const d1 = new THREE.Vector3(mv1.components[9], mv1.components[10], mv1.components[8])
    const m1 = new THREE.Vector3(mv1.components[5], mv1.components[6], mv1.components[7])
    const d2 = new THREE.Vector3(mv2.components[9], mv2.components[10], mv2.components[8])
    const m2 = new THREE.Vector3(mv2.components[5], mv2.components[6], mv2.components[7])

    const cross = new THREE.Vector3().crossVectors(d1, d2)
    const denom = cross.lengthSq()

    if (denom < 1e-6) return null // Parallel

    // Check coplanarity: d1.m2 + d2.m1 approx 0
    const coplanar = Math.abs(d1.dot(m2) + d2.dot(m1))
    if (coplanar > 1e-3) return null // Skew lines

    // Find point on L1 closest to L2
    const o1 = new THREE.Vector3().crossVectors(d1, m1).divideScalar(d1.lengthSq())
    const o2 = new THREE.Vector3().crossVectors(d2, m2).divideScalar(d2.lengthSq())
    
    const r = new THREE.Vector3().subVectors(o2, o1)
    const t = r.cross(d2).dot(cross) / denom
    
    const P = new THREE.Vector3().copy(o1).addScaledVector(d1, t)
    
    return Multivector.point(P.x, P.y, P.z)
}

const aboutBtn = document.getElementById('about-btn')
const aboutModal = document.getElementById('about-modal')
const closeBtn = document.querySelector('.close-btn') as HTMLElement

if (aboutBtn && aboutModal && closeBtn) {
    aboutBtn.addEventListener('click', () => {
        aboutModal.style.display = 'block'
    })

    closeBtn.addEventListener('click', () => {
        aboutModal.style.display = 'none'
    })

    window.addEventListener('click', (event) => {
        if (event.target === aboutModal) {
            aboutModal.style.display = 'none'
        }
    })
}
