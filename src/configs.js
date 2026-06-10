import { initTreeEditor, createVirtualJsonViewer } from './editor.js';
import { parseJSONC } from './jsonc.js';

let configRoot = {
    name: "Custom",
    type: "folder",
    expanded: true,
    children: []
};

let activeNode = null;
let viewMode = 'tree';
const unsavedConfigs = new Set();
const savedSnapshots = new Map();

export function getConfigState() {
    // We need to strip parent references to avoid circularity for JSON serialization/storage
    const stripParents = (node) => {
        const newNode = { ...node };
        delete newNode.parent;
        if (newNode.children) {
            newNode.children = newNode.children.map(stripParents);
        }
        return newNode;
    };

    return {
        configRoot: stripParents(configRoot),
        activeNodeName: activeNode ? activeNode.name : null, // Store name to find it back
        viewMode
    };
}

export function setConfigState(state) {
    if (!state || !state.configRoot) return;

    // Restore parent references
    const restoreParents = (node, parent = null) => {
        node.parent = parent;
        if (node.children) {
            node.children.forEach(child => restoreParents(child, node));
        }
    };

    configRoot = state.configRoot;
    restoreParents(configRoot);
    viewMode = state.viewMode || 'tree';

    // Initialize savedSnapshots
    const initSaved = (node) => {
        if (node.type === 'file') {
            savedSnapshots.set(node, JSON.stringify(node.content, null, 4));
        }
        if (node.children) node.children.forEach(initSaved);
    };
    savedSnapshots.clear();
    unsavedConfigs.clear();
    initSaved(configRoot);

    // Try to restore activeNode by name (simplistic, but often enough for a start)
    if (state.activeNodeName) {
        const findNode = (node, name) => {
            if (node.name === name) return node;
            if (node.children) {
                for (const child of node.children) {
                    const found = findNode(child, name);
                    if (found) return found;
                }
            }
            return null;
        };
        activeNode = findNode(configRoot, state.activeNodeName);
    } else {
        activeNode = null;
    }

    if (activeNode && activeNode.type === 'file') {
        openFile(activeNode);
    } else {
        const mainArea = document.getElementById("config-main-area");
        if (mainArea) mainArea.innerHTML = "";
    }

    renderFileTree();
}

export async function initConfigs() {
    const addFileBtn = document.getElementById('add-config-file');
    const addFolderBtn = document.getElementById('add-config-folder');
    const container = document.getElementById("config-tree-container");

    if (addFileBtn) addFileBtn.onclick = () => createNewEntry("file");
    if (addFolderBtn) addFolderBtn.onclick = () => createNewEntry("folder");

    if (container) {
        container.onclick = () => {
            activeNode = null;
            renderFileTree();
        };
    }

    renderFileTree();
}

function renderFileTree() {
    const container = document.getElementById("config-tree-container");
    if (!container) return;
    container.innerHTML = "";
    
    // Sort and render children of configRoot directly
    configRoot.children.sort((a, b) => {
        if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
        return a.name.localeCompare(b.name);
    }).forEach(child => renderNode(container, child));
}

function renderNode(container, node) {
    const nodeEl = document.createElement("div");
    nodeEl.className = "side-tree-node";
    if (activeNode === node) nodeEl.classList.add("active");

    const icon = document.createElement("span");
    icon.className = "icon";
    icon.textContent = node.type === "folder" ? (node.expanded ? "▼" : "▶") : "📄";
    nodeEl.appendChild(icon);

    const name = document.createElement("span");
    name.textContent = node.name;
    
    if (node.type === 'file') {
        if (unsavedConfigs.has(node)) {
            name.style.color = "var(--status-unsaved)"; // Green
            name.style.fontWeight = "bold";
        } else {
            name.style.color = "var(--status-saved)"; // Lighter Blue
            name.style.fontWeight = "bold";
        }
    }
    
    nodeEl.appendChild(name);

    if (node !== configRoot) {
        const deleteBtn = document.createElement("span");
        deleteBtn.textContent = "✖";
        deleteBtn.className = "node-delete";
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            deleteNode(node);
        };
        nodeEl.appendChild(deleteBtn);
    }

    nodeEl.onclick = (e) => {
        e.stopPropagation();
        if (node.type === "folder") {
            node.expanded = !node.expanded;
            renderFileTree();
        } else {
            activeNode = node;
            openFile(node);
            renderFileTree();
        }
    };

    container.appendChild(nodeEl);

    if (node.type === "folder" && node.expanded && node.children) {
        const childrenContainer = document.createElement("div");
        childrenContainer.className = "side-tree-node-children";
        node.children.sort((a, b) => {
            if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
            return a.name.localeCompare(b.name);
        }).forEach(child => renderNode(childrenContainer, child));
        container.appendChild(childrenContainer);
    }
}

