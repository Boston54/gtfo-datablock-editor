import {initTreeEditor, createDefaultElement, updateDetailPane} from './editor.js';
import {loadEnums, loadSchema} from './schema.js';
import {parseJSONC} from './jsonc.js';

const DATABLOCKS_FOLDER = "public/vanilla/datablocks/";
const EDITOR_TAB_CLASS = "editor-tab-page";

let currentEditorTabId = null;
let activeDatablocks = [];
const currentData = new Map();
const vanillaData = new Map();
const editedDatablocks = new Set();
let allEnums = null;
let linkages = {};
let fieldDefinitions = {};
let defaults = {};
const tabRefreshFunctions = new Map();
const validDatablockNames = new Set();

export function getDatablockData(name) {
    if (!name.endsWith(".json")) name += ".json";
    return currentData.get(name);
}

export function getLinkages() {
    return linkages;
}

function asTabId(datablockName) {
    return "editor-tab-page-" + datablockName.replace(".json", "");
}

export async function addNewDatablock(datablockName, useVanillaTemplate = false) {
    const tabId = asTabId(datablockName);
    if (document.getElementById(tabId)) {
        // This datablock already exists, just switch to it instead
        showEditorTab(tabId);
        document.getElementById("add-datablock-form").hidden = true;
        return;
    }

    let datablock;
    if (useVanillaTemplate) {
        if (vanillaData.has(datablockName)) {
            datablock = JSON.parse(vanillaData.get(datablockName));
        } else {
            const response = await fetch(DATABLOCKS_FOLDER + datablockName);
            const text = await response.text();
            datablock = parseJSONC(text);
        }
    } else {
        datablock = {}
    }

    const schema = await loadSchema(datablockName);

    createDatablockTab(datablockName, datablock, schema);
    currentData.set(datablockName, datablock);
    activeDatablocks.push({ filename: datablockName });
    updateEditedStatus(datablockName);

    document.getElementById("add-datablock-form").hidden = true;
}

function createDatablockTab(datablockName, datablock, schema) {
    const id = asTabId(datablockName);

    const buttonsElement = document.getElementById("editor-tab-buttons");
    const pagesElement = document.getElementById("editor-tab-pages");

    const button = document.createElement("button");
    button.textContent = datablockName;
    button.onclick = () => showEditorTab(id);
    button.dataset.tabId = id;

    const page = document.createElement("div");
    page.id = id;
    page.classList.add("editor-tab-page");

    createMasterDetailEditor(page, datablock, schema, datablockName, fieldDefinitions);

    buttonsElement.appendChild(button);
    pagesElement.appendChild(page);

    showEditorTab(id);
}

