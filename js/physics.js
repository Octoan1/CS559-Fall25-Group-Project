// Physics simulation for the marble
class PhysicsEngine {
    constructor() {
        this.gravity = 9.8;
        this.friction = 0.98;
        this.rollingFriction = 0.995;
    }

    update(marblePhysics, gameState, obstacles, marble, deltaTime) {
        // Check if marble is on the platform
        const platformY = 0.0; // Platform top surface (platform box has height 1 and is centered at y=-0.5)
        gameState.ballGrounded = marblePhysics.position.y <= platformY + 0.5;

        // Calculate gravity in world space
        let gravityX = 0;
        let gravityZ = 0;

        // The platform rotates around X axis (pitch - up/down) and Z axis (roll - left/right)
        // When platform rotates, gravity effectively pulls the ball based on those rotations
        gravityX = -Math.sin(gameState.rotationZ) * this.gravity;
        gravityZ = Math.sin(gameState.rotationX) * this.gravity;

        if (gameState.ballGrounded) {
            // Apply friction when grounded
            marblePhysics.velocity.x *= Math.pow(this.rollingFriction, deltaTime * 60);
            marblePhysics.velocity.z *= Math.pow(this.rollingFriction, deltaTime * 60);
            marblePhysics.velocity.y = Math.max(marblePhysics.velocity.y, 0);

            // Apply gravity-based acceleration from platform tilt
            marblePhysics.velocity.x += gravityX * deltaTime;
            marblePhysics.velocity.z += gravityZ * deltaTime;
        } else {
            // Apply gravity and air resistance
            marblePhysics.velocity.x += gravityX * deltaTime;
            marblePhysics.velocity.z += gravityZ * deltaTime;
            marblePhysics.velocity.y -= this.gravity * deltaTime;
            marblePhysics.velocity.multiplyScalar(Math.pow(this.friction, deltaTime * 60));
        }

        // Update position
        marblePhysics.position.add(new THREE.Vector3(marblePhysics.velocity.x * deltaTime, marblePhysics.velocity.y * deltaTime, marblePhysics.velocity.z * deltaTime));

        // Obstacle collision (simple sphere vs AABB)
        // Marble is treated as a sphere with radius 0.5 (matches geometry)
        const marbleRadius = 0.5;
        if (Array.isArray(obstacles)) {
            for (const obs of obstacles) {
                if (!obs) continue;
                // obstacle AABB in platform-local space. Prefer mesh position when available,
                // otherwise use the stored x/z and compute y from height.
                const ox = (obs.mesh && obs.mesh.position) ? obs.mesh.position.x : (obs.x ?? 0);
                const oy = (obs.mesh && obs.mesh.position) ? obs.mesh.position.y : ((obs.height || 0) / 2);
                const oz = (obs.mesh && obs.mesh.position) ? obs.mesh.position.z : (obs.z ?? 0);
                const halfX = (obs.width || 0) / 2;
                const halfY = (obs.height || 0) / 2;
                const halfZ = (obs.depth || 0) / 2;

                const minX = ox - halfX, maxX = ox + halfX;
                const minY = oy - halfY, maxY = oy + halfY;
                const minZ = oz - halfZ, maxZ = oz + halfZ;

                // Closest point on AABB to sphere center
                const cx = Math.max(minX, Math.min(marblePhysics.position.x, maxX));
                const cy = Math.max(minY, Math.min(marblePhysics.position.y, maxY));
                const cz = Math.max(minZ, Math.min(marblePhysics.position.z, maxZ));

                const dx = marblePhysics.position.x - cx;
                const dy = marblePhysics.position.y - cy;
                const dz = marblePhysics.position.z - cz;
                const distSq = dx*dx + dy*dy + dz*dz;

                if (distSq < marbleRadius * marbleRadius) {
                    const dist = Math.sqrt(distSq) || 1e-6;
                    const penetration = marbleRadius - dist;
                    // normal from obstacle to marble center
                    const nx = dx / dist;
                    const ny = dy / dist;
                    const nz = dz / dist;

                    // Move marble out of obstacle along normal
                    marblePhysics.position.x += nx * penetration;
                    marblePhysics.position.y += ny * penetration;
                    marblePhysics.position.z += nz * penetration;

                    // Bounce response - reflect velocity with damping
                    const vn = marblePhysics.velocity.x * nx + marblePhysics.velocity.y * ny + marblePhysics.velocity.z * nz;
                    if (vn < 0) {
                        const bounceCoefficient = 0.5; // Bounce back at 50% velocity
                        // Remove the incoming velocity and add back a portion in the opposite direction
                        marblePhysics.velocity.x -= nx * vn * (1 + bounceCoefficient);
                        marblePhysics.velocity.y -= ny * vn * (1 + bounceCoefficient);
                        marblePhysics.velocity.z -= nz * vn * (1 + bounceCoefficient);
                    }
                }
            }
        }

        // Platform collision (keep on platform)
        if (marblePhysics.position.y < platformY + 0.5) {
            marblePhysics.position.y = platformY + 0.5;
            if (marblePhysics.velocity.y < 0) {
                marblePhysics.velocity.y *= -0.3; // Bounce
            }
        }

        marble.position.copy(marblePhysics.position);
    }

    // No boundary or obstacle collision
}