function createNewEntry(type) {
    const name = prompt(`Enter ${type} name:`);
    if (!name) return;

    let parent = configRoot;
    if (activeNode && activeNode.type === "folder") {
        parent = activeNode;
    } else if (activeNode && activeNode.parent) {
        parent = activeNode.parent;
    }

    const newNode = {
        name: name + (type === "file" && !name.endsWith(".json") ? ".json" : ""),
        type: type,
        parent: parent,
        expanded: true,
        children: type === "folder" ? [] : undefined,
        content: type === "file" ? {} : undefined
    };

    parent.children.push(newNode);
    parent.expanded = true;
    if (type === "file") {
        activeNode = newNode;
        updateUnsavedStatus(newNode);
        openFile(newNode);
    }
    renderFileTree();
}

const pendingUnsavedUpdates = new Set();
let unsavedUpdateTimeout = null;

function updateUnsavedStatus(node) {
    pendingUnsavedUpdates.add(node);
    clearTimeout(unsavedUpdateTimeout);
    unsavedUpdateTimeout = setTimeout(() => {
        for (const n of pendingUnsavedUpdates) {
            _updateUnsavedStatus(n);
        }
        pendingUnsavedUpdates.clear();
        renderFileTree();
    }, 500);
}

function _updateUnsavedStatus(node) {
    if (node.type !== 'file') return;
    const current = JSON.stringify(node.content, null, 4);
    const saved = savedSnapshots.get(node);
    
    if (saved === undefined || current !== saved) {
        unsavedConfigs.add(node);
    } else {
        unsavedConfigs.delete(node);
    }
}

export function markConfigsSaved() {
    const markSaved = (node) => {
        if (node.type === 'file') {
            savedSnapshots.set(node, JSON.stringify(node.content, null, 4));
        }
        if (node.children) node.children.forEach(markSaved);
    };
    unsavedConfigs.clear();
    markSaved(configRoot);
    renderFileTree();
}

function deleteNode(node) {
    if (!confirm(`Are you sure you want to delete ${node.name}?`)) return;
    const parent = node.parent || configRoot;
    parent.children = parent.children.filter(c => c !== node);
    
    // Cleanup saved state
    const cleanupSaved = (n) => {
        savedSnapshots.delete(n);
        unsavedConfigs.delete(n);
        if (n.children) n.children.forEach(cleanupSaved);
    };
    cleanupSaved(node);

    if (activeNode === node) {
        activeNode = null;
        const mainArea = document.getElementById("config-main-area");
        if (mainArea) mainArea.innerHTML = "";
    }
    renderFileTree();
}

