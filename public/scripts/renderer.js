import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PLYLoader } from 'three/addons/loaders/PLYLoader.js';

const FILENAME = '/pointclouds/quest_scan_npy_optimized.ply';
const POINT_SIZE = 0.025;
const BACKGROUND_COLOR = 0x111111;

const scene = new THREE.Scene();
scene.background = new THREE.Color(BACKGROUND_COLOR);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 1.0, 2); 

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; 
controls.dampingFactor = 0.025;

const loader = new PLYLoader();
const infoDiv = document.getElementById('info');

loader.load(FILENAME, function (geometry) {
    
    const material = new THREE.PointsMaterial({
        size: POINT_SIZE,
        vertexColors: true, 
        sizeAttenuation: true 
    });

    geometry.center();
    const points = new THREE.Points(geometry, material);
    
    points.rotation.x = Math.PI; 
    scene.add(points);

    geometry.computeBoundingSphere();
    const radius = geometry.boundingSphere.radius;
    
    controls.target.set(0, 0, 0);
    camera.position.set(0, 0, radius * 1.5);
    controls.update();
    
    infoDiv.innerText = "Quest 3 Point Cloud Viewer";
    console.log("Point cloud loaded:", geometry);

}, (xhr) => {
    const percent = (xhr.loaded / xhr.total * 100).toFixed(0);
    infoDiv.innerText = `Loading point cloud: ${percent}%`;
}, (error) => {
    console.error('Error:', error);
    infoDiv.innerText = "Error loading point cloud.";
});

window.addEventListener('resize', onWindowResize, false);
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

animate();