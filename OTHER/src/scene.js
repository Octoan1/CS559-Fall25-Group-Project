import * as THREE from 'three';
import { OrbitControls } from 'https://unpkg.com/three@0.154.0/examples/jsm/controls/OrbitControls.js';

export function createScene(canvas, { tableSize = 24 } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x101020);

  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000);
  camera.position.set(0, 20, 28);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0, 0);
  controls.enableDamping = true;
  controls.minDistance = 8;
  controls.maxDistance = 60;

  const amb = new THREE.HemisphereLight(0xffffff, 0x444466, 0.7);
  scene.add(amb);
  const dir = new THREE.DirectionalLight(0xffffff, 0.9);
  dir.position.set(10, 20, 10);
  scene.add(dir);

  const floorGeo = new THREE.PlaneGeometry(tableSize, tableSize);
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x223344 });
  const floorMesh = new THREE.Mesh(floorGeo, floorMat);
  floorMesh.rotation.x = -Math.PI / 2;
  scene.add(floorMesh);

  return { renderer, scene, camera, controls, floorMesh, tableSize };
}

export function buildWalls(walls, wallHeight = 2.2) {
  const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x995533 });
  const meshes = [];
  for (const [cx, cz, width, depth] of walls) {
    const boxGeo = new THREE.BoxGeometry(width, wallHeight, depth);
    const mesh = new THREE.Mesh(boxGeo, wallMaterial);
    mesh.position.set(cx, wallHeight / 2, cz);
    meshes.push(mesh);
  }
  return meshes;
}

export function createGoalMesh(goal) {
  const goalRadius = goal.radius ?? 1.2;
  const goalMat = new THREE.MeshStandardMaterial({ color: 0x99ff88, emissive: 0x113311, transparent: true, opacity: 0.9 });
  const goalGeo = new THREE.CylinderGeometry(goalRadius, goalRadius, 0.05, 32);
  const goalMesh = new THREE.Mesh(goalGeo, goalMat);
  goalMesh.rotation.x = -Math.PI / 2;
  goalMesh.position.set(goal.x, (goal.y ?? 0) + 0.01, goal.z);
  return goalMesh;
}

export function createMarbleMesh(radius = 0.9) {
  const sphereGeo = new THREE.SphereGeometry(radius, 32, 32);
  const sphereMat = new THREE.MeshStandardMaterial({ color: 0x66b2ff, metalness: 0.4, roughness: 0.3 });
  return new THREE.Mesh(sphereGeo, sphereMat);
}
