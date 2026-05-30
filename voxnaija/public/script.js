const textArea = document.getElementById('text');
const countEl = document.getElementById('count');
const voiceSelect = document.getElementById('voice');
const rateSlider = document.getElementById('rate');
const rateValue = document.getElementById('rate-value');
const pitchSlider = document.getElementById('pitch');
const pitchValue = document.getElementById('pitch-value');
const generateBtn = document.getElementById('generate');
const btnLabel = generateBtn.querySelector('.btn-label');
const spinner = generateBtn.querySelector('.spinner');
const output = document.getElementById('output');
const player = document.getElementById('player');
const downloadLink = document.getElementById('download');
const errorEl = document.getElementById('error');
const historySection = document.getElementById('history-section');
const historyList = document.getElementById('history-list');
const clearHistoryBtn = document.getElementById('clear-history');
const modalBackdrop = document.getElementById('modal-backdrop');
const modalTitle = document.getElementById('modal-title');
const modalBody = document.getElementById('modal-body');
const modalCancelBtn = document.getElementById('modal-cancel');
const modalConfirmBtn = document.getElementById('modal-confirm');

const HISTORY_KEY = 'voxnaija_history';
const HISTORY_LIMIT = 5;

const VOICE_LABELS = {
    'ng-female': 'Ezinne (NG)',
    'ng-male': 'Abeo (NG)',
    'us-female': 'Jenny (US)',
    'us-male': 'Guy (US)',
    'gb-female': 'Sonia (UK)',
    'gb-male': 'Ryan (UK)',
};

let currentHistoryId = null;
let pendingConfirmAction = null;

// Character counter
textArea.addEventListener('input', () => {
    countEl.textContent = textArea.value.length;
});

// Slider formatting
function formatRate(v) {
    const n = Number(v);
    return (n >= 0 ? '+' : '') + n + '%';
}
function formatPitch(v) {
    const n = Number(v);
    return (n >= 0 ? '+' : '') + n + ' Hz';
}
rateSlider.addEventListener('input', () => {
    rateValue.textContent = formatRate(rateSlider.value);
});
pitchSlider.addEventListener('input', () => {
    pitchValue.textContent = formatPitch(pitchSlider.value);
});

// Generate
generateBtn.addEventListener('click', async () => {
    const text = textArea.value.trim();
    const voice = voiceSelect.value;
    const rate = Number(rateSlider.value);
    const pitch = Number(pitchSlider.value);

    errorEl.classList.add('hidden');
    output.classList.add('hidden');

    if (!text) {
        showError('Please enter some text first.');
        return;
    }

    setLoading(true);

    try {
        const response = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, voice, rate, pitch }),
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({ detail: 'Generation failed' }));
            throw new Error(err.detail || 'Generation failed');
        }

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const audioBase64 = await blobToBase64(blob);

        const newItem = {
            id: Date.now(),
            text,
            voice,
            rate,
            pitch,
            audioBase64,
            timestamp: new Date().toISOString(),
        };

        player.src = url;
        downloadLink.href = url;
        output.classList.remove('hidden');
        currentHistoryId = newItem.id;

        saveToHistory(newItem);
    } catch (err) {
        showError(err.message);
    } finally {
        setLoading(false);
    }
});

function setLoading(loading) {
    if (loading) {
        generateBtn.disabled = true;
        btnLabel.textContent = 'Generating';
        spinner.classList.remove('hidden');
    } else {
        generateBtn.disabled = false;
        btnLabel.textContent = 'Generate';
        spinner.classList.add('hidden');
    }
}

function showError(msg) {
    errorEl.textContent = msg;
    errorEl.classList.remove('hidden');
}

function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

// Custom confirm modal
function showConfirmModal({ title, body, confirmLabel, onConfirm }) {
    modalTitle.textContent = title;
    modalBody.textContent = body;
    modalConfirmBtn.textContent = confirmLabel;
    pendingConfirmAction = onConfirm;
    modalBackdrop.classList.remove('hidden');
    setTimeout(() => modalCancelBtn.focus(), 0);
}

function hideConfirmModal() {
    pendingConfirmAction = null;
    modalBackdrop.classList.add('hidden');
}

modalCancelBtn.addEventListener('click', hideConfirmModal);
modalConfirmBtn.addEventListener('click', () => {
    const action = pendingConfirmAction;
    hideConfirmModal();
    if (action) action();
});
modalBackdrop.addEventListener('click', (e) => {
    if (e.target === modalBackdrop) hideConfirmModal();
});
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modalBackdrop.classList.contains('hidden')) {
        hideConfirmModal();
    }
});

