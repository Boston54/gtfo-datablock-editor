import {initTreeEditor, createDefaultElement, updateDetailPane, createVirtualJsonViewer} from './editor.js';
import {loadEnums, loadSchema} from './schema.js';
import {parseJSONC} from './jsonc.js';
import {getConfigRoot, addFolderToZip} from './configs.js';

const DATABLOCKS_FOLDER = "public/vanilla/datablocks/";

let activeNode = null; // { filename: '...', index: 0 }
const currentData = new Map();
const vanillaData = new Map();
const parsedVanillaData = new Map();
const editedDatablocks = new Set();
const unsavedDatablocks = new Set();
const savedSnapshots = new Map();
let allEnums = null;
let linkages = {};
let fieldDefinitions = {};
let defaults = {};
const validDatablockNames = new Set();
let viewMode = 'tree'; // 'tree', 'block'

export function getDatablockState() {
    return {
        currentData: Array.from(currentData.entries()),
        activeNode,
        viewMode
    };
}

export function setDatablockState(state) {
    if (!state) return;
    currentData.clear();
    savedSnapshots.clear();
    unsavedDatablocks.clear();
    if (state.currentData) {
        state.currentData.forEach(([filename, data]) => {
            currentData.set(filename, data);
            savedSnapshots.set(filename, JSON.stringify(data, null, 4));
            updateEditedStatus(filename);
        });
    }
    activeNode = state.activeNode;
    viewMode = state.viewMode || 'tree';
    
    renderDatablockTree();
    if (activeNode) {
        if (activeNode.index !== undefined) openBlock(activeNode.filename, activeNode.index);
        else openDatablock(activeNode.filename);
    }
}

export function getDatablockData(name) {
    if (!name.endsWith(".json")) name += ".json";
    if (currentData.has(name)) return currentData.get(name);
    return parsedVanillaData.get(name);
}

export function getLinkages() {
    return linkages;
}

export async function addNewDatablock(datablockName, useVanillaTemplate = false) {
    if (currentData.has(datablockName)) {
        activeNode = { filename: datablockName };
        openDatablock(datablockName);
        renderDatablockTree();
        return;
    }

    let datablock;
    if (useVanillaTemplate) {
        const vanilla = await fetchVanillaData(datablockName);
        if (vanilla) {
            datablock = JSON.parse(vanilla);
        } else {
            datablock = { Blocks: [] };
        }
    } else {
        datablock = { Blocks: [] }
    }

    currentData.set(datablockName, datablock);
    updateEditedStatus(datablockName);
    
    activeNode = { filename: datablockName };
    openDatablock(datablockName);
    renderDatablockTree();

    document.getElementById("add-datablock-form").hidden = true;
}

function renderDatablockTree() {
    const container = document.getElementById("datablock-tree-container");
    if (!container) return;
    container.innerHTML = "";

    const sortedFilenames = Array.from(currentData.keys()).sort();
    sortedFilenames.forEach(filename => {
        renderFileNode(container, filename);
    });
}

function renderFileNode(container, filename) {
    const nodeEl = document.createElement("div");
    nodeEl.className = "side-tree-node";
    const isActive = activeNode?.filename === filename;
    if (isActive) nodeEl.classList.add("active");
    
    const name = document.createElement("span");
    name.textContent = filename.replace(".json", "");
    
    if (!editedDatablocks.has(filename)) {
        name.style.color = "#ffffff"; // White
    } else if (unsavedDatablocks.has(filename)) {
        name.style.color = "var(--status-unsaved)"; // Green
        name.style.fontWeight = "bold";
    } else {
        name.style.color = "var(--status-saved)"; // Lighter Blue
        name.style.fontWeight = "bold";
    }
    
    nodeEl.appendChild(name);

    const deleteBtn = document.createElement("span");
    deleteBtn.textContent = "✖";
    deleteBtn.className = "node-delete";
    deleteBtn.onclick = (e) => {
        e.stopPropagation();
        deleteDatablockFile(filename);
    };
    nodeEl.appendChild(deleteBtn);

    nodeEl.onclick = (e) => {
        e.stopPropagation();
        activeNode = { type: 'file', filename };
        openDatablock(filename);
        renderDatablockTree();
    };

    container.appendChild(nodeEl);
}

