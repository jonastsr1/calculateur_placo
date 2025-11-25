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
            width: Number(el.querySelector('.wall-width').value)
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
        
        walls.forEach((wall, index) => {
            let remainingWidth = wall.width;
            let currentX = 0;
            
            while (remainingWidth > 0) {
                // Use full plate width if possible, otherwise use remaining
                const pieceWidth = Math.min(remainingWidth, this.plateWidth);
                
                // If wall height > plate height, we need multiple vertical pieces
                // But for simplicity in V1, let's assume we cut pieces to fit wall height
                // If wall is taller than plate, we'll need to stack.
                // For this version: Just create pieces of (WallHeight x PieceWidth)
                // The packer will handle if they fit on a plate or not.
                // Wait, if a piece is 300cm high and plate is 250cm, it won't fit.
                // We need to split vertically too.
                
                let remainingHeight = wall.height;
                let currentY = 0;
                
                while (remainingHeight > 0) {
                    const pieceHeight = Math.min(remainingHeight, this.plateHeight);
                    
                    pieces.push({
                        width: pieceWidth,
                        height: pieceHeight,
                        wallIndex: index + 1,
                        label: `Mur ${index + 1}`
                    });
                    
                    remainingHeight -= pieceHeight;
                }
                
                remainingWidth -= pieceWidth;
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
                    freeRects: [{x: 0, y: 0, w: this.plateWidth, h: this.plateHeight}]
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

    // Guillotine packing helper
    fitInPlate(plate, piece) {
        // Find a free rectangle that fits the piece
        // We prioritize Best Area Fit
        let bestRectIndex = -1;
        let bestAreaDiff = Infinity;
        
        for (let i = 0; i < plate.freeRects.length; i++) {
            const rect = plate.freeRects[i];
            
            // Check if piece fits (try normal and rotated?)
            // Drywall usually has a direction (paper face), but rotation is often okay for small pieces.
            // Let's stick to non-rotated for main pieces to respect grain/edges if possible, 
            // but for optimization we usually allow rotation. Let's allow rotation.
            
            if (rect.w >= piece.width && rect.h >= piece.height) {
                const areaDiff = (rect.w * rect.h) - (piece.width * piece.height);
                if (areaDiff < bestAreaDiff) {
                    bestAreaDiff = areaDiff;
                    bestRectIndex = i;
                }
            }
        }
        
        if (bestRectIndex !== -1) {
            const rect = plate.freeRects[bestRectIndex];
            
            // Place piece
            plate.usedRects.push({
                x: rect.x,
                y: rect.y,
                w: piece.width,
                h: piece.height,
                label: piece.label
            });
            
            // Split the remaining free space (Guillotine split)
            // Split horizontally or vertically?
            // Heuristic: Split along the shorter axis to leave a larger rectangle
            
            const freeRectsToRemove = [bestRectIndex];
            const newFreeRects = [];
            
            // Create two new free rectangles
            // Top-Right and Bottom (or Bottom-Left and Right)
            
            // Split 1: Remaining width to the right
            if (rect.w > piece.width) {
                newFreeRects.push({
                    x: rect.x + piece.width,
                    y: rect.y,
                    w: rect.w - piece.width,
                    h: piece.height
                });
            }
            
            // Split 2: Remaining height below (full width of original rect)
            // Wait, standard guillotine is:
            // 1. Right: (x+w, y) size (W-w, h)
            // 2. Bottom: (x, y+h) size (W, H-h)
            // This overlaps.
            
            // Correct Guillotine MAXRECTS approach or simple split:
            // Split by width:
            // R1: x + w, y, W - w, H
            // R2: x, y + h, w, H - h
            
            // Let's use "Split Shorter Leftover Axis" rule
            const remW = rect.w - piece.width;
            const remH = rect.h - piece.height;
            
            if (remW < remH) {
                // Split vertical (cut extends down)
                // Right rect
                if (remW > 0) newFreeRects.push({ x: rect.x + piece.width, y: rect.y, w: remW, h: piece.height });
                // Bottom rect
                if (remH > 0) newFreeRects.push({ x: rect.x, y: rect.y + piece.height, w: rect.w, h: remH });
            } else {
                // Split horizontal (cut extends right)
                // Right rect
                if (remW > 0) newFreeRects.push({ x: rect.x + piece.width, y: rect.y, w: remW, h: rect.h });
                // Bottom rect
                if (remH > 0) newFreeRects.push({ x: rect.x, y: rect.y + piece.height, w: piece.width, h: remH });
            }
            
            // Remove used rect and add new ones
            plate.freeRects.splice(bestRectIndex, 1);
            plate.freeRects.push(...newFreeRects);
            
            return true;
        }
        
        return false;
    }

    displayResults(plates) {
        this.resultsSection.classList.remove('hidden');
        
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
