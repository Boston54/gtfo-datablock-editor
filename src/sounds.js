export async function initSounds() {
    const soundsContainer = document.getElementById('sounds');
    if (!soundsContainer) return;

    const container = document.getElementById('sounds-table-container');
    if (!container) return;

    // Clear and show loading
    container.innerHTML = 'Loading sounds...';

    try {
        const response = await fetch('./public/vanilla/sounds/simon_sfx.txt');
        const text = await response.text();
        const lines = text.split('\n');

        let sounds = [];

        // Data lines (skip header)
        for (let i = 1; i < lines.length; i++) {
            const rawLine = lines[i];
            if (!rawLine.trim()) continue;

            const cells = rawLine.split('\t');
            
            // Clean structure: Tab at start means ID is at cells[1]
            const id = cells[1]?.trim() || '';
            const name = cells[2]?.trim() || '';
            const path = cells[5]?.trim() || '';

            if (!id && !name && !path) continue;
            sounds.push({ id, name, path });
        }

        renderSounds(sounds, container);

        // Setup search
        let debounceTimer;
        const searchInput = document.getElementById('sounds-search');
        if (searchInput) {
            searchInput.oninput = () => {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    const query = searchInput.value.toLowerCase();
                    const filtered = sounds.filter(s => 
                        s.id.toLowerCase().includes(query) || 
                        s.name.toLowerCase().includes(query) || 
                        s.path.toLowerCase().includes(query)
                    );
                    renderSounds(filtered, container);
                }, 150);
            };
        }

    } catch (error) {
        console.error('Error loading sounds:', error);
        container.textContent = 'Error loading sounds.';
    }
}

function renderSounds(sounds, container) {
    container.innerHTML = '';

    if (sounds.length === 0) {
        container.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-secondary);">No sounds found.</div>';
        return;
    }

    const MAX_VISIBLE = 200;
    const toRender = sounds.slice(0, MAX_VISIBLE);

    const table = document.createElement('table');
    table.className = 'sounds-table';

    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    
    ['ID', 'Name', 'Wwise Object Path'].forEach(h => {
        const th = document.createElement('th');
        th.textContent = h;
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    toRender.forEach(sound => {
        const row = document.createElement('tr');
        [sound.id, sound.name, sound.path].forEach(text => {
            const td = document.createElement('td');
            td.textContent = text;
            row.appendChild(td);
        });
        tbody.appendChild(row);
    });
    table.appendChild(tbody);
    container.appendChild(table);

    if (sounds.length > MAX_VISIBLE) {
        const more = document.createElement('div');
        more.style.padding = '10px';
        more.style.textAlign = 'center';
        more.style.color = 'var(--text-secondary)';
        more.style.fontSize = '0.9em';
        more.textContent = `Showing first ${MAX_VISIBLE} of ${sounds.length} results. Please refine your search to see more.`;
        container.appendChild(more);
    }
}