function openFile(node) {
    const mainArea = document.getElementById("config-main-area");
    if (!mainArea) return;
    mainArea.innerHTML = "";

    const header = document.createElement("div");
    header.className = "editor-block-header";
    header.style.display = "flex";
    header.style.alignItems = "center";
    header.style.justifyContent = "space-between";
    header.style.padding = "10px 20px";
    
    const title = document.createElement("h3");
    title.textContent = node.name;
    title.style.margin = "0";
    header.appendChild(title);

    const controls = document.createElement("div");
    controls.style.display = "flex";
    controls.style.gap = "10px";

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
        openFile(node);
    };
    controls.appendChild(viewModeSelect);

    const downloadBtn = document.createElement("button");
    downloadBtn.textContent = "Download JSON";
    downloadBtn.className = "editor-buttons success";
    downloadBtn.onclick = () => {
        const blob = new Blob([JSON.stringify(node.content, null, 4)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = node.name; a.click();
        URL.revokeObjectURL(url);
    };
    controls.appendChild(downloadBtn);
    header.appendChild(controls);

    mainArea.appendChild(header);

    const detailPane = document.createElement("div");
    detailPane.className = "editor-detail-pane";
    mainArea.appendChild(detailPane);

    if (viewMode === 'block') {
        createVirtualJsonViewer(detailPane, node.content);
    } else {
        initTreeEditor(detailPane, node.content, null, null, null, null, null, null, null, () => {
            updateUnsavedStatus(node);
        });
    }
}


export function getConfigRoot() {
    return configRoot;
}

export function addFolderToZip(zip, folderNode, currentPath = "") {
    const path = currentPath ? `${currentPath}/${folderNode.name}` : folderNode.name;
    
    folderNode.children.forEach(child => {
        if (child.type === "folder") {
            addFolderToZip(zip, child, path);
        } else {
            zip.file(`${path}/${child.name}`, JSON.stringify(child.content, null, 4));
        }
    });
}

export async function downloadConfigsAsZip() {
    if (configRoot.children.length === 0) {
        alert("No configs to download!");
        return;
    }

    const zip = new JSZip();
    addFolderToZip(zip, configRoot);

    const content = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(content);
    const a = document.createElement("a");
    a.href = url;
    a.download = "configs.zip";
    a.click();
    URL.revokeObjectURL(url);
}

export function setConfigRoot(newRoot) {
    configRoot = newRoot;
    renderFileTree();
}

export function clearConfigs() {
    configRoot = {
        name: "Custom",
        type: "folder",
        expanded: true,
        children: []
    };
    activeNode = null;
    unsavedConfigs.clear();
    savedSnapshots.clear();
    const mainArea = document.getElementById("config-main-area");
    if (mainArea) mainArea.innerHTML = "";
    renderFileTree();
}

export async function importConfigs(files) {
    for (const file of files) {
        const text = await file.text();
        try {
            const content = parseJSONC(text);
            const name = file.name;
            
            // Try to handle nested paths if provided by some browsers (webkitRelativePath)
            // or manually constructed paths (fullPath)
            const pathParts = file.fullPath ? file.fullPath.split('/') : (file.webkitRelativePath ? file.webkitRelativePath.split('/') : [name]);
            // If it starts with a folder name (like 'Custom/'), use it
            let current = configRoot;
            
            // Skip the first part if it's the root folder name itself or if we only have one part
            const startIdx = (pathParts.length > 1 && (pathParts[0].toLowerCase() === configRoot.name.toLowerCase() || pathParts[0].toLowerCase() === 'custom')) ? 1 : 0;
            
            for (let i = startIdx; i < pathParts.length - 1; i++) {
                const folderName = pathParts[i];
                let folder = current.children.find(c => c.type === "folder" && c.name === folderName);
                if (!folder) {
                    folder = {
                        name: folderName,
                        type: "folder",
                        parent: current,
                        expanded: true,
                        children: []
                    };
                    current.children.push(folder);
                }
                current = folder;
            }
            
            const fileName = pathParts[pathParts.length - 1];
            // Check if file already exists
            const existing = current.children.find(c => c.type === "file" && c.name === fileName);
            if (existing) {
                existing.content = content;
                updateUnsavedStatus(existing);
            } else {
                const newNode = {
                    name: fileName,
                    type: "file",
                    parent: current,
                    content: content
                };
                current.children.push(newNode);
                updateUnsavedStatus(newNode);
            }
        } catch (e) {
            console.error(`Failed to parse config ${file.name}`, e);
        }
    }
    renderFileTree();
}
