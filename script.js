// --- DATA FETCHING ---
async function loadCardDatabase() {
    try {
        // **THE FIX IS HERE: Reverting to the simple, relative path.**
        const response = await fetch('./cardDatabase.json');
        
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        cardDatabase = await response.json();
        initializeApp();
    } catch (error) {
        console.error("Could not load card database:", error);
        searchResults.innerHTML = `<p style="color: red;">Error: Could not load cardDatabase.json. Please ensure the file exists and the URL is correct.</p>`;
    }
}

