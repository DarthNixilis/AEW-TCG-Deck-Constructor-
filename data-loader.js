// data-loader.js
import * as state from './config.js';
import { initializeApp } from './app-init.js';

// --- DYNAMIC PATH DETECTION ---
function getBasePath() {
    const path = window.location.pathname;
    // This handles project pages like /RepoName/
    // It finds the first slash after the initial one.
    const secondSlashIndex = path.indexOf('/', 1); 
    if (secondSlashIndex !== -1) {
        // Extracts the repository name part (e.g., "/RepoName/")
        return path.substring(0, secondSlashIndex + 1);
    }
    // Fallback for root deployment (e.g., username.github.io) or local server
    return '/';
}
// --- END DYNAMIC PATH DETECTION ---

export async function loadGameData() {
    const searchResults = document.getElementById('searchResults');
    try {
        searchResults.innerHTML = '<p>Loading card data...</p>';

        const basePath = getBasePath();
        // Use the dynamically determined base path to build the correct URL
        const cardDbUrl = `${basePath}cardDatabase.txt?v=${new Date().getTime()}`;
        const keywordsUrl = `${basePath}keywords.txt?v=${new Date().getTime()}`;

        console.log(`Attempting to load data from: ${basePath}`); // Helpful for debugging

        const [cardResponse, keywordResponse] = await Promise.all([
            fetch(cardDbUrl),
            fetch(keywordsUrl)
        ]);

        if (!cardResponse.ok) throw new Error(`Could not load cardDatabase.txt (Status: ${cardResponse.status})`);
        if (!keywordResponse.ok) throw new Error(`Could not load keywords.txt (Status: ${keywordResponse.status})`);
        
        const tsvData = await cardResponse.text();
        const cardLines = tsvData.trim().split(/\r?\n/);
        const cardHeaders = cardLines.shift().trim().split('\t').map(h => h.trim());
        const parsedCards = cardLines.map(line => {
            const values = line.split('\t');
            const card = {};
            cardHeaders.forEach((header, index) => {
                const value = (values[index] || '').trim();
                if (value === 'null' || value === '') card[header] = null;
                else if (!isNaN(value) && value !== '') card[header] = Number(value);
                else card[header] = value;
            });
            card.title = card['Card Name'];
            card.card_type = card['Type'];
            card.cost = card['Cost'] === 'N/a' ? null : card['Cost'];
            card.damage = card['Damage'] === 'N/a' ? null : card['Damage'];
            card.momentum = card['Momentum'] === 'N/a' ? null : card['Momentum'];
            card.text_box = { raw_text: card['Card Raw Game Text'] };
            if (card.Keywords) card.text_box.keywords = card.Keywords.split(',').map(name => ({ name: name.trim() })).filter(k => k.name);
            else card.text_box.keywords = [];
            if (card.Traits) card.text_box.traits = card.Traits.split(',').map(traitStr => {
                const [name, value] = traitStr.split(':');
                return { name: name.trim(), value: value ? value.trim() : undefined };
            }).filter(t => t.name);
            else card.text_box.traits = [];
            return card;
        }).filter(card => card.title);
        state.setCardDatabase(parsedCards);

        const keywordText = await keywordResponse.text();
        const parsedKeywords = {};
        const keywordLines = keywordText.trim().split(/\r?\n/);
        keywordLines.forEach(line => {
            if (line.trim() === '') return;
            const parts = line.split(':');
            if (parts.length >= 2) {
                const key = parts[0].trim();
                const value = parts.slice(1).join(':').trim();
                parsedKeywords[key] = value;
            }
        });
        state.setKeywordDatabase(parsedKeywords);
        
        state.buildCardTitleCache();
        return true; // Signal success

    } catch (error) {
        console.error("Fatal Error during data load:", error);
        searchResults.innerHTML = `<div style="color: red; padding: 20px; text-align: center;"><strong>FATAL ERROR:</strong> ${error.message}<br><br><button onclick="location.reload()">Retry</button></div>`;
        return false; // Signal failure
    }
}

