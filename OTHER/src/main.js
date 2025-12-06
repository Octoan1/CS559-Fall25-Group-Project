// floorMesh.rotation.x = -Math.PI/2;
import * as THREE from 'three';
import { createScene, buildWalls, createGoalMesh, createMarbleMesh } from './scene.js';
import { createWorld, addWalls, createMarbleBody, CANNON } from './physics.js';
import { createInputControls } from './controls.js';
import { loadLevel } from './levels.js';
import { createUI } from './ui.js';

async function main(){
  const canvas = document.getElementById('canvas');
  const { renderer, scene, camera, controls } = createScene(canvas);
  const { world, defaultMaterial } = createWorld();
  const { tilt } = createInputControls();
  const ui = createUI();

  const level = await loadLevel(0);

  const wallMeshes = buildWalls(level.walls);
  wallMeshes.forEach(mesh => scene.add(mesh));
  addWalls(world, level.walls, { material: defaultMaterial });

  const goalMesh = createGoalMesh(level.goal);
  scene.add(goalMesh);
  const goalRadius = level.goal.radius ?? 1.2;

  const marbleRadius = 0.9;
  const marbleMesh = createMarbleMesh(marbleRadius);
  scene.add(marbleMesh);
  const marbleBody = createMarbleBody(world, marbleRadius, { material: defaultMaterial });

  let started = false;
  let finished = false;
  let startTime = 0;

  const resetMarble = () => {
    marbleBody.position.set(level.start.x, level.start.y, level.start.z);
    marbleBody.velocity.set(0,0,0);
    marbleBody.angularVelocity.set(0,0,0);
    started = false;
    finished = false;
    startTime = 0;
    ui.clearMessage();
  };

  ui.onReset(resetMarble);
  resetMarble();

  window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  });

  const clock = new THREE.Clock();
  const tick = () => {
    requestAnimationFrame(tick);
    const dt = Math.min(1/30, clock.getDelta());

    const g = 9.82;
    const force = new CANNON.Vec3(tilt.x * g * marbleBody.mass, 0, tilt.z * g * marbleBody.mass);
    marbleBody.applyForce(force, marbleBody.position);

    world.step(1/120, dt, 4);

    marbleMesh.position.copy(marbleBody.position);
    marbleMesh.quaternion.copy(marbleBody.quaternion);

    goalMesh.rotation.z += 0.01;

    if(!started && (marbleBody.velocity.length() > 0.02 || tilt.x !== 0 || tilt.z !== 0)){
      started = true;
      startTime = performance.now();
    }
    if(started && !finished){
      const elapsed = (performance.now() - startTime)/1000;
      ui.setTimer(elapsed);
    }

    const dx = marbleBody.position.x - level.goal.x;
    const dz = marbleBody.position.z - level.goal.z;
    const d2 = dx*dx + dz*dz;
    if(!finished && d2 < (goalRadius + marbleRadius)*(goalRadius + marbleRadius)){
      finished = true;
      const elapsed = (performance.now() - startTime)/1000;
      ui.setMessage(`Goal! Time: ${elapsed.toFixed(2)}s`);
    }

    controls.update();
    renderer.render(scene, camera);
  };

  tick();
  console.log('Marble puzzle loaded. Use arrows/WASD or drag to tilt the board.');
}

main().catch(err => {
  console.error(err);
  const messageEl = document.getElementById('message');
  if (messageEl) messageEl.textContent = `Error: ${err.message}`;
});
