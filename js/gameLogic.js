// Game logic and win condition
class GameLogic {
    constructor(level = null) {
        if (level && level.goal) {
            this.holeX = level.goal.x;
            this.holeZ = level.goal.z;
            this.holeRadius = level.goal.radius ?? 0.8;
        } else {
            this.holeX = 8;
            this.holeZ = 8;
            this.holeRadius = 0.8;
        }
    }

    checkWinCondition(marblePhysics) {
        const dx = marblePhysics.position.x - this.holeX;
        const dz = marblePhysics.position.z - this.holeZ;
        const dist2 = dx*dx + dz*dz;
        return dist2 < (this.holeRadius * this.holeRadius) && marblePhysics.position.y < 1;
    }

    updateUI(gameState) {
        const statusElement = document.getElementById('status');
        if (gameState.isWon) {
            statusElement.textContent = 'You Won! Press R to Reset';
            statusElement.style.color = '#00ff00';
        } else {
            statusElement.textContent = 'Get the ball in the hole!';
            statusElement.style.color = 'white';
        }
    }
}
