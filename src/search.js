export function showBlockSearch(blocks, onSelect) {
    const existing = document.getElementById("block-search-overlay");
    if (existing) existing.remove();

    const overlay = document.createElement("div");
    overlay.id = "block-search-overlay";
    overlay.className = "search-overlay";
    
    const container = document.createElement("div");
    container.className = "search-container";

    const header = document.createElement("div");
    header.className = "search-header";
    
    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = "Search by name or persistentID...";
    input.className = "search-input";
    input.style.width = "100%";
    
    header.appendChild(input);
    container.appendChild(header);

    const results = document.createElement("div");
    results.className = "search-results";
    container.appendChild(results);

    overlay.appendChild(container);
    document.body.appendChild(overlay);

    const renderResults = (filter = "") => {
        results.innerHTML = "";
        const query = filter.toLowerCase();
        
        const filtered = blocks.map((block, index) => ({ block, index }))
            .filter(({ block }) => {
                const name = (block.name || "").toLowerCase();
                const pid = (block.persistentID !== undefined && block.persistentID !== null ? block.persistentID : "").toString();
                return name.includes(query) || pid.includes(query);
            });

        if (filtered.length === 0) {
            results.innerHTML = '<div class="search-no-results">No blocks found</div>';
            return;
        }

        filtered.forEach(({ block, index }) => {
            const item = document.createElement("div");
            item.className = "search-result-item";
            
            const nameSpan = document.createElement("span");
            nameSpan.className = "search-result-name";
            nameSpan.textContent = block.name || `Block ${index}`;
            
            const pidSpan = document.createElement("span");
            pidSpan.className = "search-result-pid";
            pidSpan.textContent = `ID: ${block.persistentID || "N/A"}`;
            
            item.appendChild(nameSpan);
            item.appendChild(pidSpan);
            
            item.onclick = () => {
                onSelect(index);
                overlay.remove();
            };
            
            results.appendChild(item);
        });
    };

    input.oninput = (e) => renderResults(e.target.value);
    
    overlay.onclick = (e) => {
        if (e.target === overlay) overlay.remove();
    };

    window.addEventListener("keydown", function escListener(e) {
        if (e.key === "Escape") {
            overlay.remove();
            window.removeEventListener("keydown", escListener);
        }
    });

    renderResults();
    input.focus();
}
