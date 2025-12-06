// Game logic and win condition
class GameLogic {
    constructor() {
        this.holeX = 8;
        this.holeZ = 8;
        this.holeRadius = 0.8;
    }

    checkWinCondition(marblePhysics) {
        const distToHole = Math.sqrt(
            (marblePhysics.position.x - this.holeX) ** 2 + 
            (marblePhysics.position.z - this.holeZ) ** 2
        );
        
        return distToHole < this.holeRadius && marblePhysics.position.y < 1;
    }

    updateUI(gameState) {
        const statusElement = document.getElementById('status');
        if (gameState.isWon) {
            statusElement.textContent = 'You Won! Press R to Reset';
            statusElement.style.color = '#00ff00';
        } else {
            statusElement.textContent = 'Get the marble to the hole!';
            statusElement.style.color = 'white';
        }
    }
}
