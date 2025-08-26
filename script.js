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
    let keywordDatabase = {};
    let startingDeck = [];
    let purchaseDeck = [];
    let selectedWrestler = null;
    let selectedManager = null;
    let activeFilters = [{}, {}, {}];
    let currentViewMode = 'list';
    let lastFocusedElement;

    // --- UTILITY FUNCTIONS ---
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // --- DATA FETCHING ---
    async function loadGameData() {
        try {
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

    // --- INITIALIZATION ---
    function initializeApp() {
        populatePersonaSelectors();
        renderCascadingFilters();
        renderCardPool();
        addDeckSearchFunctionality();
        addEventListeners();
    }

    function populatePersonaSelectors() {
        wrestlerSelect.length = 1;
        managerSelect.length = 1;
        const wrestlers = cardDatabase.filter(c => c && c.card_type === 'Wrestler').sort((a, b) => a.title.localeCompare(b.title));
        const managers = cardDatabase.filter(c => c && c.card_type === 'Manager').sort((a, b) => a.title.localeCompare(b.title));
        wrestlers.forEach(w => wrestlerSelect.add(new Option(w.title, w.id)));
        managers.forEach(m => managerSelect.add(new Option(m.title, m.id)));
    }

    // --- CORE GAME LOGIC & HELPERS ---
    function toPascalCase(str) {
        if (!str) return '';
        return str.replace(/[^a-zA-Z0-9\s]+/g, '').split(/\s+/).map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join('');
    }

    function isSignatureFor(card, wrestler) {
        if (!wrestler || !card) return false;
        if (card.signature_info?.logo && card.signature_info.logo === wrestler.signature_info?.logo) return true;
        if (card.signature_info?.linked_persona && wrestler.title && card.signature_info.linked_persona === wrestler.title) return true;
        const wrestlerFirstName = wrestler.title.split(' ')[0];
        const rawText = card.text_box?.raw_text || '';
        return rawText.includes(wrestler.title) || rawText.includes(wrestlerFirstName);
    }

    function isLogoCard(card) { return !!card.signature_info?.logo; }

    // --- FILTER LOGIC ---
    const filterFunctions = {
        'Card Type': (card, value) => card.card_type === value,
        'Keyword': (card, value) => card.text_box?.keywords?.some(k => k.name === value),
        'Trait': (card, value) => card.text_box?.traits?.some(t => t.name === value),
    };

    function getAvailableFilterOptions(cards) {
        const options = { 'Card Type': new Set(), 'Keyword': new Set(), 'Trait': new Set() };
        cards.forEach(card => {
            if (card && card.card_type) options['Card Type'].add(card.card_type);
            if (card && card.text_box?.keywords) card.text_box.keywords.forEach(k => k.name && options['Keyword'].add(k.name));
            if (card && card.text_box?.traits) card.text_box.traits.forEach(t => t.name && options['Trait'].add(t.name));
        });
        return { 'Card Type': Array.from(options['Card Type']).sort(), 'Keyword': Array.from(options['Keyword']).sort(), 'Trait': Array.from(options['Trait']).sort() };
    }

    function renderCascadingFilters() {
        cascadingFiltersContainer.innerHTML = '';
        let filteredCards = getFilteredCardPool(true);
        for (let i = 0; i < 3; i++) {
            if (i > 0 && !activeFilters[i - 1].value) break;
            const filterWrapper = document.createElement('div');
            const categorySelect = document.createElement('select');
            categorySelect.innerHTML = `<option value="">-- Filter by --</option>${Object.keys(filterFunctions).map(cat => `<option>${cat}</option>`).join('')}`;
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
            if (activeFilters[i].value) filteredCards = applySingleFilter(filteredCards, activeFilters[i]);
        }
    }
    
    function applySingleFilter(cards, filter) {
        if (!filter.category || !filter.value) return cards;
        const filterFunction = filterFunctions[filter.category];
        return filterFunction ? cards.filter(card => filterFunction(card, filter.value)) : cards;
    }

    // --- RENDERING & CARD POOL LOGIC ---
    function getFilteredCardPool(ignoreCascadingFilters = false) {
        const query = searchInput.value.toLowerCase();
        let cards = cardDatabase.filter(card => {
            if (!card) return false; 
            const isPlayableCard = card.card_type !== 'Wrestler' && card.card_type !== 'Manager';
            if (!isPlayableCard) return false;
            if (isLogoCard(card)) return selectedWrestler ? card.signature_info.logo === selectedWrestler.signature_info.logo : false;
            const rawText = card.text_box?.raw_text || '';
            const matchesQuery = query === '' || (card.title && card.title.toLowerCase().includes(query)) || rawText.toLowerCase().includes(query);
            return matchesQuery;
        });
        if (!ignoreCascadingFilters) activeFilters.forEach(filter => { if (filter.value) cards = applySingleFilter(cards, filter); });
        return cards;
    }

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
            } else {
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

    function generateCardVisualHTML(card) {
        const imageName = toPascalCase(card.title);
        const imagePath = `card-images/${imageName}.png?v=${new Date().getTime()}`;
        let keywordsText = (card.text_box?.keywords || []).map(kw => `<strong>${kw.name}:</strong> ${keywordDatabase[kw.name] || 'Definition not found.'}`).join('<br>');
        let traitsText = (card.text_box?.traits || []).map(tr => `<strong>${tr.name}:</strong> ${tr.value || ''}`).join('<br>');
        const placeholderHTML = `
            <div class="placeholder-card">
                <div class="placeholder-header"><span>${card.title}</span><span>C: ${card.cost ?? 'N/A'}</span></div>
                <div class="placeholder-art-area"><span>Art Missing</span></div>
                <div class="placeholder-type-line"><span>${card.card_type}</span></div>
                <div class="placeholder-text-box">
                    <p>${card.text_box?.raw_text || ''}</p>
                    ${keywordsText ? `<hr><p>${keywordsText}</p>` : ''}
                    ${traitsText ? `<hr><p>${traitsText}</p>` : ''}
                </div>
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
        lastFocusedElement = document.activeElement;
        const card = cardDatabase.find(c => c.id === cardId);
        if (!card) return;
        modalCardContent.innerHTML = generateCardVisualHTML(card);
        cardModal.style.display = 'flex';
        cardModal.setAttribute('role', 'dialog');
        cardModal.setAttribute('aria-modal', 'true');
        modalCloseButton.focus();
    }

    function renderDecks() {
        renderDeckList(startingDeckList, startingDeck, 'starting');
        renderDeckList(purchaseDeckList, purchaseDeck, 'purchase');
        updateDeckCounts();
    }

    function renderDeckList(element, deck, deckName) {
        element.innerHTML = '';
        const cardCounts = deck.reduce((acc, cardId) => { acc[cardId] = (acc[cardId] || 0) + 1; return acc; }, {});
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
        const totalCount = (startingDeck.filter(id => id === cardId).length) + (purchaseDeck.filter(id => id === cardId).length);
        if (totalCount >= 3) {
            alert(`Rule Violation: Max 3 copies of "${card.title}" allowed in total.`);
            return;
        }
        if (targetDeck === 'starting') {
            if (card.cost !== 0) { alert(`Rule Violation: Only 0-cost cards allowed in Starting Deck.`); return; }
            if (startingDeck.length >= 24) { alert(`Rule Violation: Starting Deck is full (24 cards).`); return; }
            if (startingDeck.filter(id => id === cardId).length >= 2) { alert(`Rule Violation: Max 2 copies of "${card.title}" allowed in Starting Deck.`); return; }
            startingDeck.push(cardId);
        } else {
            purchaseDeck.push(cardId);
        }
        renderDecks();
    }

    function removeCardFromDeck(cardId, deckName) {
        const deck = deckName === 'starting' ? startingDeck : purchaseDeck;
        const cardIndex = deck.lastIndexOf(cardId);
        if (cardIndex > -1) {
            deck.splice(cardIndex, 1);
            renderDecks();
        }
    }
    
    function validateDeck() {
        const issues = [];
        if (!selectedWrestler) issues.push("No wrestler selected");
        if (!selectedManager) issues.push("No manager selected");
        if (startingDeck.length !== 24) issues.push(`Starting deck has ${startingDeck.length} cards (needs 24)`);
        if (purchaseDeck.length < 36) issues.push(`Purchase deck has ${purchaseDeck.length} cards (needs at least 36)`);
        const allCardIds = [...startingDeck, ...purchaseDeck];
        const cardCounts = allCardIds.reduce((acc, cardId) => { acc[cardId] = (acc[cardId] || 0) + 1; return acc; }, {});
        Object.entries(cardCounts).forEach(([cardId, count]) => {
            if (count > 3) {
                const card = cardDatabase.find(c => c.id === cardId);
                issues.push(`Too many copies of ${card.title} (${count} copies, max 3)`);
            }
        });
        return issues;
    }

    function exportDeck() {
        const validationIssues = validateDeck();
        if (validationIssues.length > 0) {
            alert("Deck validation failed:\n\n" + validationIssues.join("\n"));
            return;
        }
        const format = confirm("Export as JSON (OK) or plain text (Cancel)?") ? 'json' : 'text';
        const blob = format === 'json' ? new Blob([generateJsonDeck()], { type: 'application/json' }) : new Blob([generatePlainTextDeck()], { type: 'text/plain' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${selectedWrestler.title}-deck.${format}`;
        a.click();
        URL.revokeObjectURL(a.href);
    }

    function generateJsonDeck() {
        const deckObject = {
            wrestler: selectedWrestler.title,
            manager: selectedManager.title,
            signatureCards: cardDatabase.filter(c => isSignatureFor(c, selectedWrestler)).map(c => c.title),
            startingDeck: startingDeck,
            purchaseDeck: purchaseDeck
        };
        return JSON.stringify(deckObject, null, 2);
    }

    function generatePlainTextDeck() {
        let text = `Wrestler: ${selectedWrestler.title}\nManager: ${selectedManager.title}\n\n--- Starting Deck (${startingDeck.length}/24) ---\n`;
        const startingCounts = startingDeck.reduce((acc, cardId) => { acc[cardId] = (acc[cardId] || 0) + 1; return acc; }, {});
        Object.entries(startingCounts).forEach(([cardId, count]) => {
            const card = cardDatabase.find(c => c.id === cardId);
            text += `${count}x ${card.title}\n`;
        });
        text += `\n--- Purchase Deck (${purchaseDeck.length}/36+) ---\n`;
        const purchaseCounts = purchaseDeck.reduce((acc, cardId) => { acc[cardId] = (acc[cardId] || 0) + 1; return acc; }, {});
        Object.entries(purchaseCounts).forEach(([cardId, count]) => {
            const card = cardDatabase.find(c => c.id === cardId);
            text += `${count}x ${card.title}\n`;
        });
        return text;
    }

    function addDeckSearchFunctionality() {
        const startingDeckSearch = document.createElement('input');
        startingDeckSearch.type = 'text';
        startingDeckSearch.placeholder = 'Search starting deck...';
        startingDeckSearch.className = 'deck-search-input';
        startingDeckSearch.addEventListener('input', debounce(() => filterDeckList(startingDeckList, startingDeckSearch.value), 300));
        const purchaseDeckSearch = document.createElement('input');
        purchaseDeckSearch.type = 'text';
        purchaseDeckSearch.placeholder = 'Search purchase deck...';
        purchaseDeckSearch.className = 'deck-search-input';
        purchaseDeckSearch.addEventListener('input', debounce(() => filterDeckList(purchaseDeckList, purchaseDeckSearch.value), 300));
        startingDeckList.parentNode.insertBefore(startingDeckSearch, startingDeckList);
        purchaseDeckList.parentNode.insertBefore(purchaseDeckSearch, purchaseDeckList);
    }

    function filterDeckList(deckListElement, query) {
        const items = deckListElement.querySelectorAll('.card-item');
        items.forEach(item => {
            const text = item.textContent.toLowerCase();
            item.style.display = text.includes(query.toLowerCase()) ? '' : 'none';
        });
    }

    // --- EVENT LISTENERS ---
    function addEventListeners() {
        searchInput.addEventListener('input', debounce(renderCardPool, 300));

        searchResults.addEventListener('click', (e) => {
            const target = e.target;
            const cardId = target.dataset.id;
            if (target.tagName === 'BUTTON' && cardId) {
                addCardToDeck(cardId, target.dataset.deckTarget);
            } else {
                const cardVisual = target.closest('[data-id]');
                if (cardVisual) showCardModal(cardVisual.dataset.id);
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

        modalCloseButton.addEventListener('click', () => {
            cardModal.style.display = 'none';
            if (lastFocusedElement) lastFocusedElement.focus();
        });
        cardModal.addEventListener('click', (e) => {
            if (e.target === cardModal) {
                cardModal.style.display = 'none';
                if (lastFocusedElement) lastFocusedElement.focus();
            }
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && cardModal.style.display === 'flex') {
                cardModal.style.display = 'none';
                if (lastFocusedElement) lastFocusedElement.focus();
            }
        });
    }

    // --- START THE APP ---
    loadGameData();
});

