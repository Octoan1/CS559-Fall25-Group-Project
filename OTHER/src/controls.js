import * as THREE from 'three';

export function createInputControls({ tiltMax = 0.7 } = {}) {
  const tilt = { x: 0, z: 0 };
  let dragging = false;
  let lastTouch = null;

  const keydown = (e) => {
    if (e.key === 'ArrowUp' || e.key === 'w') tilt.z = -tiltMax;
    if (e.key === 'ArrowDown' || e.key === 's') tilt.z = tiltMax;
    if (e.key === 'ArrowLeft' || e.key === 'a') tilt.x = -tiltMax;
    if (e.key === 'ArrowRight' || e.key === 'd') tilt.x = tiltMax;
  };
  const keyup = (e) => {
    if (['ArrowUp', 'ArrowDown', 'w', 's'].includes(e.key)) tilt.z = 0;
    if (['ArrowLeft', 'ArrowRight', 'a', 'd'].includes(e.key)) tilt.x = 0;
  };

  const pointerdown = (e) => { dragging = true; lastTouch = { x: e.clientX, y: e.clientY }; };
  const pointerup = () => { dragging = false; tilt.x = tilt.z = 0; lastTouch = null; };
  const pointermove = (e) => {
    if (!dragging) return;
    if (!lastTouch) lastTouch = { x: e.clientX, y: e.clientY };
    const dx = e.clientX - lastTouch.x;
    const dy = e.clientY - lastTouch.y;
    lastTouch = { x: e.clientX, y: e.clientY };
    tilt.x = THREE.MathUtils.clamp(tilt.x + dx * 0.0025, -tiltMax, tiltMax);
    tilt.z = THREE.MathUtils.clamp(tilt.z + dy * 0.0025, -tiltMax, tiltMax);
  };

  window.addEventListener('keydown', keydown);
  window.addEventListener('keyup', keyup);
  window.addEventListener('pointerdown', pointerdown);
  window.addEventListener('pointerup', pointerup);
  window.addEventListener('pointermove', pointermove);

  const dispose = () => {
    window.removeEventListener('keydown', keydown);
    window.removeEventListener('keyup', keyup);
    window.removeEventListener('pointerdown', pointerdown);
    window.removeEventListener('pointerup', pointerup);
    window.removeEventListener('pointermove', pointermove);
  };

  return { tilt, dispose };
}
