// Physics simulation for the marble
class PhysicsEngine {
    constructor() {
        this.gravity = 9.8;
        this.friction = 0.98;
        this.rollingFriction = 0.995;
    }

    update(marblePhysics, gameState, obstacles, marble, deltaTime, holePosition = null, holeRadius = 0.8, holeGridCell = null) {
        // Check if marble is on the platform
        const platformY = 0.0; // Platform top surface (platform box has height 1 and is centered at y=-0.5)
        const marbleRadius = 0.5; // Marble radius used throughout collision calculations
        
        // Check if marble is over the hole
        let isOverHole = false;
        if (holePosition) {
            const dx = marblePhysics.position.x - holePosition.x;
            const dz = marblePhysics.position.z - holePosition.z;
            const distToHole = Math.sqrt(dx * dx + dz * dz);
            // Marble must be centered over hole (not just edge touching)
            isOverHole = distToHole < (holeRadius - marbleRadius * 0.5);
        }
        
        // Commit to falling once more than 90% of the ball has crossed the top plane of platform
        // 90% threshold: center below platformTop + marbleRadius*0.1
        if (!marblePhysics.fallCommitted && isOverHole && marblePhysics.position.y < (platformY + marbleRadius * 0.1)) {
            marblePhysics.fallCommitted = true;
        }

        // Treat as effectively over hole if we've committed and are still within the upper half height
        const effectiveOverHole = isOverHole || (marblePhysics.fallCommitted && marblePhysics.position.y < (platformY + marbleRadius * 0.2));

        gameState.ballGrounded = marblePhysics.position.y <= platformY + 0.5 && !effectiveOverHole;

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
        const positionDelta = new THREE.Vector3(marblePhysics.velocity.x * deltaTime, marblePhysics.velocity.y * deltaTime, marblePhysics.velocity.z * deltaTime);
        marblePhysics.position.add(positionDelta);

        // Obstacle collision (simple sphere vs AABB)
        // Marble is treated as a sphere with radius 0.5 (matches geometry)
        if (Array.isArray(obstacles)) {
            // Use a unified collision height for all obstacles regardless of visuals
            const obstacleCollisionHeight = 0.5; // world units above platform top
            const obstacleHalfY = obstacleCollisionHeight / 2;
            for (const obs of obstacles) {
                if (!obs) continue;
                // obstacle AABB in platform-local space. Prefer mesh position when available,
                // otherwise use the stored x/z and compute y from height.
                const ox = (obs.mesh && obs.mesh.position) ? obs.mesh.position.x : (obs.x ?? 0);
                // Force a consistent hitbox center height so minY=0 and maxY=obstacleCollisionHeight
                const oy = obstacleHalfY;
                const oz = (obs.mesh && obs.mesh.position) ? obs.mesh.position.z : (obs.z ?? 0);
                const halfX = (obs.width || 0) / 2;
                const halfY = obstacleHalfY;
                const halfZ = (obs.depth || 0) / 2;

                const minX = ox - halfX, maxX = ox + halfX;
                const minY = oy - halfY, maxY = oy + halfY;
                const minZ = oz - halfZ, maxZ = oz + halfZ;

                // If an obstacle is in the same grid cell as the hole, skip its collision
                // when marble is either (a) committed to falling, OR (b) is over the hole and moving down
                if (holeGridCell && obs.gridCell) {
                    if (obs.gridCell[0] === holeGridCell[0] && obs.gridCell[1] === holeGridCell[1]) {
                        // Check if marble should pass through this obstacle
                        const isCommitted = marblePhysics.fallCommitted;
                        const overHole = isOverHole; // use the isOverHole from earlier
                        const isMovingDown = marblePhysics.velocity && marblePhysics.velocity.y < -0.1;
                        
                        if (isCommitted || (overHole && isMovingDown)) {
                            continue;
                        }
                    }
                }

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

        // Platform collision (keep on platform, but allow falling through hole)
        // Platform bottom is at y = -1.0 (since platform is height 1 centered at y = -0.5)
        const platformBottom = -1.0;
        const platformTop = 0.0;
        
        if (!effectiveOverHole) {
            // Keep ball on top of platform
            if (marblePhysics.position.y < platformTop + 0.5) {
                marblePhysics.position.y = platformTop + 0.5;
                if (marblePhysics.velocity.y < 0) {
                    marblePhysics.velocity.y *= -0.3; // Bounce
                }
            }
        } else {
            // Ball is over hole - only keep it from falling through the platform bottom
            if (marblePhysics.position.y > platformBottom && marblePhysics.position.y < platformTop + 0.5) {
                // Ball is inside the hole area - let it fall naturally
                // No collision with platform top
            } else if (marblePhysics.position.y <= platformBottom) {
                // Prevent clipping through platform bottom (outside the hole area)
                // This shouldn't happen if hole detection is accurate, but safety check
            }
        }

        marble.position.copy(marblePhysics.position);
        
        // Calculate and apply rolling rotation
        // The ball rotates around an axis perpendicular to its velocity
        const speed = Math.sqrt(
            marblePhysics.velocity.x * marblePhysics.velocity.x + 
            marblePhysics.velocity.z * marblePhysics.velocity.z
        );
        
        if (speed > 0.001) {
            // Calculate rotation axis (perpendicular to velocity in XZ plane)
            // Rotation axis is 90 degrees from velocity direction
            const axisX = -marblePhysics.velocity.z / speed;
            const axisZ = marblePhysics.velocity.x / speed;
            
            // Calculate rotation angle based on distance traveled
            // angle = distance / radius
            const rotationAngle = -(speed * deltaTime) / marbleRadius;
            
            // Create rotation axis
            const axis = new THREE.Vector3(axisX, 0, axisZ).normalize();
            
            // Apply rotation
            marble.rotateOnWorldAxis(axis, rotationAngle);
        }
    }

    // No boundary or obstacle collision
}
