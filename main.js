// main.js
import { loadGameData } from './data-loader.js';
import { initializeApp } from './app-init.js';

async function startApp() {
    const dataLoaded = await loadGameData();
    if (dataLoaded) {
        initializeApp();
    }
}

startApp();

