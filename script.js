document.addEventListener('DOMContentLoaded', () => {
    const gridContainer = document.getElementById('grid');
    const tileContainer = document.getElementById('tile-container');
    const scoreElement = document.getElementById('score');
    const bestScoreElement = document.getElementById('best-score');
    const scoreAdditionElement = document.getElementById('score-addition');
    const screenshotBtn = document.getElementById('screenshot-btn');
    const restartBtn = document.getElementById('restart-btn');
    const retryBtn = document.getElementById('retry-btn');
    const installBtn = document.getElementById('install-btn');
    let deferredPrompt;
    const gameMessage = document.getElementById('game-message');
    const messageText = document.getElementById('message-text');

    const emojiMap = {
        2: '🧅',
        4: '🧄',
        8: '🍅',
        16: '🍆',
        32: '🥔',
        64: '🥕',
        128: '🌽',
        256: '🌶️',
        512: '🫑',
        1024: '🥑',
        2048: '🥦',
        4096: '🥬',
        8192: '🥒',
        16384: '🫛',
        32768: '🥗'
    };

    let grid = [];
    let score = 0;
    let bestScore = localStorage.getItem('2048-bestScore') || 0;
    let gameOver = false;
    let won = false;
    let keepPlayingAfterWin = false;

    bestScoreElement.textContent = bestScore;

    // Initialize exact DOM background grid
    for (let i = 0; i < 16; i++) {
        const cell = document.createElement('div');
        cell.className = 'grid-cell';
        gridContainer.appendChild(cell);
    }

    function initGame() {
        grid = Array(4).fill().map(() => Array(4).fill(null));
        score = 0;
        gameOver = false;
        won = false;
        keepPlayingAfterWin = false;
        updateScore(0);

        gameMessage.className = 'game-message';
        tileContainer.innerHTML = '';

        addRandomTile();
        addRandomTile();
    }

    function addRandomTile() {
        const emptyCells = [];
        for (let r = 0; r < 4; r++) {
            for (let c = 0; c < 4; c++) {
                if (!grid[r][c]) emptyCells.push({ r, c });
            }
        }
        if (emptyCells.length > 0) {
            const { r, c } = emptyCells[Math.floor(Math.random() * emptyCells.length)];
            const value = Math.random() < 0.9 ? 2 : 4;

            const tileObj = createTileObj(r, c, value, true);
            grid[r][c] = tileObj;
            tileContainer.appendChild(tileObj.element);

            // Trigger animation frame so transform is applied
            requestAnimationFrame(() => {
                tileObj.element.style.transform = getPosition(r, c);
            });
        }
    }

    function createTileObj(r, c, value, isNew = false, isMerged = false) {
        const element = document.createElement('div');
        element.className = `tile ${isNew ? 'tile-new' : ''} ${isMerged ? 'tile-merged' : ''}`;
        element.dataset.value = value;

        const inner = document.createElement('div');
        inner.className = 'tile-inner';
        inner.textContent = emojiMap[value] || value;

        element.appendChild(inner);
        // Start position
        element.style.transform = getPosition(r, c);

        return { r, c, value, element };
    }

    function getPosition(r, c) {
        return `translate(calc(${c} * (var(--cell-size) + var(--grid-spacing)) + var(--grid-spacing)), calc(${r} * (var(--cell-size) + var(--grid-spacing)) + var(--grid-spacing)))`;
    }

    function updateScore(add) {
        score += add;
        scoreElement.textContent = score;

        if (add > 0) {
            scoreAdditionElement.textContent = `+${add}`;
            scoreAdditionElement.classList.remove('active');
            void scoreAdditionElement.offsetWidth; // Trigger reflow
            scoreAdditionElement.classList.add('active');
        }

        if (score > bestScore) {
            bestScore = score;
            bestScoreElement.textContent = bestScore;
            localStorage.setItem('2048-bestScore', bestScore);
        }
    }

    function getVector(direction) {
        // 0: Left, 1: Up, 2: Right, 3: Down
        return {
            x: direction === 0 ? -1 : (direction === 2 ? 1 : 0),
            y: direction === 1 ? -1 : (direction === 3 ? 1 : 0)
        };
    }

    function move(direction) {
        if (gameOver || (won && !keepPlayingAfterWin)) return;

        const vector = getVector(direction);
        const traversals = { x: [], y: [] };
        for (let i = 0; i < 4; i++) {
            traversals.x.push(vector.x === 1 ? 3 - i : i);
            traversals.y.push(vector.y === 1 ? 3 - i : i);
        }

        let moved = false;
        let pointsAdded = 0;
        let movedGrid = Array(4).fill().map(() => Array(4).fill(null));

        // Flags to prevent merging twice in one turn
        let mergedPositions = Array(4).fill().map(() => Array(4).fill(false));

        // Remove animation classes from all existing tiles
        for (let r = 0; r < 4; r++) {
            for (let c = 0; c < 4; c++) {
                if (grid[r][c]) {
                    grid[r][c].element.classList.remove('tile-new', 'tile-merged');
                }
            }
        }

        traversals.x.forEach(x => {
            traversals.y.forEach(y => {
                const cell = grid[y][x];
                if (cell) {
                    let curr = { x, y };
                    let next = { x: x + vector.x, y: y + vector.y };

                    // Slide as far as possible
                    while (next.x >= 0 && next.x < 4 && next.y >= 0 && next.y < 4 && !movedGrid[next.y][next.x]) {
                        curr = { x: next.x, y: next.y };
                        next = { x: next.x + vector.x, y: next.y + vector.y };
                    }

                    const nextCell = (next.x >= 0 && next.x < 4 && next.y >= 0 && next.y < 4) ? movedGrid[next.y][next.x] : null;

                    if (nextCell && nextCell.value === cell.value && !mergedPositions[next.y][next.x]) {
                        // Merge
                        const mergedValue = cell.value * 2;
                        pointsAdded += mergedValue;
                        moved = true;
                        mergedPositions[next.y][next.x] = true;

                        // We will update the next cell later after animation.
                        // Create replacing merged tile
                        const mergedTile = createTileObj(next.y, next.x, mergedValue, false, true);

                        // Save a reference to old cells to destroy them later
                        const cellToDestroy1 = cell;
                        const cellToDestroy2 = nextCell;

                        movedGrid[next.y][next.x] = mergedTile;

                        // Move both old tile parts to the merge spot visually
                        cell.element.style.transform = getPosition(next.y, next.x);
                        cell.element.style.zIndex = 0;

                        // Append the new merged tile, but it will pop later
                        tileContainer.appendChild(mergedTile.element);

                        // Wait for transition to finish before removing original tiles
                        setTimeout(() => {
                            if (cellToDestroy1.element.parentNode) cellToDestroy1.element.parentNode.removeChild(cellToDestroy1.element);
                            if (cellToDestroy2.element.parentNode) cellToDestroy2.element.parentNode.removeChild(cellToDestroy2.element);
                        }, 150);

                        if (mergedValue === 2048) won = true;

                    } else {
                        // Just move
                        movedGrid[curr.y][curr.x] = cell;
                        if (curr.y !== y || curr.x !== x) {
                            moved = true;
                            cell.element.style.transform = getPosition(curr.y, curr.x);
                            cell.r = curr.y;
                            cell.c = curr.x;
                            // Reset z-index
                            cell.element.style.zIndex = 10;
                        }
                    }
                }
            });
        });

        if (moved) {
            grid = movedGrid;
            updateScore(pointsAdded);

            setTimeout(() => {
                addRandomTile();

                if (checkGameOver()) {
                    gameOver = true;
                    setTimeout(() => {
                        messageText.textContent = '¡Juego Terminado!';
                        gameMessage.className = 'game-message game-over';
                    }, 500);
                } else if (won && !keepPlayingAfterWin) {
                    setTimeout(() => {
                        messageText.textContent = '¡Ganaste!';
                        retryBtn.textContent = 'Seguir Jugando';
                        gameMessage.className = 'game-message game-won';
                    }, 500);
                }
            }, 150); // wait for tiles to finish sliding
        }
    }

    function checkGameOver() {
        for (let r = 0; r < 4; r++) {
            for (let c = 0; c < 4; c++) {
                if (!grid[r][c]) return false;
                const val = grid[r][c].value;
                if (c < 3 && grid[r][c + 1] && grid[r][c + 1].value === val) return false;
                if (r < 3 && grid[r + 1][c] && grid[r + 1][c].value === val) return false;
            }
        }
        return true;
    }

    // Input Control Logic
    document.addEventListener('keydown', (e) => {
        if (gameOver || (won && !keepPlayingAfterWin)) return;

        let handled = false;
        switch (e.key) {
            case 'ArrowLeft': move(0); handled = true; break;
            case 'ArrowUp': move(1); handled = true; break;
            case 'ArrowRight': move(2); handled = true; break;
            case 'ArrowDown': move(3); handled = true; break;
        }
        if (handled) {
            e.preventDefault();
        }
    });

    let touchStartX = 0;
    let touchStartY = 0;

    gridContainer.addEventListener('touchstart', (e) => {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        // Don't call e.preventDefault() here unless we want to block page scroll entirely,
        // but it's often needed to prevent pull-to-refresh
    }, { passive: true });

    gridContainer.addEventListener('touchmove', (e) => {
        e.preventDefault(); // Prevent scrolling while playing
    }, { passive: false });

    gridContainer.addEventListener('touchend', (e) => {
        if (gameOver || (won && !keepPlayingAfterWin)) return;

        const touchEndX = e.changedTouches[0].clientX;
        const touchEndY = e.changedTouches[0].clientY;

        const dx = touchEndX - touchStartX;
        const dy = touchEndY - touchStartY;

        if (Math.max(Math.abs(dx), Math.abs(dy)) > 30) {
            if (Math.abs(dx) > Math.abs(dy)) {
                move(dx > 0 ? 2 : 0);
            } else {
                move(dy > 0 ? 3 : 1);
            }
        }
    });

    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
    });

    installBtn.addEventListener('click', async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            console.log(`User response to the install prompt: ${outcome}`);
            deferredPrompt = null;
            installBtn.style.display = 'none';
        } else {
            alert('El juego no puede ser instalado en este momento.\n\nAsegúrate de estar ejecutando el juego desde un servidor (ej. Live Server, un hosting web) y no desde un archivo local, o de no haberlo instalado ya.');
        }
    });

    window.addEventListener('appinstalled', () => {
        installBtn.style.display = 'none';
        deferredPrompt = null;
        console.log('PWA fue instalada');
    });

    screenshotBtn.addEventListener('click', () => {
        if (typeof html2canvas !== 'undefined') {
            const appContainer = document.querySelector('.app-container');
            const originalText = screenshotBtn.textContent;
            screenshotBtn.textContent = '⏳';

            html2canvas(appContainer, {
                backgroundColor: '#0f172a',
                scale: 2
            }).then(canvas => {
                const link = document.createElement('a');
                link.download = '2048-captura.png';
                link.href = canvas.toDataURL('image/png');
                link.click();
                screenshotBtn.textContent = originalText;
            }).catch(err => {
                console.error("Error al capturar pantalla:", err);
                screenshotBtn.textContent = originalText;
            });
        } else {
            alert('La librería para capturas de pantalla no está cargada aún.');
        }
    });

    restartBtn.addEventListener('click', () => {
        initGame();
    });

    retryBtn.addEventListener('click', () => {
        if (won && !keepPlayingAfterWin) {
            keepPlayingAfterWin = true;
            gameMessage.className = 'game-message';
        } else {
            initGame();
        }
    });

    // Start
    initGame();
});
