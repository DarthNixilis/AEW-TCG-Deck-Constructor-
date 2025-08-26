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
    const personaDisplay = document.getElementById('personaDisplay');
    const cardModal = document.getElementById('cardModal');
    const modalCardContent = document.getElementById('modalCardContent');
    const modalCloseButton = document.querySelector('.modal-close-button');
    const viewModeToggle = document.getElementById('viewModeToggle');

    // --- STATE MANAGEMENT ---
    let cardDatabase = [];
    let startingDeck = [];
    let purchaseDeck = [];
    let selectedWrestler = null;
    let selectedManager = null;
    let activeFilters = [{}, {}, {}];
    let currentViewMode = 'list';

    // --- DATA FETCHING ---
    async function loadCardDatabase() {
        try {
            const response = await fetch(`./cardDatabase.json?v=${new Date().getTime()}`);
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
        console.log("--- Populating Personas ---");
        console.log("Total cards in database:", cardDatabase.length);

        wrestlerSelect.length = 1;
        managerSelect.length = 1;

        const wrestlers = [];
        const managers = [];

        if (Array.isArray(cardDatabase)) {
            for (const card of cardDatabase) {
                if (card && typeof card === 'object') {
                    if (card.card_type === 'Wrestler' && card.id && card.title) {
                        wrestlers.push(card);
                    } else if (card.card_type === 'Manager' && card.id && card.title) {
                        managers.push(card);
                    }
                }
            }
        }

        console.log("Total wrestlers found:", wrestlers.length);
        console.log("Total managers found:", managers.length);

        wrestlers.sort((a, b) => a.title.localeCompare(b.title));
        managers.sort((a, b) => a.title.localeCompare(b.title));

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
        console.log("--- Finished Populating Personas ---");
    }

    // --- CORE GAME LOGIC & HELPERS ---
    function toPascalCase(str) {
        if (!str) return '';
        return str.replace(/[^a-zA-Z0-9]+(.)?/g, (match, chr) => chr ? chr.toUpperCase() : '').replace(/^./, (match) => match.toUpperCase());
    }

    function isSignatureFor(card, wrestler) {
        if (!wrestler || !card) return false;
        
        if (card.signature_info?.logo && card.signature_info.logo === wrestler.signature_info?.logo) 
            return true;
        
        if (card.signature_info?.linked_persona && wrestler.title && 
            card.signature_info.linked_persona === wrestler.title) 
            return true;
        
        const wrestlerFirstName = wrestler.title.split(' ')[0];
        const rawText = card.text_box?.raw_text || '';
        return rawText.includes(wrestler.title) || rawText.includes(wrestlerFirstName);
    }

    function isLogoCard(card) { return !!card.signature_info?.logo; }

    // --- CASCADING FILTER LOGIC ---
    function getAvailableFilterOptions(cards) {
        const options = { 'Card Type': new Set(), 'Keyword': new Set(), 'Trait': new Set() };
        cards.forEach(card => {
            if (card && card.card_type) options['Card Type'].add(card.card_type);
            if (card && card.text_box?.keywords) {
                card.text_box.keywords.forEach(k => k.name && options['Keyword'].add(k.name));
            }
            if (card && card.text_box?.traits) {
                card.text_box.traits.forEach(t => t.name && options['Trait'].add(t.name));
            }
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
            if (!card) return false;
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
        let cards = cardDatabase.filter(card => {
            if (!card) return false; 
            const isPlayableCard = card.card_type !== 'Wrestler' && card.card_type !== 'Manager';
            if (!isPlayableCard) return false;
            if (isLogoCard(card)) {
                return selectedWrestler ? card.signature_info.logo === selectedWrestler.signature_info.logo : false;
            }
            const rawText = card.text_box?.raw_text || '';
            const matchesQuery = query === '' || (card.title && card.title.toLowerCase().includes(query)) || rawText.toLowerCase().includes(query);
            return matchesQuery;
        });
        if (!ignoreCascadingFilters) {
            activeFilters.forEach(filter => {
                if (filter.value) cards = applySingleFilter(cards, filter);
            });
        }
        return cards;
    }


// START OF SELECTION (Line 204)
function renderCardPool() {
    searchResults.innerHTML = '';
    searchResults.className = `card-list ${currentViewMode}-view`;
    const filteredCards = getFilteredCardPool();
    if (filteredCards.length === 0) {
        searchResults.innerHTML = '<p>No cards match the current filters.</p>';
        return;
    }
    filteredCards.forEach(card => {
        const cardElement = document.createElement('div');
        cardElement.className = currentViewMode === 'list' ? 'card-item' : 'grid-card-item';
        cardElement.dataset.id = card.id;
        if (currentViewMode === 'list') {
            cardElement.innerHTML = `<span data-id="${card.id}">${card.title} (C:${card.cost}, D:${card.damage}, M:${card.momentum})</span>`;
            const buttonsDiv = document.createElement('div');
            buttonsDiv.className = 'card-buttons';
            if (card.cost === 0) {
                buttonsDiv.innerHTML = `<button data-id="${card.id}" data-deck-target="starting">Starting</button><button class="btn-purchase" data-id="${card.id}" data-deck-target="purchase">Purchase</button>`;
            } else {
                buttonsDiv.innerHTML = `<button class="btn-purchase" data-id="${card.id}" data-deck-target="purchase">Purchase</button>`;
            }
            cardElement.appendChild(buttonsDiv);
        } else { // Grid View
            const visualHTML = generateCardVisualHTML(card);
            cardElement.innerHTML = `<div class="card-visual" data-id="${card.id}">${visualHTML}</div>`;
            const buttonsDiv = document.createElement('div');
            buttonsDiv.className = 'card-buttons';
            if (card.cost === 0) {
                buttonsDiv.innerHTML = `<button data-id="${card.id}" data-deck-target="starting">Starting</button><button class="btn-purchase" data-id="${card.id}" data-deck-target="purchase">Purchase</button>`;
            } else {
                buttonsDiv.innerHTML = `<button class="btn-purchase" data-id="${card.id}" data-deck-target="purchase">Purchase</button>`;
            }
            cardElement.appendChild(buttonsDiv);
        }
        searchResults.appendChild(cardElement);
    });
}
// END OF SELECTION (Line 241)


    
    function generateCardVisualHTML(card) {
        const imageName = toPascalCase(card.title);
        const imagePath = `card-images/${imageName}.png`;
        const placeholderHTML = `
            <div class="placeholder-card">
                <div class="placeholder-header"><span>${card.title}</span><span>C: ${card.cost ?? 'N/A'}</span></div>
                <div class="placeholder-art-area"><span>Art Missing</span></div>
                <div class="placeholder-type-line"><span>${card.card_type}</span></div>
                <div class="placeholder-text-box">${card.text_box?.raw_text || ''}</div>
                <div class="placeholder-stats"><span>D: ${card.damage ?? 'N/A'}</span><span>M: ${card.momentum ?? 'N/A'}</span></div>
            </div>`;
        return `
            <img src="${imagePath}" alt="${card.title}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
            <div style="display: none;">${placeholderHTML}</div>`;
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

    function showCardModal(cardId) {
        const card = cardDatabase.find(c => c.id === cardId);
        if (!card) return;
        modalCardContent.innerHTML = generateCardVisualHTML(card);
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
            if (!card) return;
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
    function addCardToDeck(cardId, targetDeck) {
        const card = cardDatabase.find(c => c.id === cardId);
        if (!card) return;
        if (isLogoCard(card)) {
            alert(`"${card.title}" is a Logo card and cannot be added to your deck.`);
            return;
        }
        const totalCount = (startingDeck.filter(c => c.id === cardId).length) + (purchaseDeck.filter(c => c.id === cardId).length);
        if (totalCount >= 3) {
            alert(`Rule Violation: Max 3 copies of "${card.title}" allowed in total.`);
            return;
        }
        if (targetDeck === 'starting') {
            if (card.cost !== 0) { alert(`Rule Violation: Only 0-cost cards allowed in Starting Deck.`); return; }
            if (startingDeck.length >= 24) { alert(`Rule Violation: Starting Deck is full (24 cards).`); return; }
            if (startingDeck.filter(c => c.id === cardId).length >= 2) { alert(`Rule Violation: Max 2 copies of "${card.title}" allowed in Starting Deck.`); return; }
            startingDeck.push(card);
        } else { // purchase
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
    
    function isDeckValid() { return selectedWrestler && selectedManager && startingDeck.length === 24 && purchaseDeck.length >= 36; }

    function exportDeck() {
        if (!isDeckValid()) {
            alert("Deck is not valid. Check wrestler/manager selection and deck counts.");
            return;
        }
        const signatureCardTitles = cardDatabase.filter(c => isSignatureFor(c, selectedWrestler)).map(c => c.title);
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

        searchResults.addEventListener('click', (e) => {
            const target = e.target;
            const cardId = target.dataset.id;
            if (target.tagName === 'BUTTON' && cardId) {
                addCardToDeck(cardId, target.dataset.deckTarget);
            } else {
                const cardVisual = target.closest('[data-id]');
                if (cardVisual) {
                    showCardModal(cardVisual.dataset.id);
                }
            }
        });

        [startingDeckList, purchaseDeckList, personaDisplay].forEach(container => {
            container.addEventListener('click', (e) => {
                const target = e.target;
                if ((target.tagName === 'SPAN' && target.dataset.id) || target.classList.contains('persona-card-item')) {
                    showCardModal(target.dataset.id);
                } else if (target.tagName === 'BUTTON' && target.dataset.id && target.dataset.deck) {
                    removeCardFromDeck(target.dataset.id, target.dataset.deck);
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
            selectedWrestler = cardDatabase.find(c => c.id === e.target.value) || null;
            renderCardPool();
            renderPersonaDisplay();
            renderCascadingFilters();
        });

        managerSelect.addEventListener('change', (e) => {
            selectedManager = cardDatabase.find(c => c.id === e.target.value) || null;
            renderPersonaDisplay();
        });

        viewModeToggle.addEventListener('click', () => {
            currentViewMode = currentViewMode === 'list' ? 'grid' : 'list';
            viewModeToggle.textContent = currentViewMode === 'list' ? 'Switch to Grid View' : 'Switch to List View';
            renderCardPool();
        });

        modalCloseButton.addEventListener('click', () => cardModal.style.display = 'none');
        cardModal.addEventListener('click', (e) => {
            if (e.target === cardModal) cardModal.style.display = 'none';
        });
    }

    // --- START THE APP ---
    loadCardDatabase();
});

