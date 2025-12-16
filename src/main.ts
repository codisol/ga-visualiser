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

let cube = new THREE.Mesh(
    new THREE.BoxGeometry(4, 4, 4),
    new THREE.MeshBasicMaterial({ color: 0xbfbfbf, transparent: true })
)

scene.add(cube)

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

const selectionHelper = new THREE.BoxHelper(cube, 0xffff00)
selectionHelper.visible = false
scene.add(selectionHelper)
let selectedRow: HTMLElement | null = null

window.addEventListener('pointerdown', (event) => {
    setPickPosition(event)
    raycaster.setFromCamera(pickPosition, camera)
    const intersects = raycaster.intersectObjects(scene.children)
    const found = intersects.find(i => i.object instanceof THREE.Mesh)

    if (found) {
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

            draggedObject.position.set(newPoint.components[12], newPoint.components[13], newPoint.components[11])

            if (draggedObject.userData.uiInput) {
                const { x, y, z } = draggedObject.position
                draggedObject.userData.uiInput.value = `${draggedObject.userData.type} ${x.toFixed(2)} ${y.toFixed(2)} ${z.toFixed(2)}`
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
            const parts = text.split(/\s+/)
            const type = parts[0].toLowerCase()

            let geometry
            if (type === 'cube') geometry = new THREE.BoxGeometry(2, 2, 2)
            else if (type === 'sphere') geometry = new THREE.SphereGeometry(1.5, 32, 16)

            if (geometry) {
                const material = new THREE.MeshBasicMaterial({
                    color: Math.random() * 0xffffff,
                    transparent: true,
                    opacity: 0.8
                })
                const mesh = new THREE.Mesh(geometry, material)
                mesh.position.set(parseFloat(parts[1]) || 0, parseFloat(parts[2]) || 0, parseFloat(parts[3]) || 0)
                scene.add(mesh)

                createObjectUI(type, text, mesh)
                inputField.value = ''
            }
        }
    })
}

function createObjectUI(label: string, command: string, mesh: THREE.Mesh) {
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
            mesh.position.set(p.components[12], p.components[13], p.components[11])
            if (selectionHelper.visible) selectionHelper.update()
        }
    })

    mesh.userData = { uiInput: inputDisplay, type: label }

    const deleteBtn = document.createElement('button')
    deleteBtn.className = 'delete-btn'
    deleteBtn.innerHTML = '&times;'
    deleteBtn.onclick = (e) => {
        e.stopPropagation()
        scene.remove(mesh)
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
