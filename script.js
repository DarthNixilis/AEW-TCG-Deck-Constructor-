document.addEventListener('DOMContentLoaded', () => {
    // --- DOM ELEMENT REFERENCES ---
    const searchInput = document.getElementById('searchInput');
    const cascadingFiltersContainer = document.getElementById('cascadingFiltersContainer');
    const searchResults = document.getElementById('searchResults');
    const startingDeckList = document.getElementById('startingDeckList');
    const purchaseDeckList = document.getElementById('purchaseDeckList');
    const startingDeckCount = document.getElementById('startingDeckCount');
    const purchaseDeckCount = document.getElementById('purchaseDeckCount');
    const saveDeckBtn = document.getElementById('saveDeck');
    const clearDeckBtn = document.getElementById('clearDeck');
    const wrestlerSelect = document.getElementById('wrestlerSelect');
    const managerSelect = document.getElementById('managerSelect');
    const buildModeToggle = document.getElementById('buildModeToggle');
    const currentModeSpan = document.getElementById('currentMode');
    const personaDisplay = document.getElementById('personaDisplay');
    const cardModal = document.getElementById('cardModal');
    const modalCardContent = document.getElementById('modalCardContent');
    const modalCloseButton = document.querySelector('.modal-close-button');

    // --- STATE MANAGEMENT ---
    let cardDatabase = [];
    let startingDeck = [];
    let purchaseDeck = [];
    let selectedWrestler = null;
    let selectedManager = null;
    let currentBuildMode = 'starting';
    let activeFilters = [{}, {}, {}];

    // --- DATA FETCHING ---
    async function loadCardDatabase() {
        try {
            const response = await fetch('cardDatabase.json');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            cardDatabase = await response.json();
            initializeApp();
        } catch (error) {
            console.error("Could not load card database:", error);
            searchResults.innerHTML = `<p style="color: red;">Error: Could not load cardDatabase.json. Please ensure the file exists.</p>`;
        }
    }

    // --- INITIALIZATION ---
    function initializeApp() {
        populatePersonaSelectors();
        renderCascadingFilters();
        renderCardPool();
        addEventListeners();
    }

    function populatePersonaSelectors() {
        const wrestlers = cardDatabase.filter(c => c.card_type === 'Wrestler').sort((a, b) => a.title.localeCompare(b.title));
        const managers = cardDatabase.filter(c => c.card_type === 'Manager').sort((a, b) => a.title.localeCompare(b.title));
        wrestlers.forEach(w => wrestlerSelect.add(new Option(w.title, w.id)));
        managers.forEach(m => managerSelect.add(new Option(m.title, m.id)));
    }

    // --- CORE GAME LOGIC & HELPERS ---
    /**
     * **NEW HELPER FUNCTION**
     * Converts a string (like a card title) to PascalCase.
     * Example: "V-Trigger" -> "VTrigger", "And Watch for the Shoe!" -> "AndWatchForTheShoe"
     */
    function toPascalCase(str) {
        return str.replace(/[^a-zA-Z0-9]+(.)?/g, (match, chr) => chr ? chr.toUpperCase() : '').replace(/^./, (match) => match.toUpperCase());
    }

    function isSignatureFor(card, wrestler) {
        if (!wrestler || !card) return false;
        if (card.signature_info?.logo && card.signature_info.logo === wrestler.signature_info?.logo) return true;
        const wrestlerFirstName = wrestler.title.split(' ')[0];
        const rawText = card.text_box?.raw_text || '';
        return rawText.includes(wrestler.title) || rawText.includes(wrestlerFirstName);
    }

    function isLogoCard(card) {
        return !!card.signature_info?.logo;
    }

    // --- CASCADING FILTER LOGIC ---
    function getAvailableFilterOptions(cards) {
        const options = { 'Card Type': new Set(), 'Keyword': new Set(), 'Trait': new Set() };
        cards.forEach(card => {
            options['Card Type'].add(card.card_type);
            card.text_box?.keywords?.forEach(k => k.name && options['Keyword'].add(k.name));
            card.text_box?.traits?.forEach(t => t.name && options['Trait'].add(t.name));
        });
        return {
            'Card Type': Array.from(options['Card Type']).sort(),
            'Keyword': Array.from(options['Keyword']).sort(),
            'Trait': Array.from(options['Trait']).sort()
        };
    }

    function renderCascadingFilters() {
        cascadingFiltersContainer.innerHTML = '';
        let filteredCards = getFilteredCardPool(true);
        for (let i = 0; i < 3; i++) {
            if (i > 0 && !activeFilters[i - 1].value) break;
            const filterWrapper = document.createElement('div');
            const categorySelect = document.createElement('select');
            categorySelect.innerHTML = `<option value="">-- Filter by --</option><option>Card Type</option><option>Keyword</option><option>Trait</option>`;
            categorySelect.value = activeFilters[i].category || '';
            categorySelect.dataset.index = i;
            categorySelect.onchange = (e) => {
                const index = parseInt(e.target.dataset.index);
                activeFilters[index] = { category: e.target.value, value: '' };
                for (let j = index + 1; j < 3; j++) activeFilters[j] = {};
                renderCascadingFilters();
                renderCardPool();
            };
            filterWrapper.appendChild(categorySelect);
            if (activeFilters[i].category) {
                const availableOptions = getAvailableFilterOptions(filteredCards);
                const valueSelect = document.createElement('select');
                valueSelect.innerHTML = `<option value="">-- Select ${activeFilters[i].category} --</option>`;
                availableOptions[activeFilters[i].category].forEach(opt => valueSelect.add(new Option(opt, opt)));
                valueSelect.value = activeFilters[i].value || '';
                valueSelect.dataset.index = i;
                valueSelect.onchange = (e) => {
                    const index = parseInt(e.target.dataset.index);
                    activeFilters[index].value = e.target.value;
                    for (let j = index + 1; j < 3; j++) activeFilters[j] = {};
                    renderCascadingFilters();
                    renderCardPool();
                };
                filterWrapper.appendChild(valueSelect);
            }
            cascadingFiltersContainer.appendChild(filterWrapper);
            if (activeFilters[i].value) {
                 filteredCards = applySingleFilter(filteredCards, activeFilters[i]);
            }
        }
    }
    
    function applySingleFilter(cards, filter) {
        if (!filter.category || !filter.value) return cards;
        return cards.filter(card => {
            switch (filter.category) {
                case 'Card Type': return card.card_type === filter.value;
                case 'Keyword': return card.text_box?.keywords?.some(k => k.name === filter.value);
                case 'Trait': return card.text_box?.traits?.some(t => t.name === filter.value);
                default: return true;
            }
        });
    }

    // --- RENDERING & CARD POOL LOGIC ---
    function getFilteredCardPool(ignoreCascadingFilters = false) {
        const query = searchInput.value.toLowerCase();
        const wrestlerLogo = selectedWrestler?.signature_info?.logo;
        let cards = cardDatabase.filter(card => {
            const isPlayableCard = card.card_type !== 'Wrestler' && card.card_type !== 'Manager';
            if (!isPlayableCard) return false;
            if (isLogoCard(card) && card.signature_info.logo !== wrestlerLogo) return false;
            const matchesQuery = query === '' || card.title.toLowerCase().includes(query) || card.text_box?.raw_text.toLowerCase().includes(query);
            return matchesQuery;
        });
        if (!ignoreCascadingFilters) {
            activeFilters.forEach(filter => {
                if (filter.value) cards = applySingleFilter(cards, filter);
            });
        }
        return cards;
    }

    function renderCardPool() {
        searchResults.innerHTML = '';
        const filteredCards = getFilteredCardPool();
        if (filteredCards.length === 0) {
            searchResults.innerHTML = '<p>No cards match the current filters.</p>';
            return;
        }
        filteredCards.forEach(card => {
            const cardElement = document.createElement('div');
            cardElement.className = 'card-item';
            cardElement.innerHTML = `<span data-id="${card.id}">${card.title} (C: ${card.cost})</span><button data-id="${card.id}">Add</button>`;
            searchResults.appendChild(cardElement);
        });
    }

    function renderPersonaDisplay() {
        if (!selectedWrestler) {
            personaDisplay.style.display = 'none';
            return;
        }
        personaDisplay.style.display = 'block';
        personaDisplay.innerHTML = '<h3>Persona & Signatures</h3><div class="persona-card-list"></div>';
        const list = personaDisplay.querySelector('.persona-card-list');
        const cardsToShow = new Set();
        cardsToShow.add(selectedWrestler);
        if (selectedManager) cardsToShow.add(selectedManager);
        const signatureCards = cardDatabase.filter(c => isSignatureFor(c, selectedWrestler));
        signatureCards.forEach(c => cardsToShow.add(c));
        cardsToShow.forEach(card => {
            const item = document.createElement('div');
            item.className = 'persona-card-item';
            item.textContent = card.title;
            item.dataset.id = card.id;
            list.appendChild(item);
        });
    }

    function generateCardHTML(card) {
        // **UPDATED IMAGE PATH LOGIC**
        const imageName = toPascalCase(card.title);
        const imagePath = `card-images/${imageName}.png`;
        
        const placeholderHTML = `
            <div class="placeholder-card">
                <div class="placeholder-header">
                    <span>${card.title}</span>
                    <span>C: ${card.cost ?? 'N/A'}</span>
                </div>
                <div class="placeholder-art-area">
                    <span>Art Missing</span>
                </div>
                <div class="placeholder-type-line">
                    <span>${card.card_type}</span>
                </div>
                <div class="placeholder-text-box">
                    ${card.text_box.raw_text || ''}
                </div>
                <div class="placeholder-stats">
                    <span>D: ${card.damage ?? 'N/A'}</span>
                    <span>M: ${card.momentum ?? 'N/A'}</span>
                </div>
            </div>`;

        return `
            <img src="${imagePath}" alt="${card.title}" style="width: 100%; border-radius: 8px; display: block;" 
                 onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
            <div style="display: none;">${placeholderHTML}</div>
        `;
    }

    function showCardModal(cardId) {
        const card = cardDatabase.find(c => c.id === cardId);
        if (!card) return;
        modalCardContent.innerHTML = generateCardHTML(card);
        cardModal.style.display = 'flex';
    }

    function renderDecks() {
        renderDeckList(startingDeckList, startingDeck, 'starting');
        renderDeckList(purchaseDeckList, purchaseDeck, 'purchase');
        updateDeckCounts();
    }

    function renderDeckList(element, deck, deckName) {
        element.innerHTML = '';
        const cardCounts = deck.reduce((acc, card) => { acc[card.id] = (acc[card.id] || 0) + 1; return acc; }, {});
        Object.entries(cardCounts).forEach(([cardId, count]) => {
            const card = cardDatabase.find(c => c.id === cardId);
            const cardElement = document.createElement('div');
            cardElement.className = 'card-item';
            cardElement.innerHTML = `<span data-id="${card.id}">${count}x ${card.title}</span><button data-id="${card.id}" data-deck="${deckName}">Remove</button>`;
            element.appendChild(cardElement);
        });
    }
    
    function updateDeckCounts() {
        startingDeckCount.textContent = startingDeck.length;
        purchaseDeckCount.textContent = purchaseDeck.length;
        startingDeckCount.parentElement.style.color = startingDeck.length === 24 ? 'green' : 'red';
        purchaseDeckCount.parentElement.style.color = purchaseDeck.length >= 36 ? 'green' : 'red';
    }

    // --- DECK CONSTRUCTION LOGIC ---
    function addCardToDeck(cardId) {
        const card = cardDatabase.find(c => c.id === cardId);
        if (!card) return;
        if (isLogoCard(card)) {
            alert(`"${card.title}" is a Logo card and cannot be added to your deck. It starts in your Market.`);
            return;
        }
        const totalCount = (startingDeck.filter(c => c.id === cardId).length) + (purchaseDeck.filter(c => c.id === cardId).length);
        if (totalCount >= 3) {
            alert(`Rule Violation: Max 3 copies of "${card.title}" allowed in total.`);
            return;
        }
        if (currentBuildMode === 'starting') {
            if (card.cost !== 0) { alert(`Rule Violation: Only 0-cost cards allowed in Starting Deck.`); return; }
            if (startingDeck.length >= 24) { alert(`Rule Violation: Starting Deck is full (24 cards).`); return; }
            if (startingDeck.filter(c => c.id === cardId).length >= 2) { alert(`Rule Violation: Max 2 copies of "${card.title}" allowed in Starting Deck.`); return; }
            startingDeck.push(card);
        } else {
            purchaseDeck.push(card);
        }
        renderDecks();
    }

    function removeCardFromDeck(cardId, deckName) {
        const deck = deckName === 'starting' ? startingDeck : purchaseDeck;
        const cardIndex = deck.findIndex(c => c.id === cardId);
        if (cardIndex > -1) {
            deck.splice(cardIndex, 1);
            renderDecks();
        }
    }
    
    function isDeckValid() {
        return selectedWrestler && selectedManager && startingDeck.length === 24 && purchaseDeck.length >= 36;
    }

    function exportDeck() {
        if (!isDeckValid()) {
            alert("Deck is not valid. Check wrestler/manager selection and deck counts.");
            return;
        }
        const signatureCardTitles = cardDatabase
            .filter(c => isSignatureFor(c, selectedWrestler))
            .map(c => c.title);
        const deckObject = {
            wrestler: selectedWrestler.title,
            manager: selectedManager.title,
            signatureCards: signatureCardTitles,
            startingDeck: startingDeck.map(c => c.id),
            purchaseDeck: purchaseDeck.map(c => c.id)
        };
        const blob = new Blob([JSON.stringify(deckObject, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${selectedWrestler.title}-deck.json`;
        a.click();
        URL.revokeObjectURL(a.href);
    }

    // --- EVENT LISTENERS ---
    function addEventListeners() {
        searchInput.addEventListener('input', renderCardPool);
        [searchResults, startingDeckList, purchaseDeckList, personaDisplay].forEach(container => {
            container.addEventListener('click', (e) => {
                const target = e.target;
                if ((target.tagName === 'SPAN' && target.dataset.id) || target.classList.contains('persona-card-item')) {
                    showCardModal(target.dataset.id);
                } else if (target.tagName === 'BUTTON' && target.dataset.id) {
                    if (target.dataset.deck) {
                        removeCardFromDeck(target.dataset.id, target.dataset.deck);
                    } else {
                        addCardToDeck(target.dataset.id);
                    }
                }
            });
        });
        clearDeckBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to clear both decks?')) {
                startingDeck = [];
                purchaseDeck = [];
                renderDecks();
            }
        });
        saveDeckBtn.addEventListener('click', exportDeck);
        wrestlerSelect.addEventListener('change', (e) => {
            selectedWrestler = cardDatabase.find(c => c.id === e.target.value);
            renderCardPool();
            renderPersonaDisplay();
            renderCascadingFilters();
        });
        managerSelect.addEventListener('change', (e) => {
            selectedManager = cardDatabase.find(c => c.id === e.target.value);
            renderPersonaDisplay();
        });
        buildModeToggle.addEventListener('click', () => {
            currentBuildMode = currentBuildMode === 'starting' ? 'purchase' : 'starting';
            currentModeSpan.textContent = currentBuildMode === 'starting' ? 'Starting Deck' : 'Purchase Deck';
        });
        modalCloseButton.addEventListener('click', () => cardModal.style.display = 'none');
        cardModal.addEventListener('click', (e) => {
            if (e.target === cardModal) cardModal.style.display = 'none';
        });
    }

    // --- START THE APP ---
    loadCardDatabase();
});

