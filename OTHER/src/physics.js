import * as CANNON from 'https://unpkg.com/cannon-es@0.20.0/dist/cannon-es.js';

export function createWorld() {
  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) });
  world.broadphase = new CANNON.NaiveBroadphase();
  world.solver.iterations = 10;

  const defaultMaterial = new CANNON.Material('default');
  const contactMat = new CANNON.ContactMaterial(defaultMaterial, defaultMaterial, { friction: 0.4, restitution: 0.1 });
  world.addContactMaterial(contactMat);

  const floorBody = new CANNON.Body({ mass: 0, shape: new CANNON.Plane(), material: defaultMaterial });
  floorBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  world.addBody(floorBody);

  return { world, defaultMaterial };
}

export function addWalls(world, walls, { wallHeight = 2.2, material } = {}) {
  const bodies = [];
  for (const [cx, cz, width, depth] of walls) {
    const shape = new CANNON.Box(new CANNON.Vec3(width / 2, wallHeight / 2, depth / 2));
    const body = new CANNON.Body({ mass: 0, shape, material: material ?? world.defaultMaterial });
    body.position.set(cx, wallHeight / 2, cz);
    world.addBody(body);
    bodies.push(body);
  }
  return bodies;
}

export function createMarbleBody(world, radius = 0.9, { material } = {}) {
  const body = new CANNON.Body({ mass: 1, shape: new CANNON.Sphere(radius), material: material ?? world.defaultMaterial });
  world.addBody(body);
  return body;
}

export { CANNON };
