import {initTreeEditor, createVirtualJsonViewer} from './editor.js';
import {loadEnums, loadSchema} from './schema.js';
import {parseJSONC} from './jsonc.js';
import {ensureDatablockLoaded, getPureVanillaData, getLinkages} from './datablocks.js';
import { showBlockSearch } from './search.js';

const DATABLOCKS_FOLDER = "public/vanilla/datablocks/";

let activeNode = null; // { filename: '...', index: 0 }
const lastViewedBlock = new Map(); // filename -> index
const validDatablockNames = new Set();
let viewMode = 'tree'; // 'tree', 'block'
let allEnums = null;
let fieldDefinitions = {};

export async function initVanillaDatablocks() {
    allEnums = await loadEnums();

    try {
        const defRes = await fetch("public/definitions.json");
        const defText = await defRes.text();
        fieldDefinitions = parseJSONC(defText);
    } catch (e) {
        console.error("Failed to load definitions", e);
    }

    const response = await fetch(DATABLOCKS_FOLDER + "datablocks.json");
    const dataText = await response.text();
    const data = parseJSONC(dataText);
    for (const blockName of data) {
        validDatablockNames.add(blockName);
    }
    
    renderVanillaTree();
}

function renderVanillaTree() {
    const container = document.getElementById("vanilla-tree-container");
    if (!container) return;
    container.innerHTML = "";

    const sortedFilenames = Array.from(validDatablockNames).sort();
    sortedFilenames.forEach(filename => {
        const nodeEl = document.createElement("div");
        nodeEl.className = "side-tree-node";
        const isActive = activeNode?.filename === filename;
        if (isActive) nodeEl.classList.add("active");
        
        const name = document.createElement("span");
        name.textContent = filename.replace(".json", "");
        nodeEl.appendChild(name);

        nodeEl.onclick = (e) => {
            e.stopPropagation();
            activeNode = { type: 'file', filename };
            openVanillaDatablock(filename);
            renderVanillaTree();
        };

        container.appendChild(nodeEl);
    });
}

async function openVanillaDatablock(filename) {
    const mainArea = document.getElementById("vanilla-main-area");
    if (!mainArea) return;
    mainArea.innerHTML = "";

    await ensureDatablockLoaded(filename);
    const data = getPureVanillaData(filename);

    if (data.Blocks && data.Blocks.length > 0) {
        const lastIndex = lastViewedBlock.get(filename) || 0;
        const validIndex = (lastIndex < data.Blocks.length) ? lastIndex : 0;
        openVanillaBlock(filename, validIndex);
        return;
    }

    const header = renderVanillaHeader(filename, "full");
    mainArea.appendChild(header);

    const detailPane = document.createElement("div");
    detailPane.className = "editor-detail-pane";
    mainArea.appendChild(detailPane);

    if (!data.Blocks || data.Blocks.length === 0) {
        detailPane.innerHTML = `<div class="editor-empty-prompt">
            No blocks found in this datablock.
        </div>`;
    } else {
        createVirtualJsonViewer(detailPane, data);
    }
}

function renderVanillaHeader(filename, blockIndex) {
    const header = document.createElement("div");
    header.className = "editor-block-header";
    header.style.display = "flex";
    header.style.alignItems = "center";
    header.style.justifyContent = "space-between";
    header.style.padding = "10px 20px";
    header.style.gap = "10px";

    const data = getPureVanillaData(filename);

    const leftGroup = document.createElement("div");
    leftGroup.style.display = "flex";
    leftGroup.style.alignItems = "center";
    leftGroup.style.gap = "15px";

    const title = document.createElement("h3");
    title.textContent = filename.replace(".json", "");
    title.style.margin = "0";
    leftGroup.appendChild(title);

    const blockSelect = document.createElement("select");
    blockSelect.className = "editor-buttons";
    blockSelect.style.background = "var(--bg-input)";
    blockSelect.style.color = "var(--text-primary)";
    blockSelect.style.border = "1px solid #666";
    blockSelect.style.minWidth = "200px";

    const hasBlocks = data.Blocks && data.Blocks.length > 0;

    if (hasBlocks) {
        data.Blocks.forEach((block, i) => {
            const opt = document.createElement("option");
            opt.value = i;
            opt.textContent = block.name || `Block ${i}`;
            if (i === blockIndex) opt.selected = true;
            blockSelect.appendChild(opt);
        });

        blockSelect.onchange = (e) => {
            openVanillaBlock(filename, parseInt(e.target.value));
        };
    } else {
        const opt = document.createElement("option");
        opt.textContent = "No blocks found";
        blockSelect.appendChild(opt);
        blockSelect.disabled = true;
    }
    leftGroup.appendChild(blockSelect);

    if (hasBlocks) {
        const searchBtn = document.createElement("button");
        searchBtn.className = "editor-buttons";
        searchBtn.innerHTML = "Search";
        searchBtn.title = "Search blocks by name or persistentID";
        searchBtn.onclick = () => {
            showBlockSearch(data.Blocks, (index) => {
                openVanillaBlock(filename, index);
            });
        };
        leftGroup.appendChild(searchBtn);
    }

    header.appendChild(leftGroup);

    const controls = document.createElement("div");
    controls.style.display = "flex";
    controls.style.gap = "10px";

    const viewModeSelect = document.createElement("select");
    viewModeSelect.className = "editor-buttons";
    viewModeSelect.style.background = "var(--bg-input)";
    viewModeSelect.style.color = "var(--text-primary)";
    viewModeSelect.style.border = "1px solid #666";
    
    ['Tree View', 'JSON View'].forEach((mode, i) => {
        const opt = document.createElement("option");
        opt.value = i === 0 ? 'tree' : 'block';
        opt.textContent = mode;
        if (viewMode === opt.value) opt.selected = true;
        viewModeSelect.appendChild(opt);
    });

    viewModeSelect.onchange = (e) => {
        viewMode = e.target.value;
        if (blockIndex === "full") openVanillaDatablock(filename);
        else openVanillaBlock(filename, blockIndex);
    };
    controls.appendChild(viewModeSelect);
    header.appendChild(controls);

    return header;
}

async function openVanillaBlock(filename, index) {
    const mainArea = document.getElementById("vanilla-main-area");
    if (!mainArea) return;
    mainArea.innerHTML = "";

    const data = getPureVanillaData(filename);
    const block = data.Blocks[index];
    const schema = await loadSchema(filename);

    const header = renderVanillaHeader(filename, index);
    mainArea.appendChild(header);

    const detailPane = document.createElement("div");
    detailPane.className = "editor-detail-pane";
    mainArea.appendChild(detailPane);

    activeNode = { filename, index };
    lastViewedBlock.set(filename, index);

    if (viewMode === 'block') {
        createVirtualJsonViewer(detailPane, block);
    } else {
        const blockSchema = schema?.Blocks?.children || null;
        initTreeEditor(detailPane, block, blockSchema, {
            enums: allEnums,
            datablockName: filename,
            linkages: getLinkages(),
            getDatablockData: getPureVanillaData,
            ensureDatablockLoaded: ensureDatablockLoaded,
            definitions: fieldDefinitions,
            readOnly: true
        });
    }
}
