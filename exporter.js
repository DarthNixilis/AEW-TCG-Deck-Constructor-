// exporter.js
import * as state from './config.js';
import { generatePlaytestCardHTML } from './card-renderer.js';
import { toPascalCase } from './config.js';

export function generatePlainTextDeck() {
    const activePersonaTitles = [];
    if (state.selectedWrestler) activePersonaTitles.push(state.selectedWrestler.title);
    if (state.selectedManager) activePersonaTitles.push(state.selectedManager.title);
    const kitCards = state.cardDatabase.filter(card => state.isKitCard(card) && activePersonaTitles.includes(card['Signature For'])).sort((a, b) => a.title.localeCompare(b.title));
    let text = `Wrestler: ${state.selectedWrestler ? state.selectedWrestler.title : 'None'}\n`;
    text += `Manager: ${state.selectedManager ? state.selectedManager.title : 'None'}\n`;
    kitCards.forEach((card, index) => { text += `Kit${index + 1}: ${card.title}\n`; });
    text += `\n--- Starting Deck (${state.startingDeck.length}/24) ---\n`;
    const startingCounts = state.startingDeck.reduce((acc, cardTitle) => { acc[cardTitle] = (acc[cardTitle] || 0) + 1; return acc; }, {});
    Object.entries(startingCounts).sort((a, b) => a[0].localeCompare(b[0])).forEach(([cardTitle, count]) => { text += `${count}x ${cardTitle}\n`; });
    text += `\n--- Purchase Deck (${state.purchaseDeck.length}/36+) ---\n`;
    const purchaseCounts = state.purchaseDeck.reduce((acc, cardTitle) => { acc[cardTitle] = (acc[cardTitle] || 0) + 1; return acc; }, {});
    Object.entries(purchaseCounts).sort((a, b) => a[0].localeCompare(b[0])).forEach(([cardTitle, count]) => { text += `${count}x ${cardTitle}\n`; });
    return text;
}

export async function exportDeckAsImage() {
    const uniquePersonaAndKit = [];
    const activePersonaTitles = [];
    if (state.selectedWrestler) {
        uniquePersonaAndKit.push(state.selectedWrestler);
        activePersonaTitles.push(state.selectedWrestler.title);
    }
    if (state.selectedManager) {
        uniquePersonaAndKit.push(state.selectedManager);
        activePersonaTitles.push(state.selectedManager.title);
    }
    const kitCards = state.cardDatabase.filter(card => state.isKitCard(card) && activePersonaTitles.includes(card['Signature For']));
    uniquePersonaAndKit.push(...kitCards);
    const finalUniquePersonaAndKit = [...new Map(uniquePersonaAndKit.map(card => [card.title, card])).values()];
    const mainDeckCards = [...state.startingDeck, ...state.purchaseDeck].map(title => state.cardTitleCache[title]);
    const allCardsToPrint = [...finalUniquePersonaAndKit, ...mainDeckCards].filter(card => card !== undefined);

    if (allCardsToPrint.length === 0) {
        alert("There are no cards in the deck to export.");
        return;
    }

    const CARDS_PER_PAGE = 9;
    const numPages = Math.ceil(allCardsToPrint.length / CARDS_PER_PAGE);
    if (!confirm(`This will generate ${numPages} print sheet(s) for ${allCardsToPrint.length} total cards. Continue?`)) {
        return;
    }

    const DPI = 300;
    const CARD_RENDER_WIDTH_PX = 2.5 * DPI;
    const CARD_RENDER_HEIGHT_PX = 3.5 * DPI;
    const tempContainer = document.createElement('div');
    tempContainer.style.position = 'absolute';
    tempContainer.style.left = '-9999px';
    document.body.appendChild(tempContainer);

    for (let page = 0; page < numPages; page++) {
        const canvas = document.createElement('canvas');
        canvas.width = 8.5 * DPI;
        canvas.height = 11 * DPI;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const startIndex = page * CARDS_PER_PAGE;
        const endIndex = startIndex + CARDS_PER_PAGE;
        const cardsOnThisPage = allCardsToPrint.slice(startIndex, endIndex);

        for (let i = 0; i < cardsOnThisPage.length; i++) {
            const card = cardsOnThisPage[i];
            const row = Math.floor(i / 3), col = i % 3;
            const x = (0.5 * DPI) + (col * CARD_RENDER_WIDTH_PX), y = (0.5 * DPI) + (row * CARD_RENDER_HEIGHT_PX);
            
            const playtestHTML = await generatePlaytestCardHTML(card, tempContainer);
            tempContainer.innerHTML = playtestHTML;
            const playtestElement = tempContainer.firstElementChild;

            try {
                const cardCanvas = await html2canvas(playtestElement, { width: CARD_RENDER_WIDTH_PX, height: CARD_RENDER_HEIGHT_PX, scale: 1, logging: false });
                ctx.drawImage(cardCanvas, x, y);
            } catch (error) {
                console.error(`Failed to render card "${card.title}" to canvas:`, error);
            }
        }

        const dataUrl = canvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = dataUrl;
        const wrestlerName = state.selectedWrestler ? toPascalCase(state.selectedWrestler.title) : "Deck";
        a.download = `${wrestlerName}-Page-${page + 1}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    document.body.removeChild(tempContainer);
    alert('All print sheets have been generated and downloaded!');
}
