// importer.js
import * as state from './config.js';
import { renderDecks, renderPersonaDisplay } from './ui.js';

export function parseAndLoadDeck(text) {
    const importStatus = document.getElementById('importStatus');
    const importModal = document.getElementById('importModal');
    const wrestlerSelect = document.getElementById('wrestlerSelect');
    const managerSelect = document.getElementById('managerSelect');
    try {
        const lines = text.trim().split(/\r?\n/);
        let newWrestler = null, newManager = null, newStartingDeck = [], newPurchaseDeck = [], currentSection = '';
        lines.forEach(line => {
            const trimmedLine = line.trim();
            if (!trimmedLine || trimmedLine.toLowerCase().startsWith('kit')) return;
            if (trimmedLine.toLowerCase().startsWith('wrestler:')) {
                const wrestlerName = trimmedLine.substring(9).trim();
                const wrestler = state.cardTitleCache[wrestlerName];
                if (wrestler && wrestler.card_type === 'Wrestler') newWrestler = wrestler;
            } else if (trimmedLine.toLowerCase().startsWith('manager:')) {
                const managerName = trimmedLine.substring(8).trim();
                if (managerName.toLowerCase() !== 'none') {
                    const manager = state.cardTitleCache[managerName];
                    if (manager && manager.card_type === 'Manager') newManager = manager;
                }
            } else if (trimmedLine.startsWith('--- Starting Deck')) { currentSection = 'starting'; }
            else if (trimmedLine.startsWith('--- Purchase Deck')) { currentSection = 'purchase'; }
            else {
                const match = trimmedLine.match(/^(\d+)x\s+(.+)/);
                if (match) {
                    const count = parseInt(match[1], 10);
                    const cardName = match[2].trim();
                    if (state.cardTitleCache[cardName]) {
                        for (let i = 0; i < count; i++) {
                            if (currentSection === 'starting') newStartingDeck.push(cardName);
                            else if (currentSection === 'purchase') newPurchaseDeck.push(cardName);
                        }
                    }
                }
            }
        });
        state.setSelectedWrestler(newWrestler);
        state.setSelectedManager(newManager);
        wrestlerSelect.value = newWrestler ? newWrestler.title : "";
        managerSelect.value = newManager ? newManager.title : "";
        state.setStartingDeck(newStartingDeck);
        state.setPurchaseDeck(newPurchaseDeck);
        renderDecks();
        renderPersonaDisplay();
        document.dispatchEvent(new Event('filtersChanged'));
        importStatus.textContent = 'Deck imported successfully!';
        importStatus.style.color = 'green';
        setTimeout(() => { importModal.style.display = 'none'; }, 1500);
    } catch (error) {
        console.error('Error parsing decklist:', error);
        importStatus.textContent = `An unexpected error occurred: ${error.message}`;
        importStatus.style.color = 'red';
    }
}
