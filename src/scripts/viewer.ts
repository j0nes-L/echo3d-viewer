import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PLYLoader } from 'three/addons/loaders/PLYLoader.js';

const DEFAULT_POINT_SIZE = 0.005;
const BACKGROUND_COLOR = 0x111111;

let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let renderer: THREE.WebGLRenderer;
let controls: OrbitControls;
let currentPoints: THREE.Points | null = null;
let animationId: number | null = null;
let container: HTMLElement;
let pointSizeMultiplier = 1.0;
let hasPerPointScale = false;

export function initViewer(containerEl: HTMLElement): void {
  container = containerEl;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(BACKGROUND_COLOR);

  camera = new THREE.PerspectiveCamera(
    75,
    container.clientWidth / container.clientHeight,
    0.0001,
    100000
  );

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  container.appendChild(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.1;

  camera.position.set(0, 0, 3);
  controls.update();

  window.addEventListener('resize', onResize);
  animate();
}

export function unloadPointCloud(): void {
  if (currentPoints) {
    scene.remove(currentPoints);
    currentPoints.geometry.dispose();
    if (currentPoints.material instanceof THREE.Material) {
      currentPoints.material.dispose();
    }
    currentPoints = null;
  }
}

export function loadPointCloudFromBuffer(
  buffer: ArrayBuffer,
  onProgress?: (msg: string) => void
): void {
  unloadPointCloud();
  pointSizeMultiplier = 1.0;

  onProgress?.('Parsing point cloud…');

  const loader = new PLYLoader();
  const geometry = loader.parse(buffer);

  hasPerPointScale = geometry.hasAttribute('scalar_scale');

  let material: THREE.Material;

  if (hasPerPointScale) {
    const scaleAttr = geometry.getAttribute('scalar_scale');
    const count = scaleAttr.count;
    const sizes = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      sizes[i] = Math.exp(scaleAttr.getX(i));
    }
    geometry.setAttribute('pointScale', new THREE.BufferAttribute(sizes, 1));

    const hasColors = geometry.hasAttribute('color');

    material = new THREE.ShaderMaterial({
      uniforms: {
        uSizeMultiplier: { value: 1.0 },
      },
      vertexShader: `
        attribute float pointScale;
        ${hasColors ? 'varying vec3 vColor;' : ''}
        uniform float uSizeMultiplier;
        void main() {
          ${hasColors ? 'vColor = color;' : ''}
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = pointScale * uSizeMultiplier * (300.0 / -mvPosition.z);
          gl_PointSize = max(gl_PointSize, 1.0);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        ${hasColors ? 'varying vec3 vColor;' : ''}
        void main() {
          ${hasColors ? 'gl_FragColor = vec4(vColor, 1.0);' : 'gl_FragColor = vec4(1.0);'}
        }
      `,
      vertexColors: hasColors,
    });
  } else {
    material = new THREE.PointsMaterial({
      size: DEFAULT_POINT_SIZE,
      vertexColors: true,
      sizeAttenuation: true,
    });
  }

  geometry.center();
  const points = new THREE.Points(geometry, material);
  scene.add(points);
  currentPoints = points;

  geometry.computeBoundingSphere();
  const radius = geometry.boundingSphere!.radius;

  if (radius > 0) {
    camera.near = 0.0001;
    camera.far = 100000;
    camera.updateProjectionMatrix();

    controls.target.set(0, 0, 0);
    controls.minDistance = 0;
    controls.maxDistance = Infinity;
    controls.zoomSpeed = 3.0;

    camera.position.set(0, 0, radius * 2.0);
    controls.update();
    controls.saveState();
  }

  onProgress?.('Point cloud loaded');
}

function onResize(): void {
  if (!container || !camera || !renderer) return;
  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.clientWidth, container.clientHeight);
}

function animate(): void {
  animationId = requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

export function disposeViewer(): void {
  if (animationId !== null) {
    cancelAnimationFrame(animationId);
  }
  window.removeEventListener('resize', onResize);
  unloadPointCloud();
  renderer?.dispose();
  controls?.dispose();
}

export function setPointSize(size: number): void {
  if (!currentPoints) return;
  if (hasPerPointScale && currentPoints.material instanceof THREE.ShaderMaterial) {
    currentPoints.material.uniforms.uSizeMultiplier.value = size;
  } else if (currentPoints.material instanceof THREE.PointsMaterial) {
    currentPoints.material.size = size;
  }
}

export function hasScalarScale(): boolean {
  return hasPerPointScale;
}

