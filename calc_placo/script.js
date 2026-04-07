class PlacoCalculator {
    constructor() {
        this.walls = [];
        this.plateHeight = 250;
        this.plateWidth = 120;
        this.kerf = 0.5; // 5mm blade thickness

        this.initElements();
        this.attachListeners();
        this.addWall(); // Add initial wall input
    }

    initElements() {
        this.wallsContainer = document.getElementById('walls-container');
        this.addWallBtn = document.getElementById('add-wall-btn');
        this.calculateBtn = document.getElementById('calculate-btn');
        this.exportBtn = document.getElementById('export-pdf-btn');
        this.resultsSection = document.getElementById('results-section');
        this.visualizer = document.getElementById('visualizer');

        this.plateHeightInput = document.getElementById('plate-height');
        this.plateWidthInput = document.getElementById('plate-width');

        // Site information inputs
        this.siteNameInput = document.getElementById('site-name');
        this.siteAddressInput = document.getElementById('site-address');
        this.orderNumberInput = document.getElementById('order-number');
        
        // New inputs
        this.promatectInput = document.getElementById('promatect');
        this.conduitHeightInput = document.getElementById('conduit-height');
        this.altimetrieInput = document.getElementById('altimetrie');

        // Langette inputs
        this.langetteEnabledInput = document.getElementById('langette-enabled');
        this.langetteHeightInput = document.getElementById('langette-height');
        this.langetteOptions = document.getElementById('langette-options');

        this.langetteEnabled = false;
        this.langetteHeight = 20;

        this.currentPlates = [];
    }

    attachListeners() {
        this.addWallBtn.addEventListener('click', () => this.addWall());
        this.calculateBtn.addEventListener('click', () => this.calculate());
        this.exportBtn.addEventListener('click', () => this.generatePDF());

        this.plateHeightInput.addEventListener('change', (e) => this.plateHeight = Number(e.target.value));
        this.plateWidthInput.addEventListener('change', (e) => this.plateWidth = Number(e.target.value));

        this.langetteEnabledInput.addEventListener('change', (e) => {
            this.langetteEnabled = e.target.checked;
            if (this.langetteEnabled) {
                this.langetteOptions.classList.remove('hidden');
            } else {
                this.langetteOptions.classList.add('hidden');
            }
        });
        this.langetteHeightInput.addEventListener('change', (e) => this.langetteHeight = Number(e.target.value));
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
                <input type="number" class="wall-width" value="60" min="1">
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
        this.currentPlates = result;

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

                    // Langette au milieu de la pièce (additional central strip)
                    if (this.langetteEnabled && this.langetteHeight > 0) {
                        const wallLabel = `Mur ${wallIndex + 1}${wall.qty > 1 ? `.${q + 1}` : ''}`;
                        let remainingLangetteHeight = this.langetteHeight;

                        while (remainingLangetteHeight > 0) {
                            const lh = Math.min(remainingLangetteHeight, this.plateHeight);
                            pieces.push({
                                width: pieceWidth,
                                height: lh,
                                wallIndex: wallIndex + 1,
                                label: `Langette ${wallLabel}`,
                                isLangette: true
                            });
                            remainingLangetteHeight -= lh;
                        }
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
                    label: piece.label,
                    isLangette: piece.isLangette || false
                });

                // Split the free rectangle
                // We split into two: one to the right and one below
                // (Maximal Rectangles approach is more complex, using simple split here)

                // New free rect to the right of the placed piece
                // Subtract kerf from the remaining width
                const rightRectX = freeRect.x + piece.width + this.kerf;
                const rightRectW = freeRect.w - piece.width - this.kerf;

                const rightRect = {
                    x: rightRectX,
                    y: freeRect.y,
                    w: Math.max(0, rightRectW),
                    h: piece.height
                };

                // New free rect below the placed piece (spanning full width of original free rect)
                // Subtract kerf from the remaining height
                const bottomRectY = freeRect.y + piece.height + this.kerf;
                const bottomRectH = freeRect.h - piece.height - this.kerf;

                const bottomRect = {
                    x: freeRect.x,
                    y: bottomRectY,
                    w: freeRect.w,
                    h: Math.max(0, bottomRectH)
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
        const wasteArea = totalPlateArea - usedArea; // Surface des chutes en cm²

        document.getElementById('total-area').textContent = (usedArea / 10000).toFixed(2) + ' m²';
        document.getElementById('waste-percent').textContent = waste.toFixed(1) + '%';
        document.getElementById('waste-area').textContent = (wasteArea / 10000).toFixed(2) + ' m²';
        document.getElementById('plates-area').textContent = (totalPlateArea / 10000).toFixed(2) + ' m²';

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
            el.className = rect.isLangette ? 'cut-piece langette' : 'cut-piece';
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

    generatePDF() {
        if (!this.currentPlates || this.currentPlates.length === 0) {
            alert("Veuillez d'abord lancer le calcul.");
            return;
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        // ---------------------------------------------------------
        // COULEURS AIREXO (basées sur le logo)
        // ---------------------------------------------------------
        const colors = {
            darkBlue: [26, 58, 92],       // #1a3a5c - Bleu foncé
            mediumBlue: [45, 125, 210],   // #2d7dd2 - Bleu moyen
            lightBlue: [92, 200, 232],    // #5cc8e8 - Bleu clair
            white: [255, 255, 255],
            lightGray: [240, 245, 250]    // Gris bleuté léger
        };

        // ---------------------------------------------------------
        // 1. PRÉPARATION DES DONNÉES (Regroupement des coupes identiques)
        // ---------------------------------------------------------
        const cutsSummary = {};
        const langetteSummary = {};
        
        this.currentPlates.forEach(plate => {
            plate.usedRects.forEach(rect => {
                // Créer une clé unique pour dimensions (Ex: "250x30")
                const key = `${rect.h}x${rect.w}`;
                if (rect.isLangette) {
                    if (!langetteSummary[key]) {
                        langetteSummary[key] = { h: rect.h, w: rect.w, qty: 0 };
                    }
                    langetteSummary[key].qty++;
                } else {
                    if (!cutsSummary[key]) {
                        cutsSummary[key] = { h: rect.h, w: rect.w, qty: 0 };
                    }
                    cutsSummary[key].qty++;
                }
            });
        });

        // Convertir l'objet en tableau pour le PDF
        const rowsDecoupe = Object.values(cutsSummary).map(item => [
            item.qty,       // Quantité
            item.h,         // Hauteur
            item.w          // Largeur
        ]);

        // Ajouter les langettes avec un séparateur si présentes
        if (Object.keys(langetteSummary).length > 0) {
            rowsDecoupe.push(["--- Langettes centrales ---", "", ""]);
            Object.values(langetteSummary).forEach(item => {
                rowsDecoupe.push([item.qty, item.h, item.w]);
            });
        }

        // Remplir avec des lignes vides pour atteindre au moins 15 lignes (look pro)
        while (rowsDecoupe.length < 15) {
            rowsDecoupe.push(["", "", ""]);
        }

        // ---------------------------------------------------------
        // 2. EN-TÊTE (Header style AIREXO)
        // ---------------------------------------------------------
        const leftMargin = 15;
        let yPos = 15;

        // Titre AIREXO
        doc.setFontSize(22);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...colors.darkBlue);
        doc.text("AIREXO", leftMargin, yPos);
        
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...colors.mediumBlue);
        doc.text("Solutions Protection Incendie", leftMargin, yPos + 6);
        
        doc.setFontSize(9);
        doc.setTextColor(100, 100, 100);
        yPos += 14;
        doc.text("AIREXO - 8 rue Louis Lagrange ZA des Plesses - 85180 LES SABLES D'OLONNE", leftMargin, yPos);

        // Ligne de séparation
        yPos += 5;
        doc.setDrawColor(...colors.lightBlue);
        doc.setLineWidth(0.5);
        doc.line(leftMargin, yPos, 195, yPos);

        // Récupération des valeurs
        const nomChantier = this.siteNameInput.value || "";
        const adresse = this.siteAddressInput.value || "";
        const commande = this.orderNumberInput.value || "";

        // Affichage des infos chantier sous la ligne
        yPos += 8;
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...colors.darkBlue);
        doc.text("Chantier :", leftMargin, yPos);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(60, 60, 60);
        doc.text(nomChantier, leftMargin + 22, yPos);
        
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...colors.darkBlue);
        doc.text("N° Commande :", 120, yPos);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(60, 60, 60);
        doc.text(commande, 152, yPos);
        
        yPos += 6;
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...colors.darkBlue);
        doc.text("Adresse :", leftMargin, yPos);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(60, 60, 60);
        doc.text(adresse, leftMargin + 20, yPos);

        yPos = 58; // On descend pour le premier tableau

        // ---------------------------------------------------------
        // 3. TABLEAU INFO CONDUIT (Dynamique selon sélection utilisateur)
        // ---------------------------------------------------------
        // Récupérer l'orientation sélectionnée
        const orientationValue = document.querySelector('input[name="orientation"]:checked')?.value || 'vertical';
        const isVertical = orientationValue === 'vertical';
        const verticalCheck = isVertical ? 'Verticale [ X ]' : 'Verticale [  ]';
        const horizontalCheck = isVertical ? 'Horizontale [  ]' : 'Horizontale [ X ]';
        
        // Récupérer les nouvelles valeurs
        const promatectValue = this.promatectInput?.value || '';
        const conduitHeightValue = this.conduitHeightInput?.value || '';
        const altimetrieValue = this.altimetrieInput?.value || '';
        
        doc.autoTable({
            startY: yPos,
            head: [['Type du conduit', verticalCheck, horizontalCheck]],
            body: [
                ['PROMATECT L-500', promatectValue, ''],
                ['Hauteur du conduit', conduitHeightValue, 'Section int. du conduit'],
                ['Al (altimétrie)', altimetrieValue, ''],
                ['Langette centrale', this.langetteEnabled ? `Oui — ${this.langetteHeight} cm` : 'Non', '']
            ],
            theme: 'grid',
            headStyles: { fillColor: colors.mediumBlue, textColor: 255, fontStyle: 'bold', lineColor: colors.darkBlue, lineWidth: 0.2 },
            styles: { lineColor: colors.darkBlue, lineWidth: 0.1, textColor: 0 },
            columnStyles: {
                0: { fontStyle: 'bold', cellWidth: 60 },
                1: { cellWidth: 60 },
                2: { cellWidth: 60 }
            }
        });

        yPos = doc.lastAutoTable.finalY + 15;

        // ---------------------------------------------------------
        // 4. TITRE TABLEAU DÉBIT
        // ---------------------------------------------------------
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...colors.darkBlue);
        doc.text("Quantité panneau pour débit en cm", leftMargin, yPos);
        yPos += 2;

        // ---------------------------------------------------------
        // 5. TABLEAU DE DÉCOUPE (Données dynamiques)
        // ---------------------------------------------------------
        doc.autoTable({
            startY: yPos,
            head: [['Quantité', 'Hauteur', 'Largeur']],
            body: rowsDecoupe,
            theme: 'striped',
            styles: { 
                lineColor: colors.darkBlue, 
                lineWidth: 0.1, 
                minCellHeight: 8,
                valign: 'middle',
                halign: 'center',
                textColor: [40, 40, 40]
            },
            headStyles: { 
                fillColor: colors.mediumBlue, 
                textColor: 255, 
                fontStyle: 'bold',
                lineWidth: 0.2,
                lineColor: colors.darkBlue
            },
            alternateRowStyles: {
                fillColor: colors.lightGray
            }
        });

        yPos = doc.lastAutoTable.finalY + 15;

        // ---------------------------------------------------------
        // 6. TABLEAU RÉCAPITULATIF PLAQUES
        // ---------------------------------------------------------
        // Calcul du nombre total de plaques
        const nbPlaques = this.currentPlates.length;

        doc.autoTable({
            startY: yPos,
            head: [['Quantité plaque pour débit en cm', 'Dimensions plaques', 'Nbre']],
            body: [
                ['', `${this.plateHeight / 100} M. x ${this.plateWidth / 100} M.`, nbPlaques]
            ],
            theme: 'grid',
            styles: { lineColor: colors.darkBlue, lineWidth: 0.1, textColor: [40, 40, 40], halign: 'center', minCellHeight: 10, valign: 'middle' },
            headStyles: { fillColor: colors.lightBlue, textColor: colors.darkBlue, fontStyle: 'bold', lineWidth: 0.2, lineColor: colors.darkBlue },
            columnStyles: {
                0: { cellWidth: 80 },
                1: { cellWidth: 60, fontStyle: 'bold' },
                2: { cellWidth: 30, fontStyle: 'bold', fontSize: 12, textColor: colors.darkBlue }
            }
        });

        // ---------------------------------------------------------
        // 7. PLAN DE DÉCOUPE VISUEL (4 plaques par page)
        // ---------------------------------------------------------
        doc.addPage();
        
        // Configuration pour 4 plaques par page (2x2)
        const pageWidth = 210;
        const pageHeight = 297;
        const margin = 15;
        const titleHeight = 25;
        const plateSpacingX = 10;
        const plateSpacingY = 15;
        
        // Calcul de la taille disponible pour chaque plaque (2 colonnes, 2 lignes)
        const availablePlateWidth = (pageWidth - 2 * margin - plateSpacingX) / 2;
        const availablePlateHeight = (pageHeight - margin - titleHeight - plateSpacingY) / 2 - 15;
        
        // Positions de départ pour les 4 emplacements
        const positions = [
            { x: margin, y: titleHeight + 5 },                                    // Haut gauche
            { x: margin + availablePlateWidth + plateSpacingX, y: titleHeight + 5 },  // Haut droite
            { x: margin, y: titleHeight + 5 + availablePlateHeight + plateSpacingY }, // Bas gauche
            { x: margin + availablePlateWidth + plateSpacingX, y: titleHeight + 5 + availablePlateHeight + plateSpacingY } // Bas droite
        ];

        let plateOnPage = 0;

        this.currentPlates.forEach((plate, index) => {
            // Nouvelle page si on a déjà 4 plaques
            if (plateOnPage >= 4) {
                doc.addPage();
                plateOnPage = 0;
            }

            // Titre de la page (seulement sur la première plaque de chaque page)
            if (plateOnPage === 0) {
                doc.setFontSize(14);
                doc.setFont("helvetica", "bold");
                doc.setTextColor(...colors.darkBlue);
                doc.text("Plan de découpe détaillé", leftMargin, 15);
            }

            const pos = positions[plateOnPage];
            
            // Calculer l'échelle pour que la plaque rentre dans l'espace disponible
            const scaleX = (availablePlateWidth - 10) / this.plateWidth;
            const scaleY = (availablePlateHeight - 20) / this.plateHeight;
            const displayScale = Math.min(scaleX, scaleY);
            
            const finalW = this.plateWidth * displayScale;
            const finalH = this.plateHeight * displayScale;
            
            // Centrer la plaque dans son espace
            const offsetX = (availablePlateWidth - finalW) / 2;
            const offsetY = 12; // Espace pour le titre de la plaque

            // Titre de la plaque
            doc.setFontSize(10);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(...colors.darkBlue);
            doc.text(`Plaque ${index + 1} (${this.plateHeight}x${this.plateWidth} cm)`, pos.x, pos.y);

            // Cadre Plaque avec couleur AIREXO
            doc.setDrawColor(...colors.darkBlue);
            doc.setLineWidth(0.5);
            doc.rect(pos.x + offsetX, pos.y + offsetY, finalW, finalH);

            // Pièces avec couleur bleue claire
            plate.usedRects.forEach(rect => {
                doc.setFillColor(...colors.lightGray);
                doc.setDrawColor(...colors.mediumBlue);
                doc.setLineWidth(0.3);
                doc.rect(
                    pos.x + offsetX + (rect.x * displayScale), 
                    pos.y + offsetY + (rect.y * displayScale), 
                    rect.w * displayScale, 
                    rect.h * displayScale, 
                    'FD'
                );
                
                // Texte dans la pièce (si assez grand)
                const textWidth = rect.w * displayScale;
                const textHeight = rect.h * displayScale;
                if (textWidth > 15 && textHeight > 8) {
                    doc.setFontSize(6);
                    doc.setTextColor(...colors.darkBlue);
                    doc.text(
                        `${rect.h}x${rect.w}`, 
                        pos.x + offsetX + (rect.x * displayScale) + 1, 
                        pos.y + offsetY + (rect.y * displayScale) + 4
                    );
                }
            });

            plateOnPage++;
        });

        doc.save("tableau_debit_airexo.pdf");
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    new PlacoCalculator();
});