function deleteDatablockFile(filename) {
    if (!confirm(`Are you sure you want to delete ${filename}?`)) return;
    
    currentData.delete(filename);
    editedDatablocks.delete(filename);
    unsavedDatablocks.delete(filename);
    savedSnapshots.delete(filename);
    
    if (activeNode?.filename === filename) {
        activeNode = null;
        const mainArea = document.getElementById("datablock-main-area");
        if (mainArea) mainArea.innerHTML = "";
    }
    
    renderDatablockTree();
}

async function openDatablock(filename) {
    const mainArea = document.getElementById("datablock-main-area");
    if (!mainArea) return;
    mainArea.innerHTML = "";

    const data = currentData.get(filename);
    if (data.Blocks && data.Blocks.length > 0) {
        openBlock(filename, 0);
        return;
    }

    const header = renderDatablockHeader(filename, "full");
    mainArea.appendChild(header);

    const detailPane = document.createElement("div");
    detailPane.className = "editor-detail-pane";
    mainArea.appendChild(detailPane);

    if (!data.Blocks || data.Blocks.length === 0) {
        detailPane.innerHTML = `<div class="editor-empty-prompt">
            No blocks found in this datablock.<br>
            Click 'Add Block' above to create one.
        </div>`;
    } else {
        createVirtualJsonViewer(detailPane, data);
    }
}

