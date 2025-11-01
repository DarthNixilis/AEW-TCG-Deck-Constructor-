// app-init.js
import * as state from './config.js';
import * as ui from './ui.js';
import * as filters from './filters.js';
import { initializeAllEventListeners } from './listeners.js'; // Corrected path

export function initializeApp() {
    populatePersonaSelectors();
    loadStateFromCache();
    setupInitialUI();
    addDeckSearchFunctionality();
    filters.renderCascadingFilters();
    ui.renderDecks();
    ui.renderPersonaDisplay();
    initializeAllEventListeners(refreshCardPool);
    refreshCardPool();
}

function populatePersonaSelectors() {
    const wrestlerSelect = document.getElementById('wrestlerSelect');
    const managerSelect = document.getElementById('managerSelect');
    wrestlerSelect.length = 1;
    managerSelect.length = 1;
    const wrestlers = state.cardDatabase.filter(c => c && c.card_type === 'Wrestler').sort((a, b) => a.title.localeCompare(b.title));
    const managers = state.cardDatabase.filter(c => c && c.card_type === 'Manager').sort((a, b) => a.title.localeCompare(b.title));
    wrestlers.forEach(w => wrestlerSelect.add(new Option(w.title, w.title)));
    managers.forEach(m => managerSelect.add(new Option(m.title, m.title)));
}

function loadStateFromCache() {
    const cachedState = localStorage.getItem(state.CACHE_KEY);
    if (cachedState) {
        try {
            const parsed = JSON.parse(cachedState);
            state.setStartingDeck(parsed.startingDeck || []);
            state.setPurchaseDeck(parsed.purchaseDeck || []);
            if (parsed.wrestler) {
                const wrestlerSelect = document.getElementById('wrestlerSelect');
                wrestlerSelect.value = parsed.wrestler;
                state.setSelectedWrestler(state.cardTitleCache[parsed.wrestler] || null);
            }
            if (parsed.manager) {
                const managerSelect = document.getElementById('managerSelect');
                managerSelect.value = parsed.manager;
                state.setSelectedManager(state.cardTitleCache[parsed.manager] || null);
            }
        } catch (e) {
            console.error("Failed to load from cache:", e);
            localStorage.removeItem(state.CACHE_KEY);
        }
    }
}

function setupInitialUI() {
    const viewModeToggle = document.getElementById('viewModeToggle');
    const gridSizeControls = document.getElementById('gridSizeControls');
    viewModeToggle.textContent = state.currentViewMode === 'list' ? 'Switch to Grid View' : 'Switch to List View';
    const activeGridButton = gridSizeControls.querySelector(`[data-columns="${state.numGridColumns}"]`);
    if (activeGridButton) activeGridButton.classList.add('active');
}

function addDeckSearchFunctionality() {
    const startingDeckList = document.getElementById('startingDeckList');
    const purchaseDeckList = document.getElementById('purchaseDeckList');
    
    const startingDeckSearch = document.createElement('input');
    startingDeckSearch.type = 'text';
    startingDeckSearch.placeholder = 'Search starting deck...';
    startingDeckSearch.className = 'deck-search-input';
    startingDeckSearch.addEventListener('input', state.debounce(() => ui.filterDeckList(startingDeckList, startingDeckSearch.value), 300));
    
    const purchaseDeckSearch = document.createElement('input');
    purchaseDeckSearch.type = 'text';
    purchaseDeckSearch.placeholder = 'Search purchase deck...';
    purchaseDeckSearch.className = 'deck-search-input';
    purchaseDeckSearch.addEventListener('input', state.debounce(() => ui.filterDeckList(purchaseDeckList, purchaseDeckSearch.value), 300));
    
    startingDeckList.parentNode.insertBefore(startingDeckSearch, startingDeckList);
    purchaseDeckList.parentNode.insertBefore(purchaseDeckSearch, purchaseDeckList);
}

function refreshCardPool() {
    const finalCards = filters.getFilteredAndSortedCardPool();
    ui.renderCardPool(finalCards);
}

