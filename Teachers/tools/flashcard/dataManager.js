export class DataManager {
    constructor() {
        this.supabaseProxyUrl = '/.netlify/functions/supabase_auth?action=save_worksheet';
        this.localStorageKey = 'flashcard_settings';
        this.workerUrl = window.WILLENA_WORKSHEET_ASSETS_URL || 'https://worksheet-assets.willenaenglish.com';
    }

    saveSettings(settings) {
        try { localStorage.setItem(this.localStorageKey, JSON.stringify(settings)); }
        catch (error) { console.error('Error saving settings:', error); }
    }

    loadSettings() {
        try {
            const stored = localStorage.getItem(this.localStorageKey);
            return stored ? JSON.parse(stored) : {};
        } catch (error) {
            console.error('Error loading settings:', error);
            return {};
        }
    }

    getAccessToken() {
        try { return localStorage.getItem('sb_access_token') || ''; }
        catch (_) { return ''; }
    }

    async transformWorksheet(worksheet) {
        const headers = { 'Content-Type': 'application/json' };
        const token = this.getAccessToken();
        if (token) headers.Authorization = `Bearer ${token}`;
        const response = await fetch(this.workerUrl, {
            method: 'POST',
            credentials: 'include',
            headers,
            body: JSON.stringify({ action: 'transform_worksheet', dry_run: false, worksheet })
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.success) throw new Error(result.error || 'Image upload failed');
        if (this.containsEmbeddedImage(result.worksheet)) throw new Error('Embedded images remain after processing');
        return result.worksheet;
    }

    containsEmbeddedImage(value) {
        if (typeof value === 'string') {
            if (/data:image\//i.test(value)) return true;
            try { return this.containsEmbeddedImage(JSON.parse(value)); } catch (_) { return false; }
        }
        if (!value || typeof value !== 'object') return false;
        return Array.isArray(value)
            ? value.some(item => this.containsEmbeddedImage(item))
            : Object.values(value).some(item => this.containsEmbeddedImage(item));
    }

    async saveFlashcards(data) {
        const cards = Array.isArray(data.cards) ? data.cards : [];
        const imageMap = {
            cards: cards.map((card, index) => ({
                card_index: index,
                word: card.english || '',
                korean: card.korean || '',
                image: card.imageUrl || null
            }))
        };
        const settings = {
            font: data.font || data.settings?.font || 'Poppins',
            fontSize: data.fontSize || data.settings?.fontSize || 18,
            layout: data.layout || data.settings?.layout || '4-card',
            cardSize: data.cardSize || data.settings?.cardSize || 200,
            showKorean: data.showKorean ?? data.settings?.showKorean ?? false,
            imageOnly: data.imageOnly ?? data.settings?.imageOnly ?? false,
            imageZoom: data.imageZoom || data.settings?.imageZoom || 1
        };
        let worksheet = {
            worksheet_type: 'flashcard',
            title: data.title || 'Untitled Flashcard Set',
            passage_text: data.wordList || '',
            words: cards.map(card => card.english || '').filter(Boolean),
            layout: 'flashcard',
            settings: JSON.stringify(settings),
            images: JSON.stringify(imageMap),
            book: data.book || '',
            unit: data.unit || '',
            language_point: data.language_point || '',
            notes: `Flashcard set with ${cards.length} cards`,
            username: localStorage.getItem('username') || ((localStorage.getItem('userEmail') || '').split('@')[0]) || ''
        };
        if (data.user_id) worksheet.user_id = data.user_id;

        worksheet = await this.transformWorksheet(worksheet);
        const api = window.WillenaAPI?.fetch ? window.WillenaAPI.fetch.bind(window.WillenaAPI) : fetch;
        const response = await api(this.supabaseProxyUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(worksheet)
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.success) throw new Error(result.error || 'Failed to save flashcards');
        return result;
    }

    async loadFlashcards() {
        const managerWindow = window.open(
            '../../worksheet_manager.html?mode=load&type=flashcard',
            'WorksheetManager',
            'width=1000,height=700,resizable=yes,scrollbars=yes'
        );
        return new Promise(resolve => {
            const messageHandler = event => {
                if (event.source !== managerWindow) return;
                if (event.data?.type === 'worksheet_selected') {
                    window.removeEventListener('message', messageHandler);
                    resolve(this.parseLoadedWorksheet(event.data.worksheet));
                } else if (event.data?.type === 'cancelled') {
                    window.removeEventListener('message', messageHandler);
                    resolve(null);
                }
            };
            window.addEventListener('message', messageHandler);
            const timer = setInterval(() => {
                if (managerWindow?.closed) {
                    clearInterval(timer);
                    window.removeEventListener('message', messageHandler);
                    resolve(null);
                }
            }, 500);
        });
    }

    parseJsonObject(value) {
        if (!value) return {};
        if (typeof value === 'object') return value;
        try { return JSON.parse(value); } catch (_) { return {}; }
    }

    resolveImage(value) {
        if (!value) return null;
        if (typeof value === 'string') return value;
        if (value.url) return value.url;
        if (value.data && (value.src === 'data' || value.src === 'url')) return value.data;
        if (value.image) return this.resolveImage(value.image);
        return null;
    }

    parseLoadedWorksheet(worksheetData) {
        try {
            const words = Array.isArray(worksheetData.words)
                ? worksheetData.words
                : String(worksheetData.words || worksheetData.passage_text || '').split('\n').map(v => v.trim()).filter(Boolean);
            const cards = words.map(word => ({ english: word, korean: '', image: null, imageUrl: null }));
            const images = this.parseJsonObject(worksheetData.images);
            const legacyImageData = this.parseJsonObject(worksheetData.image_data || worksheetData.imageData);

            if (Array.isArray(images.cards)) {
                images.cards.forEach((saved, index) => {
                    const target = Number.isInteger(saved.card_index) ? saved.card_index : index;
                    if (!cards[target]) return;
                    cards[target].english = saved.word || cards[target].english;
                    cards[target].korean = saved.korean || '';
                    cards[target].imageUrl = this.resolveImage(saved.image || saved.imageUrl || saved.src);
                });
            } else {
                cards.forEach(card => {
                    const saved = images[card.english] || legacyImageData[card.english];
                    if (saved) card.imageUrl = this.resolveImage(saved);
                });
            }

            return {
                title: worksheetData.title || '',
                wordList: worksheetData.passage_text || words.join('\n'),
                cards,
                settings: this.parseJsonObject(worksheetData.settings),
                user_id: worksheetData.user_id || null
            };
        } catch (error) {
            console.error('Error parsing loaded worksheet:', error);
            return null;
        }
    }

    exportToJSON(data) {
        return JSON.stringify({ ...data, exportDate: new Date().toISOString(), version: '2.0' }, null, 2);
    }

    async exportToFile(data, filename = null) {
        const blob = new Blob([this.exportToJSON(data)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = filename || `flashcards_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);
    }

    async importFromFile(file) {
        const text = await file.text();
        const data = JSON.parse(text);
        if (!data || !Array.isArray(data.cards)) throw new Error('Invalid file format');
        return data;
    }

    enableAutoSave(app, intervalMs = 30000) {
        this.autoSaveInterval = setInterval(() => this.saveSettings(app.getSettings()), intervalMs);
    }

    disableAutoSave() {
        if (this.autoSaveInterval) clearInterval(this.autoSaveInterval);
        this.autoSaveInterval = null;
    }

    addToRecentFiles(worksheetData) {
        const recent = this.getRecentFiles().filter(item => item.id !== worksheetData.id);
        recent.unshift({ id: worksheetData.id || Date.now(), title: worksheetData.title, date: new Date().toISOString(), cardCount: worksheetData.cards?.length || 0 });
        localStorage.setItem('flashcard_recent', JSON.stringify(recent.slice(0, 10)));
    }

    getRecentFiles() {
        try { return JSON.parse(localStorage.getItem('flashcard_recent') || '[]'); }
        catch (_) { return []; }
    }

    clearRecentFiles() { localStorage.removeItem('flashcard_recent'); }

    createBackup() {
        const backup = { settings: this.loadSettings(), recent: this.getRecentFiles(), timestamp: new Date().toISOString() };
        localStorage.setItem('flashcard_backup', JSON.stringify(backup));
        return backup;
    }

    restoreBackup() {
        try {
            const backup = JSON.parse(localStorage.getItem('flashcard_backup') || 'null');
            if (!backup) return false;
            if (backup.settings) this.saveSettings(backup.settings);
            if (backup.recent) localStorage.setItem('flashcard_recent', JSON.stringify(backup.recent));
            return true;
        } catch (_) { return false; }
    }

    getUsageStats() {
        try { return JSON.parse(localStorage.getItem('flashcard_stats') || '{}'); }
        catch (_) { return {}; }
    }

    updateUsageStats(update) {
        localStorage.setItem('flashcard_stats', JSON.stringify({ ...this.getUsageStats(), ...update, lastUsed: new Date().toISOString() }));
    }
}