function renderDatablockHeader(filename, blockIndex) {
    const header = document.createElement("div");
    header.className = "editor-block-header";
    header.style.display = "flex";
    header.style.alignItems = "center";
    header.style.justifyContent = "space-between";
    header.style.padding = "10px 20px";
    header.style.gap = "10px";

    const data = currentData.get(filename);

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
            if (e.target.value === "full") {
                openDatablock(filename);
            } else {
                openBlock(filename, parseInt(e.target.value));
            }
        };
    } else {
        const opt = document.createElement("option");
        opt.textContent = "No blocks found";
        blockSelect.appendChild(opt);
        blockSelect.disabled = true;
    }
    leftGroup.appendChild(blockSelect);
    header.appendChild(leftGroup);

    const controls = document.createElement("div");
    controls.style.display = "flex";
    controls.style.gap = "10px";

    const addBlockBtn = createButton("Add Block", "editor-buttons primary", "Add a new block to this datablock");
    addBlockBtn.onclick = async () => {
        const schema = await loadSchema(filename);
        if (!data.Blocks) data.Blocks = [];
        const newBlock = (schema && schema.Blocks) ? createDefaultElement(schema.Blocks, { 
            enums: allEnums, 
            defaults, 
            datablockName: filename.replace(".json", "") 
        }) : {};
        
        if (!newBlock.persistentID) newBlock.persistentID = Math.floor(Math.random() * 1000000000);
        if (!newBlock.name) newBlock.name = "New Block";
        
        data.Blocks.push(newBlock);
        updateEditedStatus(filename);
        activeNode = { filename, index: data.Blocks.length - 1 };
        openBlock(filename, data.Blocks.length - 1);
        renderDatablockTree();
    };

    const downloadBtn = createButton("Download JSON", "editor-buttons success", "Download this datablock as a JSON file");
    downloadBtn.onclick = () => {
        const fileName = `GameData_${filename.replace(".json", "")}_bin.json`;
        const blob = new Blob([JSON.stringify(data, null, 4)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = fileName; a.click();
        URL.revokeObjectURL(url);
    };

    controls.append(addBlockBtn, downloadBtn);

    if (hasBlocks && blockIndex !== "full") {
        const deleteBtn = createButton("Delete Block", "editor-buttons danger", "Delete this block");
        deleteBtn.onclick = () => {
            if (confirm(`Are you sure you want to delete block "${data.Blocks[blockIndex].name || blockIndex}"?`)) {
                data.Blocks.splice(blockIndex, 1);
                updateEditedStatus(filename);
                if (data.Blocks.length > 0) {
                    openBlock(filename, Math.max(0, blockIndex - 1));
                } else {
                    openDatablock(filename);
                }
                renderDatablockTree();
            }
        };
        controls.prepend(deleteBtn);
    }

    header.appendChild(controls);
    return header;
}

async function openBlock(filename, index) {
    const mainArea = document.getElementById("datablock-main-area");
    if (!mainArea) return;
    mainArea.innerHTML = "";

    const data = currentData.get(filename);
    const block = data.Blocks[index];
    const schema = await loadSchema(filename);

    // Pre-fetch relevant vanilla data for dropdowns
    const datablockType = filename.replace(".json", "");
    const relevantLinkages = linkages[datablockType] || {};
    const targetBlocks = new Set(Object.values(relevantLinkages).map(l => typeof l === 'string' ? l : l.block));
    
    // Add assumptions too
    if (linkages.Assumptions) {
        for (const target of Object.values(linkages.Assumptions)) {
            targetBlocks.add(target);
        }
    }
    
    await Promise.all(Array.from(targetBlocks).map(name => fetchVanillaData(name + ".json")));

    const header = renderDatablockHeader(filename, index);
    
    const controls = header.querySelector("div:last-child");
    const viewModeSelect = document.createElement("select");
    viewModeSelect.className = "editor-buttons";
    viewModeSelect.style.background = "var(--bg-input)";
    viewModeSelect.style.color = "var(--text-primary)";
    viewModeSelect.style.border = "1px solid #666";
    
    ['Tree View', 'JSON View (readonly)'].forEach((mode, i) => {
        const opt = document.createElement("option");
        opt.value = i === 0 ? 'tree' : 'block';
        opt.textContent = mode;
        if (viewMode === opt.value) opt.selected = true;
        viewModeSelect.appendChild(opt);
    });

    viewModeSelect.onchange = (e) => {
        viewMode = e.target.value;
        openBlock(filename, index);
    };
    controls.prepend(viewModeSelect);

    mainArea.appendChild(header);

    const detailPane = document.createElement("div");
    detailPane.className = "editor-detail-pane";
    mainArea.appendChild(detailPane);

    const onUpdate = (key, value, oldValue) => {
        updateEditedStatus(filename);
        if (key === 'name' || key === 'persistentID') {
            const blockSelect = header.querySelector("select");
            if (blockSelect) {
                const opt = blockSelect.options[index];
                if (opt) opt.textContent = block.name || `Block ${index}`;
            }
            renderDatablockTree();
        }
        updateReferences(filename.replace(".json", ""), key, oldValue, value);
    };

    activeNode = { filename, index };

    if (viewMode === 'block') {
        createVirtualJsonViewer(detailPane, block);
    } else {
        const blockSchema = schema?.Blocks?.children || null;
        initTreeEditor(detailPane, block, blockSchema, allEnums, filename, linkages, getDatablockData, fieldDefinitions, defaults, onUpdate);
    }
}

export function deleteCurrentDatablock() {
    // This function is now mostly handled by deleteDatablockFile, but kept for compatibility
    if (activeNode) {
        deleteDatablockFile(activeNode.filename);
    }
}

export function closeAllDatablocks() {
    activeNode = null;
    const mainArea = document.getElementById("datablock-main-area");
    if (mainArea) mainArea.innerHTML = "";
    renderDatablockTree();
}

export function resetToVanilla() {
    currentData.clear();
    editedDatablocks.clear();
    unsavedDatablocks.clear();
    savedSnapshots.clear();
    closeAllDatablocks();
}

export async function importDatablocks(files) {
    for (const file of files) {
        const name = file.name;
        const normalizedName = name.replace(/^GameData_/, "").replace(/(_bin)?\.json$/, ".json");

        if (normalizedName.endsWith(".json") && validDatablockNames.has(normalizedName)) {
            const text = await file.text();
            try {
                const datablock = parseJSONC(text);
                const datablockName = normalizedName;
                
                currentData.set(datablockName, datablock);
                updateEditedStatus(datablockName);
                if (!activeNode) {
                    activeNode = { filename: datablockName };
                    openDatablock(datablockName);
                }
            } catch (e) {
                console.error(`Failed to parse ${file.name}`, e);
            }
        }
    }
    renderDatablockTree();
}


function createButton(text, className, title) {
    const btn = document.createElement("button");
    btn.textContent = text;
    btn.className = className;
    btn.title = title;
    return btn;
}


export async function initDatablocks() {
    const select = document.getElementById("datablock-select");

    allEnums = await loadEnums();

    try {
        const linkRes = await fetch("public/datablockLinkages.json");
        const linkText = await linkRes.text();
        linkages = parseJSONC(linkText);
    } catch (e) {
        console.error("Failed to load linkages", e);
    }

    try {
        const defRes = await fetch("public/definitions.json");
        const defText = await defRes.text();
        fieldDefinitions = parseJSONC(defText);
    } catch (e) {
        console.error("Failed to load definitions", e);
    }

    try {
        const defaultRes = await fetch("public/defaults.json");
        const defaultText = await defaultRes.text();
        defaults = parseJSONC(defaultText);
    } catch (e) {
        console.error("Failed to load defaults", e);
    }

    const response = await fetch(DATABLOCKS_FOLDER + "datablocks.json");
    const dataText = await response.text();
    const data = parseJSONC(dataText);
    for (const blockName of data) {
        validDatablockNames.add(blockName);

        // Add this datablock as an option in the 'new datablock' form
        const option = document.createElement("option");
        option.value = blockName;
        option.textContent = blockName;
        select.appendChild(option);
    }
    
    renderDatablockTree();
}

async function fetchVanillaData(filename) {
    if (vanillaData.has(filename)) return vanillaData.get(filename);
    if (!validDatablockNames.has(filename)) return undefined;

    try {
        const response = await fetch(DATABLOCKS_FOLDER + filename);
        const text = await response.text();
        const datablock = parseJSONC(text);
        const stringified = JSON.stringify(datablock, null, 4);
        vanillaData.set(filename, stringified);
        parsedVanillaData.set(filename, datablock);
        return stringified;
    } catch (e) {
        console.error(`Failed to load vanilla data for ${filename}`, e);
        return undefined;
    }
}

const pendingEditedUpdates = new Set();
let editedUpdateTimeout = null;

export function updateEditedStatus(filename) {
    pendingEditedUpdates.add(filename);
    clearTimeout(editedUpdateTimeout);
    editedUpdateTimeout = setTimeout(() => {
        for (const file of pendingEditedUpdates) {
            _updateEditedStatus(file);
        }
        pendingEditedUpdates.clear();
        renderDatablockTree();
    }, 500);
}

function _updateEditedStatus(filename) {
    const current = currentData.get(filename);
    const vanilla = vanillaData.get(filename);
    const saved = savedSnapshots.get(filename);

    if (current === undefined) {
        editedDatablocks.delete(filename);
        unsavedDatablocks.delete(filename);
        return;
    }

    if (vanilla === undefined && validDatablockNames.has(filename)) {
        fetchVanillaData(filename).then(() => {
            updateEditedStatus(filename);
        });
        return;
    }

    const currentStr = JSON.stringify(current, null, 4);

    if (vanilla === undefined) {
        // If it's not a vanilla block, it's considered edited (new)
        editedDatablocks.add(filename);
    } else {
        if (currentStr !== vanilla) {
            editedDatablocks.add(filename);
        } else {
            editedDatablocks.delete(filename);
        }
    }

    if (saved === undefined) {
        unsavedDatablocks.add(filename);
    } else {
        if (currentStr !== saved) {
            unsavedDatablocks.add(filename);
        } else {
            unsavedDatablocks.delete(filename);
        }
    }
}

export function markDatablocksSaved() {
    unsavedDatablocks.clear();
    for (const [filename, data] of currentData.entries()) {
        savedSnapshots.set(filename, JSON.stringify(data, null, 4));
    }
    renderDatablockTree();
}


function updateReferences(changedDatablockName, changedField, oldValue, newValue) {
    if (oldValue === undefined || oldValue === newValue) return;

    const affectedExplicit = [];
    const assumedFields = [];

    // Identify explicit linkages
    for (const [sourceDatablock, fields] of Object.entries(linkages)) {
        if (sourceDatablock === "Assumptions") continue;
        for (const [fieldKey, rawLinkage] of Object.entries(fields)) {
            const linkage = typeof rawLinkage === 'string' 
                ? { block: rawLinkage, target: 'persistentID' }
                : { block: rawLinkage.block, target: rawLinkage.target || 'persistentID' };

            if (linkage.block === changedDatablockName && linkage.target === changedField) {
                affectedExplicit.push({ sourceDatablock, fieldKey });
            }
        }
    }

    // Identify assumed fields (only for persistentID changes)
    if (linkages.Assumptions && changedField === 'persistentID') {
        for (const [field, target] of Object.entries(linkages.Assumptions)) {
            if (target === changedDatablockName) {
                assumedFields.push(field);
            }
        }
    }

    if (affectedExplicit.length === 0 && assumedFields.length === 0) return;

    // Process explicit updates
    affectedExplicit.forEach(({ sourceDatablock, fieldKey }) => {
        const fullFilename = sourceDatablock + ".json";
        const data = currentData.get(fullFilename);
        if (data) {
            let changed = false;
            if (data.Blocks) {
                data.Blocks.forEach(block => {
                    if (updateFieldByPath(block, fieldKey, oldValue, newValue)) changed = true;
                });
            }
            if (updateFieldByPath(data, fieldKey, oldValue, newValue)) changed = true;

            if (changed) {
                updateEditedStatus(fullFilename);
            }
        }
    });

    // Process assumed updates across all datablocks
    if (assumedFields.length > 0) {
        for (const [filename, data] of currentData.entries()) {
            let changed = false;
            assumedFields.forEach(fieldName => {
                if (updateFieldByName(data, fieldName, oldValue, newValue)) changed = true;
            });
            if (changed) {
                updateEditedStatus(filename);
            }
        }
    }

    renderDatablockTree();
    if (activeNode) {
        if (activeNode.index !== undefined) openBlock(activeNode.filename, activeNode.index);
        else openDatablock(activeNode.filename);
    }
}

function updateFieldByName(obj, fieldName, oldValue, newValue) {
    if (typeof obj !== 'object' || obj === null) return false;
    let changed = false;

    if (Array.isArray(obj)) {
        obj.forEach(item => {
            if (updateFieldByName(item, fieldName, oldValue, newValue)) changed = true;
        });
    } else {
        for (const key in obj) {
            if (key === fieldName && obj[key] === oldValue) {
                obj[key] = newValue;
                changed = true;
            } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                if (updateFieldByName(obj[key], fieldName, oldValue, newValue)) changed = true;
            }
        }
    }
    return changed;
}

