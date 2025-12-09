import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { Multivector } from './ga'
import './ga.test'

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

let offset = new THREE.Vector3(0, 0, 0)

window.addEventListener('click', (event) => {
    setPickPosition(event)
    offset.set(pickPosition.x, pickPosition.y, 0)
})

window.addEventListener('mousedown', (event) => {
    if (pickHelper.pickedObject) {
        pickHelper.pickedObject.position.x += offset.x
        event
    }
})

// window.addEventListener('pointerover', setPickPosition)
// window.addEventListener('mouseover', setPickPosition)
// window.addEventListener('mousemove', setPickPosition)
// window.addEventListener('mouseleave', clearPickPosition)
// window.addEventListener('mouseout', clearPickPosition)