// History
function loadHistory() {
    try {
        const raw = localStorage.getItem(HISTORY_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

function saveHistory(items) {
    try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(items));
    } catch (e) {
        const trimmed = items.map((item, i) =>
            i === 0 ? item : { ...item, audioBase64: null }
        );
        try {
            localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
        } catch {
            console.warn('localStorage quota exceeded — history not saved.');
        }
    }
}

function saveToHistory(item) {
    let items = loadHistory();
    items.unshift(item);
    items = items.slice(0, HISTORY_LIMIT);
    saveHistory(items);
    renderHistory();
}

function deleteHistoryItem(id) {
    let items = loadHistory();
    items = items.filter(it => it.id !== id);
    saveHistory(items);
    if (currentHistoryId === id) currentHistoryId = null;
    renderHistory();
}

function clearHistory() {
    saveHistory([]);
    currentHistoryId = null;
    renderHistory();
}

function loadIntoForm(item) {
    textArea.value = item.text;
    countEl.textContent = item.text.length;
    voiceSelect.value = item.voice;
    rateSlider.value = item.rate;
    pitchSlider.value = item.pitch;
    rateValue.textContent = formatRate(item.rate);
    pitchValue.textContent = formatPitch(item.pitch);
    textArea.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function playFromHistory(item) {
    if (!item.audioBase64) return;

    if (currentHistoryId === item.id) {
        if (player.paused) {
            if (player.ended) player.currentTime = 0;
            player.play().catch(() => {});
        } else {
            player.pause();
        }
        return;
    }

    currentHistoryId = item.id;
    player.src = item.audioBase64;
    downloadLink.href = item.audioBase64;
    output.classList.remove('hidden');
    errorEl.classList.add('hidden');
    output.scrollIntoView({ behavior: 'smooth', block: 'center' });
    player.play().catch(() => {});
}

function updatePlayButtons() {
    const buttons = historyList.querySelectorAll('[data-action="play"]');
    buttons.forEach(btn => {
        const itemEl = btn.closest('.history-item');
        if (!itemEl) return;
        const id = Number(itemEl.dataset.id);
        if (id === currentHistoryId && !player.paused && !player.ended) {
            btn.textContent = '⏸';
            btn.title = 'Pause';
        } else {
            btn.textContent = '▶';
            btn.title = 'Play';
        }
    });
}

player.addEventListener('play', updatePlayButtons);
player.addEventListener('pause', updatePlayButtons);
player.addEventListener('ended', updatePlayButtons);

function timeAgo(iso) {
    const diff = Date.now() - new Date(iso).getTime();
    const sec = Math.floor(diff / 1000);
    if (sec < 60) return 'just now';
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    const day = Math.floor(hr / 24);
    return `${day}d ago`;
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function renderHistory() {
    const items = loadHistory();
    if (items.length === 0) {
        historySection.classList.add('hidden');
        historyList.innerHTML = '';
        return;
    }
    historySection.classList.remove('hidden');
    historyList.innerHTML = items.map(item => {
        const rateBadge = item.rate !== 0 ? ` · ${formatRate(item.rate)}` : '';
        const pitchBadge = item.pitch !== 0 ? ` · ${formatPitch(item.pitch)}` : '';
        const playBtn = item.audioBase64
            ? `<button class="icon-btn" data-action="play" title="Play">▶</button>`
            : '';
        return `
            <div class="history-item" data-id="${item.id}">
                <div class="history-meta">
                    <div class="history-text">${escapeHtml(item.text)}</div>
                    <div class="history-info">
                        <span>${VOICE_LABELS[item.voice] || item.voice}</span>
                        <span>${timeAgo(item.timestamp)}${rateBadge}${pitchBadge}</span>
                    </div>
                </div>
                <div class="history-actions">
                    ${playBtn}
                    <button class="icon-btn" data-action="load" title="Load into form">↻</button>
                    <button class="icon-btn delete" data-action="delete" title="Delete">×</button>
                </div>
            </div>
        `;
    }).join('');
    updatePlayButtons();
}

historyList.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const itemEl = btn.closest('.history-item');
    const id = Number(itemEl.dataset.id);
    const items = loadHistory();
    const item = items.find(it => it.id === id);
    if (!item) return;

    const action = btn.dataset.action;
    if (action === 'play') playFromHistory(item);
    else if (action === 'load') loadIntoForm(item);
    else if (action === 'delete') deleteHistoryItem(id);
});

clearHistoryBtn.addEventListener('click', () => {
    const count = loadHistory().length;
    showConfirmModal({
        title: 'Clear all history?',
        body: `This will permanently remove ${count} saved ${count === 1 ? 'generation' : 'generations'}. This cannot be undone.`,
        confirmLabel: 'Clear all',
        onConfirm: clearHistory,
    });
});

// Init
renderHistory();