function showEditorTab(tabId) {
    currentEditorTabId = tabId;
    document.querySelectorAll("." + EDITOR_TAB_CLASS).forEach(page => {
        page.classList.remove('active');
    });
    document.getElementById(tabId).classList.add('active');

    // Update button states
    document.querySelectorAll('#editor-tab-buttons button').forEach(btn => {
        if (btn.dataset.tabId === tabId) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

export function deleteCurrentDatablock(skipConfirm = false) {
    if (!currentEditorTabId) return;

    const blockEntry = activeDatablocks.find(
        block => asTabId(block.filename) === currentEditorTabId
    );
    const filename = blockEntry?.filename;

    if (!skipConfirm) {
        const message = filename ? `Are you sure you want to delete ${filename}?` : "Are you sure you want to delete this datablock?";
        if (!confirm(message)) return;
    }

    const page = document.getElementById(currentEditorTabId);
    if (page) page.remove();

    const button = document.querySelector(`[data-tab-id="${currentEditorTabId}"]`);
    if (button) button.remove();

    activeDatablocks = activeDatablocks.filter(
        block => asTabId(block.filename) !== currentEditorTabId
    );

    if (filename) {
        currentData.delete(filename);
        editedDatablocks.delete(filename);
    }
    tabRefreshFunctions.delete(currentEditorTabId);

    currentEditorTabId = null;

    const firstRemainingTab = document.querySelector("." + EDITOR_TAB_CLASS);
    if (firstRemainingTab) {
        showEditorTab(firstRemainingTab.id);
    }
}

export function closeAllDatablocks() {
    const filenames = activeDatablocks.map(b => b.filename);
    filenames.forEach(filename => {
        currentEditorTabId = asTabId(filename);
        deleteCurrentDatablock(true);
    });
}

export async function importDatablocks(files) {
    for (const file of files) {
        const name = file.name;
        // Normalize the name: remove GameData_ prefix and _bin suffix
        const normalizedName = name.replace(/^GameData_/, "").replace(/(_bin)?\.json$/, ".json");

        if (normalizedName.endsWith(".json") && validDatablockNames.has(normalizedName)) {
            const text = await file.text();
            try {
                const datablock = parseJSONC(text);
                const datablockName = normalizedName;
                
                const tabId = asTabId(datablockName);
                if (document.getElementById(tabId)) {
                    if (!confirm(`${datablockName} is already open. Do you want to overwrite it?`)) {
                        continue;
                    }
                    currentEditorTabId = tabId;
                    deleteCurrentDatablock(true);
                }

                const schema = await loadSchema(datablockName);
                currentData.set(datablockName, datablock);
                updateEditedStatus(datablockName);
                createDatablockTab(datablockName, datablock, schema);
                activeDatablocks.push({ filename: datablockName });
            } catch (e) {
                console.error(`Failed to parse ${file.name}`, e);
            }
        }
    }
}

function createMasterDetailEditor(container, datablock, schema, datablockName, definitions) {
    const tabId = container.id;
    let editorState = null;
    let viewMode = 'tree'; // 'tree', 'block', 'full'
    container.classList.add("editor-container");

    const header = document.createElement("div");
    header.className = "editor-block-header";

    const controls = createEditorControls(header, datablock, schema, datablockName, definitions, (newViewMode) => {
        viewMode = newViewMode;
        loadSelectedBlock();
    });

    const detailPane = document.createElement("div");
    detailPane.className = "editor-detail-pane";

    container.appendChild(header);
    container.appendChild(detailPane);

    if (!datablock.Blocks) datablock.Blocks = [];
    const blocks = datablock.Blocks;

    const onUpdate = (key, value, oldValue) => {
        updateEditedStatus(datablockName);
        if (key === 'name' || key === 'persistentID') {
            controls.renderOptions();
        }
        updateReferences(datablockName.replace(".json", ""), key, oldValue, value);
        refreshAllTabs(tabId);
    };

    const loadSelectedBlock = () => {
        detailPane.innerHTML = "";
        if (viewMode === 'full') {
            createVirtualJsonViewer(detailPane, datablock);
        } else {
            const selectedBlock = blocks[controls.select.value];
            if (selectedBlock) {
                if (viewMode === 'block') {
                    createVirtualJsonViewer(detailPane, selectedBlock);
                } else {
                    const blockSchema = schema?.Blocks?.children || null;
                    editorState = initTreeEditor(detailPane, selectedBlock, blockSchema, allEnums, datablockName, linkages, getDatablockData, definitions, defaults, onUpdate);
                }
            } else if (blocks.length === 0) {
                const prompt = document.createElement("div");
                prompt.className = "editor-empty-prompt";
                prompt.innerHTML = `
                    <p>No blocks found in this datablock.</p>
                    <p>Click the <strong>Add Block</strong> button above to create one.</p>
                `;
                detailPane.appendChild(prompt);
                editorState = null;
            }
        }
        controls.updateButtonStates(viewMode, editedDatablocks.has(datablockName));
    };

    controls.select.onchange = loadSelectedBlock;
    
    controls.addBlockBtn.onclick = () => {
        const newBlock = (schema && schema.Blocks) ? createDefaultElement(schema.Blocks, { 
            enums: allEnums, 
            defaults, 
            datablockName: datablockName.replace(".json", "") 
        }) : {};
        
        if (!newBlock.persistentID) newBlock.persistentID = Math.floor(Math.random() * 1000000000);
        if (!newBlock.name) newBlock.name = "New Block";
        
        blocks.push(newBlock);
        updateEditedStatus(datablockName);
        controls.renderOptions();
        controls.select.value = blocks.length - 1;
        loadSelectedBlock();
        refreshAllTabs(tabId);
    };

    controls.deleteBlockBtn.onclick = () => {
        const index = parseInt(controls.select.value);
        if (blocks[index]) {
            const blockName = blocks[index].name || "Unnamed";
            if (confirm(`Are you sure you want to delete block "${blockName}"?`)) {
                blocks.splice(index, 1);
                updateEditedStatus(datablockName);
                controls.renderOptions();
                controls.select.value = blocks.length > 0 ? Math.min(index, blocks.length - 1) : "";
                loadSelectedBlock();
                refreshAllTabs(tabId);
            }
        }
    };

    tabRefreshFunctions.set(tabId, () => {
        controls.renderOptions();
        if (editorState && viewMode === 'tree') {
            updateDetailPane(editorState);
        } else {
            loadSelectedBlock();
        }
        controls.updateButtonStates(viewMode, editedDatablocks.has(datablockName));
    });

    if (datablock.Blocks && (datablock.Blocks.length > 0 || schema?.Blocks)) {
        controls.renderOptions();
        loadSelectedBlock();
    } else {
        header.style.display = "none";
        editorState = initTreeEditor(detailPane, datablock, schema, allEnums, datablockName, linkages, getDatablockData, definitions, defaults, onUpdate);
    }
}

function createEditorControls(header, datablock, schema, datablockName, definitions, onViewModeChange) {
    const label = document.createElement("label");
    label.textContent = "Select Block:";
    const select = document.createElement("select");
    select.className = "block-selector";

    const addBlockBtn = createButton("Add Block", "add-block-button", "Add a new block");
    const deleteBlockBtn = createButton("✖ Delete Block", "delete-entry-button", "Delete the currently selected block");
    const viewBlockJsonBtn = createButton("View Block JSON", "editor-buttons", "View raw JSON for selected block");
    const viewFullJsonBtn = createButton("View Full JSON", "editor-buttons", "View raw JSON for entire datablock");
    const downloadFullJsonBtn = createButton("Download JSON", "editor-buttons success", "Download entire datablock");
    downloadFullJsonBtn.style.display = "none";

    header.append(label, select, addBlockBtn, deleteBlockBtn, viewBlockJsonBtn, viewFullJsonBtn, downloadFullJsonBtn);

    const renderOptions = () => {
        const currentValue = select.value;
        select.innerHTML = "";
        (datablock.Blocks || []).forEach((block, index) => {
            const option = document.createElement("option");
            option.value = index;
            option.textContent = block.name || `Block ${index} (ID: ${block.persistentID})`;
            select.appendChild(option);
        });
        if (currentValue !== "" && datablock.Blocks?.[currentValue]) select.value = currentValue;
    };

    viewBlockJsonBtn.onclick = () => onViewModeChange(viewBlockJsonBtn.classList.contains('active') ? 'tree' : 'block');
    viewFullJsonBtn.onclick = () => onViewModeChange(viewFullJsonBtn.classList.contains('active') ? 'tree' : 'full');
    
    downloadFullJsonBtn.onclick = () => {
        const fileName = `GameData_${datablockName.replace(".json", "")}_bin.json`;
        const blob = new Blob([JSON.stringify(datablock, null, 4)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = fileName; a.click();
        URL.revokeObjectURL(url);
    };

    const updateButtonStates = (viewMode, isEdited) => {
        viewBlockJsonBtn.classList.toggle('active', viewMode === 'block');
        viewFullJsonBtn.classList.toggle('active', viewMode === 'full');
        downloadFullJsonBtn.style.display = (viewMode === 'full' && isEdited) ? "inline-block" : "none";
    };

    return { select, addBlockBtn, deleteBlockBtn, renderOptions, updateButtonStates };
}

function createButton(text, className, title) {
    const btn = document.createElement("button");
    btn.textContent = text;
    btn.className = className;
    btn.title = title;
    return btn;
}

function createVirtualJsonViewer(container, jsonObject) {
    const lines = JSON.stringify(jsonObject, null, 2).split("\n");

    const lineHeight = 20;
    const bufferLines = 30;

    container.replaceChildren();

    const scrollBox = document.createElement("div");
    scrollBox.classList.add("virtual-json-scrollbox");

    const spacer = document.createElement("div");
    spacer.classList.add("virtual-json-spacer");
    spacer.style.height = `${lines.length * lineHeight}px`;

    const lineNumbers = document.createElement("pre");
    lineNumbers.classList.add("virtual-json-line-numbers");

    const content = document.createElement("pre");
    content.classList.add("virtual-json-content");

    scrollBox.appendChild(spacer);
    scrollBox.appendChild(lineNumbers);
    scrollBox.appendChild(content);
    container.appendChild(scrollBox);

    function render() {
        const startLine = Math.max(
            0,
            Math.floor(scrollBox.scrollTop / lineHeight) - bufferLines
        );

        const visibleLineCount =
            Math.ceil(scrollBox.clientHeight / lineHeight) + bufferLines * 2;

        const endLine = Math.min(lines.length, startLine + visibleLineCount);

        const visibleLines = lines.slice(startLine, endLine);

        const offsetY = startLine * lineHeight;

        lineNumbers.style.transform = `translateY(${offsetY}px)`;
        content.style.transform = `translateY(${offsetY}px)`;

        lineNumbers.textContent = visibleLines
            .map((_, index) => startLine + index + 1)
            .join("\n");

        content.textContent = visibleLines.join("\n");
    }

    scrollBox.addEventListener("scroll", render);

    render();
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
        // Load the actual datablock
        const block = await fetch(DATABLOCKS_FOLDER + blockName);
        const blockText = await block.text();
        const datablock = parseJSONC(blockText);

        // Store vanilla stringified version
        vanillaData.set(blockName, JSON.stringify(datablock, null, 4));

        // Add this to the stored data
        currentData.set(blockName, datablock);

        // Add this datablock as an option in the 'new datablock' form
        const option = document.createElement("option");
        option.value = blockName;
        option.textContent = blockName;
        select.appendChild(option);
    }
}

function updateEditedStatus(filename) {
    const current = currentData.get(filename);
    const vanilla = vanillaData.get(filename);

    if (current === undefined) {
        editedDatablocks.delete(filename);
        return;
    }

    if (vanilla === undefined) {
        // If it's not a vanilla block, it's considered edited (new)
        editedDatablocks.add(filename);
    } else {
        const currentStr = JSON.stringify(current, null, 4);
        if (currentStr !== vanilla) {
            editedDatablocks.add(filename);
        } else {
            editedDatablocks.delete(filename);
        }
    }
}

function refreshAllTabs(excludeTabId = null) {
    tabRefreshFunctions.forEach((refresh, tabId) => {
        if (tabId !== excludeTabId) {
            refresh();
        }
    });
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

    if (editedFiles.length === 0) {
        alert("No edited datablocks to download!");
        return;
    }

    const zip = new JSZip();
    for (const [filename, data] of editedFiles) {
        const nameWithoutExt = filename.replace(".json", "");
        const zipFileName = `GameData_${nameWithoutExt}_bin.json`;
        zip.file(zipFileName, JSON.stringify(data, null, 4));
    }

    const content = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(content);
    const a = document.createElement("a");
    a.href = url;
    a.download = "datablocks.zip";
    a.click();
    URL.revokeObjectURL(url);
}