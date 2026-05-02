class TetrisGame {
    constructor() {
        this.canvas = document.getElementById('tetris-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.nextCanvas = document.getElementById('next-piece-canvas');
        this.nextCtx = this.nextCanvas.getContext('2d');
        
        // Check if canvas is properly initialized
        if (!this.ctx || !this.nextCtx) {
            console.error('Canvas context not initialized properly');
            return;
        }
        console.log('Canvas initialized:', this.canvas, this.ctx);
        
        this.COLS = 10;
        this.ROWS = 20;
        this.BLOCK_SIZE = 30;
        
        this.board = this.createBoard();
        this.currentPiece = null;
        this.nextPiece = null;
        this.gameOver = false;
        this.paused = false;
        this.score = 0;
        this.lines = 0;
        this.level = 1;
        this.piecesCount = 0;
        this.gameTime = 0;
        this.dropInterval = 1000;
        this.lastDrop = 0;
        this.startTime = null;
        
        this.audioContext = null;
        this.musicPlaying = false;
        this.musicOscillators = [];
        this.initAudio();
        
        this.colors = {
            I: '#00f0f0',
            O: '#f0f000',
            T: '#a000f0',
            S: '#00f000',
            Z: '#f00000',
            J: '#0000f0',
            L: '#f0a000'
        };
        
        this.pieces = {
            I: [[1,1,1,1]],
            O: [[1,1],[1,1]],
            T: [[0,1,0],[1,1,1]],
            S: [[0,1,1],[1,1,0]],
            Z: [[1,1,0],[0,1,1]],
            J: [[1,0,0],[1,1,1]],
            L: [[0,0,1],[1,1,1]]
        };
        
        this.highScore = this.loadHighScore();
        this.init();
    }
    
    createBoard() {
        return Array(this.ROWS).fill().map(() => Array(this.COLS).fill(0));
    }
    
    initAudio() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.warn('Web Audio API not supported');
        }
    }
    
    playSound(type) {
        if (!this.audioContext) return;
        
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        const currentTime = this.audioContext.currentTime;
        
        switch(type) {
            case 'drop':
                oscillator.frequency.setValueAtTime(200, currentTime);
                oscillator.frequency.exponentialRampToValueAtTime(100, currentTime + 0.1);
                gainNode.gain.setValueAtTime(0.3, currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, currentTime + 0.1);
                oscillator.start(currentTime);
                oscillator.stop(currentTime + 0.1);
                break;
                
            case 'gameOver':
                oscillator.frequency.setValueAtTime(400, currentTime);
                oscillator.frequency.exponentialRampToValueAtTime(100, currentTime + 0.5);
                gainNode.gain.setValueAtTime(0.4, currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, currentTime + 0.5);
                oscillator.start(currentTime);
                oscillator.stop(currentTime + 0.5);
                break;
                
            case 'start':
                oscillator.frequency.setValueAtTime(300, currentTime);
                oscillator.frequency.exponentialRampToValueAtTime(600, currentTime + 0.2);
                gainNode.gain.setValueAtTime(0.3, currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, currentTime + 0.2);
                oscillator.start(currentTime);
                oscillator.stop(currentTime + 0.2);
                break;
                
            case 'move':
                oscillator.frequency.setValueAtTime(150, currentTime);
                gainNode.gain.setValueAtTime(0.1, currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, currentTime + 0.05);
                oscillator.start(currentTime);
                oscillator.stop(currentTime + 0.05);
                break;
        }
    }
    
    init() {
        this.setupEventListeners();
        this.updateDisplay();
        this.showOverlay('Press SPACE to start', 'TETRIS');
    }
    
    setupEventListeners() {
        document.addEventListener('keydown', (e) => this.handleKeyPress(e));
        document.getElementById('startButton').addEventListener('click', () => this.startGame());
        document.getElementById('musicToggle').addEventListener('change', (e) => this.toggleSpaceMusic(e.target.checked));
    }
    
    handleKeyPress(e) {
        if (this.gameOver && e.code !== 'Space') return;
        
        switch(e.code) {
            case 'ArrowLeft':
            case 'KeyA':
                e.preventDefault();
                if (!this.paused && this.currentPiece) this.movePiece(-1, 0);
                break;
            case 'ArrowRight':
            case 'KeyD':
                e.preventDefault();
                if (!this.paused && this.currentPiece) this.movePiece(1, 0);
                break;
            case 'ArrowDown':
            case 'KeyS':
                e.preventDefault();
                if (!this.paused && this.currentPiece) this.movePiece(0, 1);
                break;
            case 'ArrowUp':
            case 'KeyW':
                e.preventDefault();
                if (!this.paused && this.currentPiece) this.rotatePiece();
                break;
            case 'Space':
                e.preventDefault();
                if (this.gameOver) {
                    this.startGame();
                } else if (!this.paused && this.currentPiece) {
                    this.hardDrop();
                }
                break;
            case 'KeyP':
                e.preventDefault();
                if (!this.gameOver) this.togglePause();
                break;
        }
    }
    
    startGame() {
        this.playSound('start');
        this.board = this.createBoard();
        this.score = 0;
        this.lines = 0;
        this.level = 1;
        this.piecesCount = 0;
        this.gameTime = 0;
        this.dropInterval = 1000;
        this.gameOver = false;
        this.paused = false;
        this.startTime = Date.now();
        this.lastDrop = Date.now(); // Initialize lastDrop
        
        this.currentPiece = this.createPiece();
        this.nextPiece = this.createPiece();
        
                
        this.hideOverlay();
        this.updateDisplay();
        this.draw(); // Draw initial state
        this.gameLoop();
    }
    
    createPiece() {
        const pieces = Object.keys(this.pieces);
        const type = pieces[Math.floor(Math.random() * pieces.length)];
        return {
            type: type,
            shape: this.pieces[type],
            x: Math.floor(this.COLS / 2) - Math.floor(this.pieces[type][0].length / 2),
            y: 0,
            color: this.colors[type]
        };
    }
    
    movePiece(dx, dy) {
        const newX = this.currentPiece.x + dx;
        const newY = this.currentPiece.y + dy;
        
        if (this.isValidPosition(this.currentPiece.shape, newX, newY)) {
            this.currentPiece.x = newX;
            this.currentPiece.y = newY;
            
            if (dx !== 0) {
                this.playSound('move');
            }
            
            if (dy > 0) {
                this.score += 1;
                this.updateDisplay();
            }
            return true;
        }
        
        if (dy > 0) {
            this.lockPiece();
        }
        return false;
    }
    
    rotatePiece() {
        const rotated = this.rotateMatrix(this.currentPiece.shape);
        if (this.isValidPosition(rotated, this.currentPiece.x, this.currentPiece.y)) {
            this.currentPiece.shape = rotated;
        }
    }
    
    rotateMatrix(matrix) {
        const rows = matrix.length;
        const cols = matrix[0].length;
        const rotated = Array(cols).fill().map(() => Array(rows).fill(0));
        
        for (let i = 0; i < rows; i++) {
            for (let j = 0; j < cols; j++) {
                rotated[j][rows - 1 - i] = matrix[i][j];
            }
        }
        return rotated;
    }
    
    hardDrop() {
        let dropDistance = 0;
        while (this.movePiece(0, 1)) {
            dropDistance++;
        }
        this.score += dropDistance * 2;
        this.updateDisplay();
    }
    
    isValidPosition(shape, x, y) {
        for (let row = 0; row < shape.length; row++) {
            for (let col = 0; col < shape[row].length; col++) {
                if (shape[row][col]) {
                    const newX = x + col;
                    const newY = y + row;
                    
                    if (newX < 0 || newX >= this.COLS || newY >= this.ROWS) {
                        return false;
                    }
                    
                    if (newY >= 0 && this.board[newY][newX]) {
                        return false;
                    }
                }
            }
        }
        return true;
    }
    
    lockPiece() {
        this.playSound('drop');
        
        for (let row = 0; row < this.currentPiece.shape.length; row++) {
            for (let col = 0; col < this.currentPiece.shape[row].length; col++) {
                if (this.currentPiece.shape[row][col]) {
                    const y = this.currentPiece.y + row;
                    const x = this.currentPiece.x + col;
                    
                    if (y < 0) {
                        this.endGame();
                        return;
                    }
                    
                    this.board[y][x] = this.currentPiece.color;
                }
            }
        }
        
        this.piecesCount++;
        this.clearLines();
        this.currentPiece = this.nextPiece;
        this.nextPiece = this.createPiece();
        
        if (!this.isValidPosition(this.currentPiece.shape, this.currentPiece.x, this.currentPiece.y)) {
            this.endGame();
        }
        
        this.updateDisplay();
    }
    
    clearLines() {
        let linesCleared = 0;
        
        for (let row = this.ROWS - 1; row >= 0; row--) {
            if (this.board[row].every(cell => cell !== 0)) {
                this.board.splice(row, 1);
                this.board.unshift(Array(this.COLS).fill(0));
                linesCleared++;
                row++;
            }
        }
        
        if (linesCleared > 0) {
            this.lines += linesCleared;
            this.score += this.calculateScore(linesCleared);
            this.level = Math.floor(this.lines / 10) + 1;
            this.dropInterval = Math.max(100, 1000 - (this.level - 1) * 100);
            
            if (this.score > this.highScore) {
                this.highScore = this.score;
                this.saveHighScore();
            }
        }
    }
    
    calculateScore(lines) {
        const baseScores = [0, 100, 300, 500, 800];
        return baseScores[lines] * this.level;
    }
    
    gameLoop() {
        if (this.gameOver || this.paused) return;
        
        const now = Date.now();
        if (now - this.lastDrop > this.dropInterval) {
            this.movePiece(0, 1);
            this.lastDrop = now;
        }
        
        this.updateGameTime();
        this.draw();
        requestAnimationFrame(() => this.gameLoop());
    }
    
    updateGameTime() {
        if (this.startTime) {
            const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
            const minutes = Math.floor(elapsed / 60);
            const seconds = elapsed % 60;
            this.gameTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
    }
    
    draw() {
        // Clear canvas
        this.ctx.fillStyle = '#1a1a1a';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw grid lines first
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        this.ctx.lineWidth = 1;
        for (let i = 0; i <= this.COLS; i++) {
            this.ctx.beginPath();
            this.ctx.moveTo(i * this.BLOCK_SIZE, 0);
            this.ctx.lineTo(i * this.BLOCK_SIZE, this.canvas.height);
            this.ctx.stroke();
        }
        for (let i = 0; i <= this.ROWS; i++) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, i * this.BLOCK_SIZE);
            this.ctx.lineTo(this.canvas.width, i * this.BLOCK_SIZE);
            this.ctx.stroke();
        }
        
        // Draw board pieces
        this.drawBoard();
        
        // Draw current piece
        if (this.currentPiece) {
            this.drawPiece(this.currentPiece, this.ctx);
        }
        
        // Draw ghost piece
        this.drawGhostPiece();
        
        // Draw next piece
        this.drawNextPiece();
    }
    
    drawBoard() {
        for (let row = 0; row < this.ROWS; row++) {
            for (let col = 0; col < this.COLS; col++) {
                if (this.board[row][col]) {
                    this.drawBlock(col, row, this.board[row][col], this.ctx);
                }
            }
        }
    }
    
    drawPiece(piece, context) {
        for (let row = 0; row < piece.shape.length; row++) {
            for (let col = 0; col < piece.shape[row].length; col++) {
                if (piece.shape[row][col]) {
                    if (context === this.ctx) {
                        this.drawBlock(piece.x + col, piece.y + row, piece.color, context);
                    } else {
                        this.drawBlock(col + 1, row + 1, piece.color, context, 20);
                    }
                }
            }
        }
    }
    
    drawGhostPiece() {
        if (!this.currentPiece) return;
        
        let ghostY = this.currentPiece.y;
        while (this.isValidPosition(this.currentPiece.shape, this.currentPiece.x, ghostY + 1)) {
            ghostY++;
        }
        
        for (let row = 0; row < this.currentPiece.shape.length; row++) {
            for (let col = 0; col < this.currentPiece.shape[row].length; col++) {
                if (this.currentPiece.shape[row][col]) {
                    this.drawBlock(this.currentPiece.x + col, ghostY + row, this.currentPiece.color, this.ctx, this.BLOCK_SIZE, 0.3);
                }
            }
        }
    }
    
    drawNextPiece() {
        this.nextCtx.fillStyle = '#1a1a1a';
        this.nextCtx.fillRect(0, 0, this.nextCanvas.width, this.nextCanvas.height);
        
        if (this.nextPiece) {
            this.drawPiece(this.nextPiece, this.nextCtx);
        }
    }
    
    drawBlock(x, y, color, context, size = this.BLOCK_SIZE, alpha = 1) {
        const blockSize = size;
        const padding = 1;
        
        context.fillStyle = color;
        context.globalAlpha = alpha;
        context.fillRect(x * blockSize + padding, y * blockSize + padding, blockSize - padding * 2, blockSize - padding * 2);
        
        context.fillStyle = 'rgba(255, 255, 255, 0.3)';
        context.fillRect(x * blockSize + padding, y * blockSize + padding, blockSize - padding * 2, 4);
        
        context.fillStyle = 'rgba(0, 0, 0, 0.3)';
        context.fillRect(x * blockSize + padding, y * blockSize + blockSize - padding - 4, blockSize - padding * 2, 4);
        
        context.globalAlpha = 1;
    }
    
    togglePause() {
        this.paused = !this.paused;
        if (this.paused) {
            this.showOverlay('PAUSED - Press P to resume', 'PAUSED');
        } else {
            this.hideOverlay();
            this.gameLoop();
        }
    }
    
    endGame() {
        this.playSound('gameOver');
        this.gameOver = true;
        this.showOverlay(`Game Over! Score: ${this.score}`, 'GAME OVER');
        
        if (this.score > this.highScore) {
            this.highScore = this.score;
            this.saveHighScore();
        }
    }
    
    showOverlay(message, title) {
        const overlay = document.getElementById('gameOverlay');
        const overlayTitle = document.getElementById('overlayTitle');
        const overlayMessage = document.getElementById('overlayMessage');
        const startButton = document.getElementById('startButton');
        
        overlayTitle.textContent = title;
        overlayMessage.textContent = message;
        startButton.textContent = 'START GAME';
        
        overlay.classList.remove('hidden');
    }
    
    hideOverlay() {
        document.getElementById('gameOverlay').classList.add('hidden');
    }
    
    updateDisplay() {
        document.getElementById('score').textContent = this.score;
        document.getElementById('lines').textContent = this.lines;
        document.getElementById('level').textContent = this.level;
        document.getElementById('highScore').textContent = this.highScore;
        document.getElementById('gameTime').textContent = this.gameTime;
        document.getElementById('piecesCount').textContent = this.piecesCount;
    }
    
    saveHighScore() {
        try {
            localStorage.setItem('tetrisHighScore', this.highScore.toString());
        } catch (e) {
            console.warn('Could not save high score to localStorage');
        }
    }
    
    loadHighScore() {
        try {
            const saved = localStorage.getItem('tetrisHighScore');
            return saved ? parseInt(saved, 10) : 0;
        } catch (e) {
            console.warn('Could not load high score from localStorage');
            return 0;
        }
    }
    
    // Space Music Methods
    toggleSpaceMusic(isChecked) {
        if (isChecked) {
            this.playSpaceMusic();
        } else {
            this.stopSpaceMusic();
        }
    }
    
    playSpaceMusic() {
        if (!this.audioContext) return;
        
        this.stopSpaceMusic();
        
        // Create chill space ambient music
        const osc1 = this.audioContext.createOscillator();
        const osc2 = this.audioContext.createOscillator();
        const osc3 = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        const filter = this.audioContext.createBiquadFilter();
        
        // Create deep space pads
        osc1.type = 'sine';
        osc1.frequency.value = 55; // Low bass
        osc2.type = 'triangle';
        osc2.frequency.value = 110; // Mid tone
        osc3.type = 'sine';
        osc3.frequency.value = 220; // Higher tone
        
        // Create filter for spacey sound
        filter.type = 'lowpass';
        filter.frequency.value = 800;
        filter.Q.value = 5;
        
        // Set very low volume for chill vibe
        gainNode.gain.value = 0.03;
        
        // Create slow LFO for movement
        const lfo = this.audioContext.createOscillator();
        const lfoGain = this.audioContext.createGain();
        lfo.frequency.value = 0.1; // Very slow modulation
        lfoGain.gain.value = 10;
        
        // Connect LFO to filter for spacey effect
        lfo.connect(lfoGain);
        lfoGain.connect(filter.frequency);
        
        // Connect oscillators to filter
        osc1.connect(filter);
        osc2.connect(filter);
        osc3.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        // Start all oscillators
        osc1.start();
        osc2.start();
        osc3.start();
        lfo.start();
        
        // Store references
        this.musicOscillators = [osc1, osc2, osc3, lfo];
        this.musicPlaying = true;
        
            }
    
    stopSpaceMusic() {
        // Stop all music oscillators
        this.musicOscillators.forEach(osc => {
            try {
                osc.stop();
            } catch (e) {}
        });
        this.musicOscillators = [];
        this.musicPlaying = false;
        
            }
}

const game = new TetrisGame();
