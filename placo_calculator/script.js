class PlacoCalculator {
    constructor() {
        this.walls = [];
        this.plateHeight = 250;
        this.plateWidth = 120;

        this.initElements();
        this.attachListeners();
        this.addWall(); // Add initial wall input
    }

    initElements() {
        this.wallsContainer = document.getElementById('walls-container');
        this.addWallBtn = document.getElementById('add-wall-btn');
        this.calculateBtn = document.getElementById('calculate-btn');
        this.resultsSection = document.getElementById('results-section');
        this.visualizer = document.getElementById('visualizer');

        this.plateHeightInput = document.getElementById('plate-height');
        this.plateWidthInput = document.getElementById('plate-width');
    }

    attachListeners() {
        this.addWallBtn.addEventListener('click', () => this.addWall());
        this.calculateBtn.addEventListener('click', () => this.calculate());

        this.plateHeightInput.addEventListener('change', (e) => this.plateHeight = Number(e.target.value));
        this.plateWidthInput.addEventListener('change', (e) => this.plateWidth = Number(e.target.value));
    }

    addWall() {
        const id = Date.now();
        const wallDiv = document.createElement('div');
        wallDiv.className = 'wall-item';
        wallDiv.dataset.id = id;

        wallDiv.innerHTML = `
            <div class="form-group">
                <label>Hauteur Mur (cm)</label>
                <input type="number" class="wall-height" value="250" min="1">
            </div>
            <div class="form-group">
                <label>Largeur Mur (cm)</label>
                <input type="number" class="wall-width" value="300" min="1">
            </div>
            <div class="form-group">
                <label>Quantité</label>
                <input type="number" class="wall-qty" value="1" min="1">
            </div>
            <button class="btn btn-icon remove-wall" title="Supprimer">
                ✕
            </button>
        `;

        wallDiv.querySelector('.remove-wall').addEventListener('click', () => {
            if (this.wallsContainer.children.length > 1) {
                wallDiv.remove();
            }
        });

        this.wallsContainer.appendChild(wallDiv);
    }

    getWalls() {
        const wallElements = document.querySelectorAll('.wall-item');
        return Array.from(wallElements).map(el => ({
            height: Number(el.querySelector('.wall-height').value),
            width: Number(el.querySelector('.wall-width').value),
            qty: Number(el.querySelector('.wall-qty').value)
        }));
    }

    calculate() {
        const walls = this.getWalls();
        const pieces = this.decomposeWalls(walls);
        const result = this.packPieces(pieces);

        this.displayResults(result);
    }

    // Break down walls into required rectangular pieces
    // Assuming vertical installation of plates
    decomposeWalls(walls) {
        let pieces = [];

        walls.forEach((wall, wallIndex) => {
            // Repeat for the specified quantity
            for (let q = 0; q < wall.qty; q++) {
                let remainingWidth = wall.width;
                
                while (remainingWidth > 0) {
                    // Use full plate width if possible, otherwise use remaining
                    const pieceWidth = Math.min(remainingWidth, this.plateWidth);
                    
                    let remainingHeight = wall.height;
                    
                    while (remainingHeight > 0) {
                        const pieceHeight = Math.min(remainingHeight, this.plateHeight);

                        pieces.push({
                            width: pieceWidth,
                            height: pieceHeight,
                            wallIndex: wallIndex + 1,
                            label: `Mur ${wallIndex + 1}${wall.qty > 1 ? `.${q + 1}` : ''}`
                        });

                        remainingHeight -= pieceHeight;
                    }

                    remainingWidth -= pieceWidth;
                }
            }
        });

        // Sort pieces by area (largest first) for better packing
        return pieces.sort((a, b) => (b.width * b.height) - (a.width * a.height));
    }

    // Simple First Fit Decreasing algorithm
    packPieces(pieces) {
        const plates = [];

        pieces.forEach(piece => {
            let placed = false;

            // Try to fit in existing plates
            for (let plate of plates) {
                if (this.fitInPlate(plate, piece)) {
                    placed = true;
                    break;
                }
            }

            // If not placed, create new plate
            if (!placed) {
                const newPlate = {
                    width: this.plateWidth,
                    height: this.plateHeight,
                    usedRects: [],
                    freeRects: [{ x: 0, y: 0, w: this.plateWidth, h: this.plateHeight }]
                };

                if (this.fitInPlate(newPlate, piece)) {
                    plates.push(newPlate);
                } else {
                    console.error("Piece too large for plate!", piece);
                    // Handle error or split piece further?
                    // For now, ignore oversized pieces
                }
            }
        });
        
        return plates;
    }

    fitInPlate(plate, piece) {
        // Find a free rectangle that fits the piece
        // Best Fit approach could be better, but First Fit is simpler
        for (let i = 0; i < plate.freeRects.length; i++) {
            const freeRect = plate.freeRects[i];

            if (freeRect.w >= piece.width && freeRect.h >= piece.height) {
                // Place the piece
                plate.usedRects.push({
                    x: freeRect.x,
                    y: freeRect.y,
                    w: piece.width,
                    h: piece.height,
                    label: piece.label
                });

                // Split the free rectangle
                // We split into two: one to the right and one below
                // (Maximal Rectangles approach is more complex, using simple split here)
                
                // New free rect to the right of the placed piece
                const rightRect = {
                    x: freeRect.x + piece.width,
                    y: freeRect.y,
                    w: freeRect.w - piece.width,
                    h: piece.height
                };

                // New free rect below the placed piece (spanning full width of original free rect)
                const bottomRect = {
                    x: freeRect.x,
                    y: freeRect.y + piece.height,
                    w: freeRect.w,
                    h: freeRect.h - piece.height
                };

                // Remove the used free rect and add the new ones if they have area
                plate.freeRects.splice(i, 1);
                
                if (rightRect.w > 0 && rightRect.h > 0) plate.freeRects.push(rightRect);
                if (bottomRect.w > 0 && bottomRect.h > 0) plate.freeRects.push(bottomRect);

                return true;
            }
        }
        return false;
    }

    displayResults(plates) {
        // Stats
        document.getElementById('total-plates').textContent = plates.length;

        const totalPlateArea = plates.length * this.plateWidth * this.plateHeight;
        const usedArea = plates.reduce((sum, plate) => {
            return sum + plate.usedRects.reduce((pSum, rect) => pSum + (rect.w * rect.h), 0);
        }, 0);

        const waste = totalPlateArea > 0 ? ((totalPlateArea - usedArea) / totalPlateArea * 100) : 0;

        document.getElementById('total-area').textContent = (usedArea / 10000).toFixed(2) + ' m²';
        document.getElementById('waste-percent').textContent = waste.toFixed(1) + '%';

        // Visuals
        this.visualizer.innerHTML = '';
        plates.forEach((plate, index) => {
            this.createPlateVisual(plate, index);
        });

        // Scroll to results
        this.resultsSection.classList.remove('hidden');
        this.resultsSection.scrollIntoView({ behavior: 'smooth' });
    }

    createPlateVisual(plate, index) {
        const wrapper = document.createElement('div');
        wrapper.className = 'plate-visual';

        const header = document.createElement('div');
        header.className = 'plate-header';
        header.innerHTML = `<span>Plaque ${index + 1}</span> <span>${this.plateHeight}x${this.plateWidth}</span>`;

        const container = document.createElement('div');
        container.className = 'plate-canvas-container';
        // Adjust aspect ratio dynamically
        container.style.aspectRatio = `${this.plateWidth}/${this.plateHeight}`;

        plate.usedRects.forEach(rect => {
            const el = document.createElement('div');
            el.className = 'cut-piece';
            el.style.left = (rect.x / this.plateWidth * 100) + '%';
            el.style.top = (rect.y / this.plateHeight * 100) + '%';
            el.style.width = (rect.w / this.plateWidth * 100) + '%';
            el.style.height = (rect.h / this.plateHeight * 100) + '%';
            el.title = `${rect.label}: ${rect.h}x${rect.w}cm`;
            el.textContent = `${rect.h}x${rect.w}`;
            container.appendChild(el);
        });

        wrapper.appendChild(header);
        wrapper.appendChild(container);
        this.visualizer.appendChild(wrapper);
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    new PlacoCalculator();
});
