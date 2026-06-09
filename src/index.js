import {addNewDatablock, deleteCurrentDatablock, initDatablocks, importDatablocks, closeAllDatablocks, downloadAllAsZip} from './datablocks.js';
import {initGeomorphs} from './geomorphs.js';
import {initSounds} from './sounds.js';

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
    if (confirm("Are you sure you want to start a new project? This will close all open datablocks.")) {
        closeAllDatablocks();
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

// Geomorph Tabs

async function main() {
    await initDatablocks();
    await initGeomorphs();
    await initSounds();
}

main();