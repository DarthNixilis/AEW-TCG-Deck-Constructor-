document.addEventListener('DOMContentLoaded', () => {
    // --- DOM ELEMENT REFERENCES ---
    const searchInput = document.getElementById('searchInput');
    const cascadingFiltersContainer = document.getElementById('cascadingFiltersContainer');
    const searchResults = document.getElementById('searchResults');
    // ... (rest of DOM references are the same) ...
    const viewModeToggle = document.getElementById('viewModeToggle');

    // --- STATE MANAGEMENT ---
    let cardDatabase = [];
    let keywordDatabase = {}; // NEW: To store keyword definitions
    let startingDeck = [];
    // ... (rest of state management is the same) ...
    let lastFocusedElement;

    // --- UTILITY & DATA FETCHING ---
    function debounce(func, wait) { /* ... (same as before) ... */ }

    async function loadGameData() {
        try {
            // NEW: Load both files concurrently
            const [cardResponse, keywordResponse] = await Promise.all([
                fetch(`./cardDatabase.json?v=${new Date().getTime()}`),
                fetch(`./keywords.json?v=${new Date().getTime()}`)
            ]);

            if (!cardResponse.ok) throw new Error(`Could not load cardDatabase.json (Status: ${cardResponse.status})`);
            if (!keywordResponse.ok) throw new Error(`Could not load keywords.json (Status: ${keywordResponse.status})`);

            cardDatabase = await cardResponse.json();
            keywordDatabase = await keywordResponse.json();
            
            initializeApp();
        } catch (error) {
            console.error("Could not load game data:", error);
            searchResults.innerHTML = `<p style="color: red;"><strong>Error:</strong> ${error.message}</p>`;
        }
    }
function populatePersonaSelectors() {
    wrestlerSelect.length = 1; // Clear previous options but keep the placeholder
    managerSelect.length = 1;  // Clear previous options but keep the placeholder

    const wrestlers = cardDatabase.filter(c => c && c.card_type === 'Wrestler').sort((a, b) => a.title.localeCompare(b.title));
    const managers = cardDatabase.filter(c => c && c.card_type === 'Manager').sort((a, b) => a.title.localeCompare(b.title));

    wrestlers.forEach(w => {
        const option = document.createElement('option');
        option.value = w.id;
        option.textContent = w.title;
        wrestlerSelect.appendChild(option);
    });

    managers.forEach(m => {
        const option = document.createElement('option');
        option.value = m.id;
        option.textContent = m.title;
        managerSelect.appendChild(option);
    });
}

    // --- INITIALIZATION ---
    function initializeApp() {
        populatePersonaSelectors();
        renderCascadingFilters();
        renderCardPool();
        addDeckSearchFunctionality();
        addEventListeners();
    }
    
    // ... (populatePersonaSelectors remains the same) ...

    // --- CORE GAME LOGIC & HELPERS ---
    // ... (toPascalCase, isSignatureFor, isLogoCard remain the same) ...

    // --- FILTER LOGIC ---
    // ... (filterFunctions, getAvailableFilterOptions, renderCascadingFilters, applySingleFilter remain the same) ...

    // --- RENDERING & CARD POOL LOGIC ---
    // ... (getFilteredCardPool, renderCardPool remain the same) ...

    // **UPDATED** to use the new keywordDatabase
    function generateCardVisualHTML(card) {
        const imageName = toPascalCase(card.title);
        const imagePath = `card-images/${imageName}.png?v=${new Date().getTime()}`;
        
        // Dynamically build keywords and traits text
        let keywordsText = (card.text_box?.keywords || [])
            .map(kw => `<strong>${kw.name}:</strong> ${keywordDatabase[kw.name] || 'Definition not found.'}`)
            .join('<br>');

        let traitsText = (card.text_box?.traits || [])
            .map(tr => `<strong>${tr.name}:</strong> ${tr.value || ''}`)
            .join('<br>');

        const placeholderHTML = `
            <div class="placeholder-card">
                <div class="placeholder-header"><span>${card.title}</span><span>C: ${card.cost ?? 'N/A'}</span></div>
                <div class="placeholder-art-area"><span>Art Missing</span></div>
                <div class="placeholder-type-line"><span>${card.card_type}</span></div>
                <div class="placeholder-text-box">
                    <p>${card.text_box?.raw_text || ''}</p>
                    <hr>
                    <p>${keywordsText}</p>
                    <p>${traitsText}</p>
                </div>
                <div class="placeholder-stats"><span>D: ${card.damage ?? 'N/A'}</span><span>M: ${card.momentum ?? 'N/A'}</span></div>
            </div>`;
        return `
            <img src="${imagePath}" alt="${card.title}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
            <div style="display: none;">${placeholderHTML}</div>`;
    }

    // ... (All other functions from renderPersonaDisplay to the end remain the same) ...

    // --- START THE APP ---
    loadGameData(); // Changed from loadCardDatabase
});