function updateFieldByPath(obj, path, oldValue, newValue) {
    if (typeof obj !== 'object' || obj === null) return false;

    let changed = false;
    const parts = path.split('.');
    const first = parts[0];

    if (parts.length === 1) {
        if (Array.isArray(obj)) {
            obj.forEach((item, index) => {
                if (item === oldValue) {
                    obj[index] = newValue;
                    changed = true;
                } else if (item && typeof item === 'object' && item[first] === oldValue) {
                    item[first] = newValue;
                    changed = true;
                }
            });
        } else if (obj[first] === oldValue) {
            obj[first] = newValue;
            changed = true;
        } else if (Array.isArray(obj[first])) {
            obj[first].forEach((item, index) => {
                if (item === oldValue) {
                    obj[first][index] = newValue;
                    changed = true;
                }
            });
        }
    } else {
        const remaining = parts.slice(1).join('.');
        if (Array.isArray(obj)) {
            obj.forEach(item => {
                if (updateFieldByPath(item, path, oldValue, newValue)) changed = true;
            });
        } else if (obj[first] !== undefined) {
            if (updateFieldByPath(obj[first], remaining, oldValue, newValue)) changed = true;
        }
    }
    return changed;
}


export async function downloadAllAsZip() {
    const editedFiles = Array.from(currentData.entries()).filter(([filename]) => editedDatablocks.has(filename));
    const configRoot = getConfigRoot();
    const hasConfigs = configRoot.children.length > 0;

    if (editedFiles.length === 0 && !hasConfigs) {
        alert("No edited datablocks or configs to download!");
        return;
    }

    const zip = new JSZip();
    for (const [filename, data] of editedFiles) {
        const nameWithoutExt = filename.replace(".json", "");
        const zipFileName = `GameData_${nameWithoutExt}_bin.json`;
        zip.file(zipFileName, JSON.stringify(data, null, 4));
    }

    if (hasConfigs) {
        addFolderToZip(zip, configRoot);
    }

    const content = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(content);
    const a = document.createElement("a");
    a.href = url;
    a.download = "rundown.zip";
    a.click();
    URL.revokeObjectURL(url);
}


export async function downloadProjectAsZip() {
    const zip = new JSZip();
    
    // Include ALL datablocks
    for (const [filename, data] of currentData.entries()) {
        const nameWithoutExt = filename.replace(".json", "");
        const zipFileName = `GameData_${nameWithoutExt}_bin.json`;
        zip.file(zipFileName, JSON.stringify(data, null, 4));
    }

    // Include configs
    const configRoot = getConfigRoot();
    if (configRoot.children.length > 0) {
        addFolderToZip(zip, configRoot);
    }

    if (zip.files && Object.keys(zip.files).length === 0) {
        alert("Nothing to download!");
        return;
    }

    const content = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(content);
    const a = document.createElement("a");
    a.href = url;
    a.download = "project.zip";
    a.click();
    URL.revokeObjectURL(url);
}