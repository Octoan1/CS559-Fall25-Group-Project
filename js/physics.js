// Physics simulation for the marble
class PhysicsEngine {
    constructor() {
        this.gravity = 9.8;
        this.friction = 0.98;
        this.rollingFriction = 0.995;
    }

    update(marblePhysics, gameState, obstacles, marble, deltaTime) {
        // Check if marble is on the platform
        const platformY = 0.5; // Platform top surface
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

        // Boundary constraints (keep on platform)
        this.handleBoundaryCollision(marblePhysics);

        // Obstacle collision
        this.handleObstacleCollision(marblePhysics, obstacles, marble);

        // Platform collision (keep on platform)
        if (marblePhysics.position.y < platformY + 0.5) {
            marblePhysics.position.y = platformY + 0.5;
            if (marblePhysics.velocity.y < 0) {
                marblePhysics.velocity.y *= -0.3; // Bounce
            }
        }

        marble.position.copy(marblePhysics.position);
    }

    handleBoundaryCollision(marblePhysics) {
        const boundary = 10;
        if (marblePhysics.position.x > boundary) {
            marblePhysics.position.x = boundary;
            marblePhysics.velocity.x *= -0.5;
        }
        if (marblePhysics.position.x < -boundary) {
            marblePhysics.position.x = -boundary;
            marblePhysics.velocity.x *= -0.5;
        }
        if (marblePhysics.position.z > boundary) {
            marblePhysics.position.z = boundary;
            marblePhysics.velocity.z *= -0.5;
        }
        if (marblePhysics.position.z < -boundary) {
            marblePhysics.position.z = -boundary;
            marblePhysics.velocity.z *= -0.5;
        }
    }

    handleObstacleCollision(marblePhysics, obstacles, marble) {
        for (let obs of obstacles) {
            const dx = marblePhysics.position.x - obs.x;
            const dz = marblePhysics.position.z - obs.z;
            const minDist = marble.geometry.parameters.radius + obs.width / 2;
            const zMinDist = marble.geometry.parameters.radius + obs.depth / 2;

            if (Math.abs(dx) < minDist && Math.abs(dz) < zMinDist) {
                // Collision detected
                if (Math.abs(dx) > Math.abs(dz)) {
                    marblePhysics.position.x = obs.x + (dx > 0 ? minDist : -minDist);
                    marblePhysics.velocity.x *= -0.6;
                } else {
                    marblePhysics.position.z = obs.z + (dz > 0 ? zMinDist : -zMinDist);
                    marblePhysics.velocity.z *= -0.6;
                }
            }
        }
    }
}
