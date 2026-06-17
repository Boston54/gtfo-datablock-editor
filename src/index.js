import {addNewDatablock, deleteCurrentDatablock, initDatablocks, importDatablocks, downloadAllAsZip, resetToVanilla, downloadProjectAsZip, getDatablockState, setDatablockState, markDatablocksSaved} from './datablocks.js';
import {initVanillaDatablocks} from './vanilla.js';
import {initGeomorphs} from './geomorphs.js';
import {initSounds} from './sounds.js';
import {initConfigs, clearConfigs, downloadConfigsAsZip, getConfigState, setConfigState, markConfigsSaved, importConfigs} from './configs.js';
import {saveToIndexedDB, loadFromIndexedDB, clearIndexedDB} from './persistence.js';
import {initChangelog} from "./changelog.js";

function tabsHelper(tabId, pageSelector, buttonSelector) {
    const targetPage = document.getElementById(tabId);
    if (!targetPage) return;

    document.querySelectorAll(pageSelector).forEach(page => {
        page.classList.remove('active');
    });
    targetPage.classList.add('active');

    // Update button states
    document.querySelectorAll(buttonSelector).forEach(btn => {
        const onClickAttr = btn.getAttribute('onclick');
        if (onClickAttr && onClickAttr.includes(`'${tabId}'`)) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

// Main Tabs

window.showTab = function(tabId) {
    tabsHelper(tabId, '.tab-page', '#main-tabs button');
}

// Editor Tab

window.newProject = function() {
    if (confirm("Are you sure you want to start a new project? This will clear all current unsaved changes.")) {
        resetToVanilla();
        clearConfigs();
        clearIndexedDB();
    }
}

window.openProject = async function() {
    if (!window.showDirectoryPicker) {
        document.getElementById('project-upload').click();
        return;
    }

    try {
        const directoryHandle = await window.showDirectoryPicker();
        
        if (!confirm("Opening a project will clear the currently opened project. It is recommended to first download a local copy of the project so it can be restored. Continue?")) {
            return;
        }

        resetToVanilla();
        clearConfigs();

        const datablockFiles = [];
        const configFiles = [];

        for await (const entry of directoryHandle.values()) {
            if (entry.kind === 'file' && entry.name.endsWith('.json')) {
                const file = await entry.getFile();
                datablockFiles.push(file);
            } else if (entry.kind === 'directory' && (entry.name.toLowerCase() === 'custom')) {
                await scanConfigFolder(entry, configFiles, entry.name);
            }
        }

        await finalizeProjectLoad(datablockFiles, configFiles);

    } catch (err) {
        if (err.name !== 'AbortError') {
            console.error(err);
            alert("Failed to open project: " + err.message);
        }
    }
};

async function finalizeProjectLoad(datablockFiles, configFiles) {
    if (datablockFiles.length > 0) {
        await importDatablocks(datablockFiles);
    }
    if (configFiles.length > 0) {
        await importConfigs(configFiles);
    }
    
    await markDatablocksSaved();
    markConfigsSaved();
}

document.getElementById('project-upload').addEventListener('change', async (event) => {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    if (!confirm("Opening a project will clear the currently opened project. It is recommended to first download a local copy of the project so it can be restored. Continue?")) {
        event.target.value = "";
        return;
    }

    resetToVanilla();
    clearConfigs();

    const datablockFiles = [];
    const configFiles = [];

    for (const file of files) {
        const pathParts = file.webkitRelativePath.split('/');
        // pathParts[0] is the root folder name
        if (pathParts.length === 2 && file.name.endsWith('.json')) {
            datablockFiles.push(file);
        } else {
            const customIdx = pathParts.findIndex(p => p.toLowerCase() === 'custom');
            if (customIdx === 1 && file.name.endsWith('.json')) {
                // We want the path starting from 'Custom/...'
                file.fullPath = pathParts.slice(customIdx).join('/');
                configFiles.push(file);
            }
        }
    }

    await finalizeProjectLoad(datablockFiles, configFiles);
    event.target.value = "";
});

async function scanConfigFolder(dirHandle, fileList, currentPath) {
    for await (const entry of dirHandle.values()) {
        if (entry.kind === 'file' && entry.name.endsWith('.json')) {
            const file = await entry.getFile();
            file.fullPath = currentPath + "/" + entry.name;
            fileList.push(file);
        } else if (entry.kind === 'directory') {
            await scanConfigFolder(entry, fileList, currentPath + "/" + entry.name);
        }
    }
}

window.uploadDatablocks = function() {
    document.getElementById('datablock-upload').click();
};

document.getElementById('datablock-upload').addEventListener('change', async (event) => {
    const files = event.target.files;
    if (files.length > 0) {
        await importDatablocks(files);
        event.target.value = "";
    }
});

window.uploadConfigs = function() {
    document.getElementById('config-upload').click();
};

document.getElementById('config-upload').addEventListener('change', async (event) => {
    const files = event.target.files;
    if (files.length > 0) {
        await importConfigs(files);
        event.target.value = "";
    }
});

window.showAddDatablockForm = function() {
    const form = document.getElementById("add-datablock-form");
    form.hidden = !form.hidden;
};

window.addDatablock = async function() {
    const filename = document.getElementById("datablock-select").value;
    const mode = document.getElementById("datablock-start-mode").value;
    await addNewDatablock(filename, mode === "vanilla");
    document.getElementById("add-datablock-form").hidden = true;
};

window.deleteDatablock = function() {
    deleteCurrentDatablock();
}

window.downloadAll = function() {
    downloadAllAsZip();
}

window.downloadConfigs = function() {
    downloadConfigsAsZip();
}

window.downloadProject = function() {
    downloadProjectAsZip();
}

window.saveProject = async function() {
    const state = {
        activeTab: document.querySelector('.tab-page.active')?.id || 'home',
        datablocks: await getDatablockState(),
        configs: getConfigState()
    };
    try {
        await saveToIndexedDB(state);
        await markDatablocksSaved();
        markConfigsSaved();
    } catch (err) {
        console.error(err);
        alert("Failed to save project. Download a local copy instead to avoid losing your changes: " + err.message);
    }
}

window.revertProject = async function() {
    if (confirm("Are you sure you want to revert your project to the last save? All unsaved changes will be lost.")) {
        try {
            const savedState = await loadFromIndexedDB();
            if (savedState) {
                console.log("Reverting to saved state...");
                if (savedState.datablocks) setDatablockState(savedState.datablocks);
                if (savedState.configs) setConfigState(savedState.configs);
                if (savedState.activeTab) window.showTab(savedState.activeTab);
                
                await markDatablocksSaved();
                markConfigsSaved();
            } else {
                alert("No saved state found to revert to.");
            }
        } catch (err) {
            console.error(err);
            alert("Failed to revert project: " + err.message);
        }
    }
}

// Main

async function main() {
    await Promise.all([
        initDatablocks(),
        initVanillaDatablocks(),
        initGeomorphs(),
        initSounds(),
        initConfigs(),
        initChangelog()
    ]);

    // Restore state if available
    try {
        const savedState = await loadFromIndexedDB();
        if (savedState) {
            console.log("Restoring saved state...");
            if (savedState.datablocks) setDatablockState(savedState.datablocks);
            if (savedState.configs) setConfigState(savedState.configs);
        }
    } catch (err) {
        console.warn("Failed to load saved state:", err);
    }
}

main();