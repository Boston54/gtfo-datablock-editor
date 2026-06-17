import { parseJSONC } from './jsonc.js';
import { attachTooltip } from './tooltip.js';

const GEAR_COMP_ENUM = {
    1: "FireMode",
    2: "Category",
    3: "BaseItem",
    4: "ItemFPSSettings",
    5: "AudioSetting",
    6: "MuzzleFlash",
    7: "ShellCasing",
    12: "FrontPart",
    16: "ReceiverPart",
    19: "StockPart",
    21: "SightPart",
    23: "MagPart",
    25: "FlashlightPart",
    27: "ToolMainPart",
    30: "ToolGripPart",
    33: "ToolDeliveryPart",
    37: "ToolPayloadPart",
    40: "ToolTargetingPart",
    42: "ToolScreenPart",
    44: "MeleeHeadPart",
    46: "MeleeNeckPart",
    48: "MeleeHandlePart",
    50: "MeleePommelPart"
};

function indexToAlpha(index) {
    let res = "";
    while (index >= 0) {
        res = String.fromCharCode((index % 26) + 97) + res;
        index = Math.floor(index / 26) - 1;
    }
    return res;
}

function alphaToIndex(alpha) {
    let res = 0;
    for (let i = 0; i < alpha.length; i++) {
        res = res * 26 + (alpha.charCodeAt(i) - 96);
    }
    return res - 1;
}

const VIRTUAL_GEAR_JSON_SCHEMA = {
    "Ver": { type: "Int32" },
    "Name": { type: "String" },
    "Packet": {
        children: {
            "Comps": {
                children: {
                    "FireMode": { 
                        type: "Int32", 
                        specialType: "enum", 
                        enumValues: [
                            { name: "Semi", value: 0 },
                            { name: "Burst", value: 1 },
                            { name: "Auto", value: 2 },
                            { name: "SemiBurst", value: 3 }
                        ]
                    },
                    "Category": { type: "UInt32", linkage: "GearCategoryDataBlock" },
                    "BaseItem": { type: "UInt32", linkage: "ItemDataBlock" },
                    "ItemFPSSettings": { type: "UInt32", linkage: "ItemFPSSettingsDataBlock" },
                    "AudioSetting": { type: "UInt32", linkage: "WeaponAudioDataBlock" },
                    "MuzzleFlash": { type: "UInt32", linkage: "WeaponMuzzleFlashDataBlock" },
                    "ShellCasing": { type: "UInt32", linkage: "WeaponShellCasingDataBlock" },
                    "FrontPart": { type: "String", linkage: "GearFrontPartDataBlock"},
                    "ReceiverPart": { type: "String", linkage: "GearReceiverPartDataBlock" },
                    "StockPart": { type: "String", linkage: "GearStockPartDataBlock" },
                    "SightPart": { type: "String", linkage: "GearSightPartDataBlock" },
                    "MagPart": { type: "String", linkage: "GearMagPartDataBlock" },
                    "FlashlightPart": { type: "String", linkage: "GearFlashlightPartDataBlock" },
                    "ToolMainPart": { type: "String", linkage: "GearToolMainPartDataBlock" },
                    "ToolGripPart": { type: "String", linkage: "GearToolGripPartDataBlock" },
                    "ToolDeliveryPart": { type: "String", linkage: "GearToolDeliveryPartDataBlock" },
                    "ToolPayloadPart": { type: "String", linkage: "GearToolPayloadPartDataBlock" },
                    "ToolTargetingPart": { type: "String", linkage: "GearToolTargetingPartDataBlock" },
                    "ToolScreenPart": { type: "String", linkage:"GearToolScreenPartDataBlock" },
                    "MeleeHeadPart": { type: "String", linkage: "GearMeleeHeadPartDataBlock" },
                    "MeleeNeckPart": { type: "String", linkage: "GearMeleeNeckPartDataBlock" },
                    "MeleeHandlePart": { type: "String", linkage: "GearMeleeHandlePartDataBlock" },
                    "MeleePommelPart": { type: "String", linkage: "GearMeleePommelPartDataBlock" },
                }
            },
            "MatTrans": {
                children: {
                    "tDecalA": { children: { "scale": { type: "Single" } } },
                    "tDecalB": { children: { "scale": { type: "Single" } } },
                    "tPattern": { children: { "scale": { type: "Single" } } }
                }
            },
            "publicName": {
                children: {
                    "data": { type: "String" }
                }
            }
        }
    }
};

function getGearJsonSchemaNode(path) {
    const parts = path.split(".");
    // parts[0] is "GearJSON"
    let current = { children: VIRTUAL_GEAR_JSON_SCHEMA };
    for (let i = 1; i < parts.length; i++) {
        const part = parts[i];
        const children = current.children || {};
        if (children[part]) {
            current = children[part];
        } else {
            return null;
        }
    }
    return current;
}

function getEffectiveSchemaNode(state, path) {
    if (state.datablockName === "PlayerOfflineGearDataBlock" && (path === "GearJSON" || path.startsWith("GearJSON."))) {
        return getGearJsonSchemaNode(path);
    }
    return getSchemaNode(state.schema, path);
}

export function initTreeEditor(container, data, schema, options = {}) {
    const state = {
        container,
        data,
        schema,
        enums: options.enums,
        datablockName: options.datablockName ? options.datablockName.replace(".json", "") : null,
        linkages: options.linkages || {},
        getDatablockData: options.getDatablockData,
        definitions: options.definitions || {},
        defaults: options.defaults || {},
        onUpdate: options.onUpdate,
        readOnly: options.readOnly || false,
        expandedPaths: new Set()
    };
    updateDetailPane(state);
    return state;
}

export function updateDetailPane(state) {
    if (!state.container || !state.data) return;
    const scrollPos = state.container.scrollTop;
    state.container.innerHTML = "";
    renderTree(state.container, state.data, "", state);
    state.container.scrollTop = scrollPos;
}

export function renderTree(container, data, path = "", state) {
    const currentSchemaNode = getEffectiveSchemaNode(state, path);
    const schemaChildren = getSchemaChildren(currentSchemaNode);
    
    const dataKeys = (data && typeof data === 'object') ? Object.keys(data) : [];
    const isDataArray = Array.isArray(data);
    
    // For objects, show all keys from data and schema. For arrays, just show data indices.
    let keysArray = isDataArray ? dataKeys : Array.from(new Set([...Object.keys(schemaChildren), ...dataKeys]));

    let lastTopKey = null;
    if (path === "" && !isDataArray) {
        const topKeys = ["name", "persistentID"].filter(k => keysArray.includes(k));
        const rest = keysArray.filter(k => !topKeys.includes(k));
        keysArray = [...topKeys, ...rest];
        lastTopKey = topKeys.length > 0 ? topKeys[topKeys.length - 1] : null;
    }

    const blockDefs = state.definitions ? state.definitions[state.datablockName] : null;

    for (const key of keysArray) {
        let value = data ? data[key] : undefined;

        // Special case: PlayerOfflineGearDataBlock.GearJSON is a stringified JSON.
        // We want to edit it as an object in the tree view, but keep it as a string in the data.
        if (state.datablockName === "PlayerOfflineGearDataBlock" && key === "GearJSON") {
            if (typeof value === "string" && value.trim().startsWith("{")) {
                try {
                    const parsed = JSON.parse(value);
                    value = parsed;
                    data[key] = parsed;
                } catch (e) {
                    // Ignore parse errors, treat as regular string
                }
            }
            
            if (typeof value === "object" && value !== null) {
                // Transform Comps list from weird object {a: {c, v}, ...} to flat object {Category: 8, ...}
                if (value.Packet && value.Packet.Comps && typeof value.Packet.Comps === 'object' && !Array.isArray(value.Packet.Comps)) {
                    const compsObj = value.Packet.Comps;
                    
                    // Only transform if it's the original weird format.
                    // Our transformed object has a custom toJSON property.
                    if (!Object.prototype.hasOwnProperty.call(compsObj, "toJSON")) {
                        const flatComps = {};
                        
                        // Initialize with all possible keys from GEAR_COMP_ENUM as 0
                        for (const name of Object.values(GEAR_COMP_ENUM)) {
                            flatComps[name] = 0;
                        }

                        for (const k in compsObj) {
                            if (k === 'Length') continue;
                            const item = compsObj[k];
                            if (item && typeof item.c !== 'undefined') {
                                const name = GEAR_COMP_ENUM[item.c] || `Unknown_${item.c}`;
                                flatComps[name] = item.v;
                            }
                        }

                        value.Packet.Comps = flatComps;

                        Object.defineProperty(flatComps, "toJSON", {
                            value: function() {
                                const result = {};
                                let count = 0;
                                const sortedIds = Object.keys(GEAR_COMP_ENUM).map(Number).sort((a, b) => a - b);
                                for (const id of sortedIds) {
                                    const name = GEAR_COMP_ENUM[id];
                                    let v = this[name];
                                    // User said: "any empty values should be ignored"
                                    if (v !== 0 && v !== null && v !== undefined && v !== "") {
                                        if (typeof v === 'string' && !isNaN(v) && v !== "") {
                                            v = parseInt(v);
                                        }
                                        result[indexToAlpha(count++)] = { c: id, v: v };
                                    }
                                }
                                // Handle any keys that weren't in GEAR_COMP_ENUM but were in the data
                                for (const name in this) {
                                    if (name.startsWith("Unknown_")) {
                                        const id = parseInt(name.split("_")[1]);
                                        let v = this[name];
                                        if (v !== 0 && v !== null && v !== undefined && v !== "" && !isNaN(id)) {
                                            if (typeof v === 'string' && !isNaN(v) && v !== "") {
                                                v = parseInt(v);
                                            }
                                            result[indexToAlpha(count++)] = { c: id, v: v };
                                        }
                                    }
                                }
                                result.Length = count + 1;
                                return result;
                            },
                            configurable: true,
                            enumerable: false
                        });
                    }
                }

                if (!Object.prototype.hasOwnProperty.call(value, "toJSON")) {
                    Object.defineProperty(value, "toJSON", {
                        value: function() {
                            return JSON.stringify({ ...this });
                        },
                        configurable: true,
                        enumerable: false
                    });
                }
            }
        }

        const currentPath = path ? `${path}.${key}` : key;
        const cleanPath = currentPath.split('.').filter(p => isNaN(p)).join('.');
        const schemaNode = getEffectiveSchemaNode(state, currentPath);
        
        const isActuallyArray = Array.isArray(value);
        const isSchemaList = schemaNode && ((schemaNode.type && schemaNode.type.startsWith("List<")) || (schemaNode.baseType && schemaNode.baseType.startsWith("List<")));
        const isLocalizedText = schemaNode && schemaNode.type === "LocalizedText";

        const isCustom = !isDataArray && !schemaChildren[key];

        let nodeEl;
        if (!isLocalizedText && (isActuallyArray || isSchemaList || (typeof value === "object" && value !== null))) {
            nodeEl = renderBranch(key, value, currentPath, cleanPath, schemaNode, isActuallyArray, isSchemaList, isDataArray, data, state, blockDefs, isCustom);
        } else {
            nodeEl = renderLeaf(key, value, currentPath, cleanPath, schemaNode, isDataArray, data, state, blockDefs, isCustom);
        }

        if (path === "" && key === lastTopKey) {
            nodeEl.classList.add("root-field-separator");
        }
        container.appendChild(nodeEl);
    }

    if (data && typeof data === 'object' && !state.readOnly) {
        const addRow = document.createElement("div");
        addRow.className = "tree-add-custom-row";

        if (!isDataArray) {
            const addOBtn = document.createElement("button");
            addOBtn.className = "add-entry-button";
            addOBtn.textContent = "+ Add Object";
            addOBtn.onclick = () => addCustomField(data, state, {});
            addRow.appendChild(addOBtn);

            const addVBtn = document.createElement("button");
            addVBtn.className = "add-entry-button";
            addVBtn.textContent = "+ Add Value";
            addVBtn.style.marginLeft = "5px";
            addVBtn.onclick = () => addCustomField(data, state, "");
            addRow.appendChild(addVBtn);

            const addLBtn = document.createElement("button");
            addLBtn.className = "add-entry-button";
            addLBtn.textContent = "+ Add List";
            addLBtn.style.marginLeft = "5px";
            addLBtn.onclick = () => addCustomField(data, state, []);
            addRow.appendChild(addLBtn);

            container.appendChild(addRow);
        } else {
            const isList = currentSchemaNode && ((currentSchemaNode.type && currentSchemaNode.type.startsWith("List<")) || (currentSchemaNode.baseType && currentSchemaNode.baseType.startsWith("List<")));
            if (!currentSchemaNode || !isList) {
                const addOBtn = document.createElement("button");
                addOBtn.className = "add-entry-button";
                addOBtn.textContent = "+ Add Object";
                addOBtn.onclick = () => {
                    data.push({});
                    updateDetailPane(state);
                    const key = path.split('.').pop();
                    if (state.onUpdate) state.onUpdate(key, data, data);
                };
                addRow.appendChild(addOBtn);

                const addVBtn = document.createElement("button");
                addVBtn.className = "add-entry-button";
                addVBtn.textContent = "+ Add Value";
                addVBtn.style.marginLeft = "5px";
                addVBtn.onclick = () => {
                    data.push("");
                    updateDetailPane(state);
                    const key = path.split('.').pop();
                    if (state.onUpdate) state.onUpdate(key, data, data);
                };
                addRow.appendChild(addVBtn);

                const addLBtn = document.createElement("button");
                addLBtn.className = "add-entry-button";
                addLBtn.textContent = "+ Add List";
                addLBtn.style.marginLeft = "5px";
                addLBtn.onclick = () => {
                    data.push([]);
                    updateDetailPane(state);
                    const key = path.split('.').pop();
                    if (state.onUpdate) state.onUpdate(key, data, data);
                };
                addRow.appendChild(addLBtn);

            } else {
                const addBtn = document.createElement("button");
                addBtn.className = "add-entry-button";
                addBtn.textContent = "+";
                attachTooltip(addBtn, "Add new entry");
                addBtn.onclick = () => {
                    const newItem = createDefaultElement(currentSchemaNode, state, path, data);
                    data.push(newItem);
                    updateDetailPane(state);
                    const key = path.split('.').pop();
                    if (state.onUpdate) state.onUpdate(key, data, data);
                };
                addRow.appendChild(addBtn);
            }
            container.appendChild(addRow);
        }
    }
}

function addCustomField(data, state, defaultValue) {
    let newKey = "NewField";
    let counter = 1;
    while (data.hasOwnProperty(newKey)) {
        newKey = `NewField_${counter++}`;
    }
    data[newKey] = defaultValue;
    updateDetailPane(state);
    if (state.onUpdate) state.onUpdate(newKey, defaultValue, undefined);
}

const COMMON_TYPES = {
    "Color": {
        "r": { name: "r", type: "Single" },
        "g": { name: "g", type: "Single" },
        "b": { name: "b", type: "Single" },
        "a": { name: "a", type: "Single" }
    },
    "Vector3": {
        "x": { name: "x", type: "Single" },
        "y": { name: "y", type: "Single" },
        "z": { name: "z", type: "Single" }
    },
    "Vector2": {
        "x": { name: "x", type: "Single" },
        "y": { name: "y", type: "Single" }
    },
    "Quaternion": {
        "x": { name: "x", type: "Single" },
        "y": { name: "y", type: "Single" },
        "z": { name: "z", type: "Single" },
        "w": { name: "w", type: "Single" }
    }
};

function getEnumName(schemaNode) {
    if (!schemaNode) return null;
    let name = schemaNode.baseType || schemaNode.specialType;
    if (name && name.startsWith("List<")) {
        name = name.substring(5, name.length - 1);
    }
    return name;
}

function getSchemaChildren(schemaNode) {
    if (!schemaNode) return {};
    if (schemaNode.type === "LocalizedText") return {};
    let children = schemaNode.children ? schemaNode.children : {};
    if (schemaNode.type && COMMON_TYPES[schemaNode.type]) {
        return { ...children, ...COMMON_TYPES[schemaNode.type] };
    }
    return children;
}

function renderBranch(key, value, currentPath, cleanPath, schemaNode, isActuallyArray, isSchemaList, isParentArray, data, state, blockDefs, isCustom) {
    const nodeEl = document.createElement("div");
    const isExpanded = state.expandedPaths.has(currentPath);
    const header = document.createElement("div");
    header.className = "tree-header";
    
    if (isCustom) {
        const toggle = document.createElement("span");
        toggle.textContent = isExpanded ? "▼ " : "▶ ";
        header.appendChild(toggle);
        
        const keyInput = document.createElement("input");
        keyInput.className = "tree-input-key";
        keyInput.value = key;
        keyInput.onclick = (e) => e.stopPropagation();
        keyInput.onchange = (e) => {
            updateKeyName(data, key, e.target.value, state, currentPath);
        };
        header.appendChild(keyInput);
    } else {
        header.textContent = `${isExpanded ? "▼" : "▶"} ${key}`;
    }

    const definition = blockDefs ? blockDefs[cleanPath] : null;
    if (definition) attachTooltip(header, definition);

    if (schemaNode && schemaNode.type) {
        const typeHint = document.createElement("span");
        typeHint.className = "tree-type-hint";
        typeHint.textContent = ` (${schemaNode.type})`;
        header.appendChild(typeHint);
    }


    header.onclick = (e) => {
        e.stopPropagation();
        if (isExpanded) {
            state.expandedPaths.delete(currentPath);
        } else {
            state.expandedPaths.add(currentPath);
            if (data && data[key] === undefined) {
                if (state.readOnly) return;
                data[key] = isSchemaList ? [] : {};
                if (state.onUpdate) state.onUpdate(key, data[key], undefined);
            }
        }
        updateDetailPane(state);
    };

    if (!state.readOnly) {
        if (isParentArray) {
            appendDeleteButton(header, data, key, state);
        } else if (isCustom) {
            appendDeleteButtonForObject(header, data, key, state);
        }
    }
    nodeEl.appendChild(header);

    if (isExpanded) {
        const childrenContainer = document.createElement("div");
        childrenContainer.className = "tree-node";
        renderTree(childrenContainer, data ? data[key] : (isSchemaList ? [] : {}), currentPath, state);
        nodeEl.appendChild(childrenContainer);
    }
    return nodeEl;
}

function renderLeaf(key, value, currentPath, cleanPath, schemaNode, isParentArray, data, state, blockDefs, isCustom) {
    const nodeEl = document.createElement("div");
    nodeEl.className = "tree-leaf";

    const isBoolean = typeof value === "boolean" || (schemaNode && schemaNode.type === "Boolean");
    
    if (isCustom) {
        if (state.readOnly) {
            const label = document.createElement("span");
            label.textContent = `${key}: `;
            nodeEl.appendChild(label);
        } else {
            const keyInput = document.createElement("input");
            keyInput.className = "tree-input-key";
            keyInput.value = key;
            keyInput.onchange = (e) => {
                updateKeyName(data, key, e.target.value, state, currentPath);
            };
            nodeEl.appendChild(keyInput);
            const colon = document.createElement("span");
            colon.textContent = ": ";
            nodeEl.appendChild(colon);
        }
    } else {
        const label = document.createElement("span");
        label.textContent = `${key}: `;
        const definition = blockDefs ? blockDefs[cleanPath] : null;
        if (definition) attachTooltip(label, definition);
        nodeEl.appendChild(label);
    }

    if (state.readOnly) {
        const valueSpan = document.createElement("span");
        valueSpan.style.marginLeft = "8px";
        valueSpan.style.color = "#ce9178"; // String color
        
        if (isBoolean) {
            valueSpan.style.color = "#569cd6"; // Boolean/Keyword color
        } else if (typeof value === "number") {
            valueSpan.style.color = "#b5cea8"; // Number color
        }
        
        valueSpan.textContent = value === undefined ? "undefined" : JSON.stringify(value);
        nodeEl.appendChild(valueSpan);
    } else {
        const enumName = getEnumName(schemaNode);
        const isEnum = schemaNode && schemaNode.specialType === "enum";

        let linkage = schemaNode && schemaNode.linkage;
        if (!linkage) {
            linkage = (state.linkages && state.datablockName && state.linkages[state.datablockName]) 
                ? state.linkages[state.datablockName][cleanPath] 
                : null;
            
            if (!linkage && state.linkages && state.linkages.Assumptions) {
                linkage = state.linkages.Assumptions[key];
            }

            if (!linkage && schemaNode && schemaNode.specialType && schemaNode.specialType !== "enum") {
                if (schemaNode.specialType.endsWith("DataBlock")) {
                    linkage = schemaNode.specialType;
                }
            }
        }

        if (linkage && state.getDatablockData) {
            renderLinkageSelect(nodeEl, data, key, value, linkage, state);
        } else if (isEnum && (schemaNode.enumValues || (state.enums && state.enums[enumName]))) {
            renderEnumSelect(nodeEl, data, key, value, schemaNode, state);
        } else if (isBoolean) {
            renderBooleanSelect(nodeEl, data, key, value, state);
        } else {
            createDefaultInput(nodeEl, data, key, value, schemaNode, state);
        }

        if (isParentArray) {
            appendDeleteButton(nodeEl, data, key, state);
        } else if (isCustom) {
            appendDeleteButtonForObject(nodeEl, data, key, state);
        }
    }
    return nodeEl;
}

function appendDeleteButton(container, data, key, state) {
    const deleteBtn = document.createElement("button");
    deleteBtn.className = "delete-entry-button";
    deleteBtn.textContent = "✖";
    attachTooltip(deleteBtn, "Delete this entry");
    deleteBtn.onclick = (e) => {
        e.stopPropagation();
        if (confirm(`Are you sure you want to delete entry ${key}?`)) {
            data.splice(parseInt(key), 1);
            updateDetailPane(state);
            if (state.onUpdate) state.onUpdate(key, data, data);
        }
    };
    container.appendChild(deleteBtn);
}

function appendDeleteButtonForObject(container, data, key, state) {
    const deleteBtn = document.createElement("button");
    deleteBtn.className = "delete-entry-button";
    deleteBtn.textContent = "✖";
    attachTooltip(deleteBtn, "Delete this custom entry");
    deleteBtn.onclick = (e) => {
        e.stopPropagation();
        if (confirm(`Are you sure you want to delete custom entry "${key}"?`)) {
            const oldValue = data[key];
            delete data[key];
            updateDetailPane(state);
            if (state.onUpdate) state.onUpdate(key, undefined, oldValue);
        }
    };
    container.appendChild(deleteBtn);
}

function updateKeyName(data, oldKey, newKey, state, currentPath) {
    if (oldKey === newKey) return;
    if (!newKey) {
        alert("Key name cannot be empty.");
        updateDetailPane(state);
        return;
    }
    if (data.hasOwnProperty(newKey)) {
        alert(`Property "${newKey}" already exists.`);
        updateDetailPane(state);
        return;
    }

    const value = data[oldKey];
    
    // Maintain expanded state
    if (state.expandedPaths.has(currentPath)) {
        state.expandedPaths.delete(currentPath);
        const parts = currentPath.split('.');
        parts[parts.length - 1] = newKey;
        const newPath = parts.join('.');
        state.expandedPaths.add(newPath);
        
        // Also update children's paths in expandedPaths
        const oldPrefix = currentPath + ".";
        const newPrefix = newPath + ".";
        for (const path of Array.from(state.expandedPaths)) {
            if (path.startsWith(oldPrefix)) {
                state.expandedPaths.delete(path);
                state.expandedPaths.add(newPrefix + path.substring(oldPrefix.length));
            }
        }
    }

    const newData = {};
    for (const k in data) {
        if (k === oldKey) {
            newData[newKey] = value;
        } else {
            newData[k] = data[k];
        }
    }
    for (const k in data) delete data[k];
    Object.assign(data, newData);
    
    updateDetailPane(state);
    if (state.onUpdate) state.onUpdate(newKey, value, undefined);
}


function renderLinkageSelect(container, data, key, value, linkage, state) {
    if (typeof linkage === 'string') {
        linkage = { block: linkage, target: 'persistentID', display: 'name' };
    } else {
        linkage = { 
            block: linkage.block, 
            target: linkage.target || 'persistentID', 
            display: linkage.display || 'name' 
        };
    }

    let targetData = state.getDatablockData(linkage.block);
    
    // If target data is missing, try to ensure it's loaded
    if (!targetData && state.ensureDatablockLoaded) {
        // Add a temporary loading state
        const loadingSpan = document.createElement("span");
        loadingSpan.textContent = " Loading datablock...";
        loadingSpan.style.fontSize = "12px";
        loadingSpan.style.color = "#888";
        container.appendChild(loadingSpan);

        state.ensureDatablockLoaded(linkage.block).then(() => {
            updateDetailPane(state);
        });
        return; // Return early as we will re-render when loaded
    }

    const searchInput = document.createElement("input");
    searchInput.type = "text";
    searchInput.placeholder = "Search...";
    searchInput.className = "tree-select-search";
    
    const select = document.createElement("select");
    
    const customInput = document.createElement("input");
    customInput.type = "text";
    customInput.className = "tree-input-custom";
    customInput.value = (typeof value === 'string') ? escapeControlChars(value) : (value !== undefined && value !== null ? value : "");

    const populateOptions = (filter = "") => {
        select.innerHTML = "";
        const filterLower = filter.toLowerCase();
        let firstMatch = null;

        if (filter !== "" && ("none (0)".includes(filterLower) || "0".includes(filterLower))) {
            firstMatch = 0;
        }
        
        const noneOption = document.createElement("option");
        noneOption.value = 0;
        noneOption.textContent = "None (0)";
        if (String(value) === "0" || value === undefined || value === null) noneOption.selected = true;
        
        let valueFound = (String(value) === "0" || value === undefined || value === null);
        
        const matchingBlocks = [];
        const blocks = targetData ? (targetData.Blocks || targetData.blocks || (Array.isArray(targetData) ? targetData : null)) : null;

        if (blocks) {
            blocks.forEach(block => {
                const targetVal = block[linkage.target];
                let displayName = block[linkage.display];
                if (!displayName && linkage.block === "TextDataBlock") {
                    displayName = block.English;
                }
                if (!displayName) displayName = block.name || "Unnamed";

                const isSelected = String(value) === String(targetVal) && String(value) !== "0";
                
                if (isSelected) valueFound = true;

                const matches = filter !== "" && (
                    displayName.toLowerCase().includes(filterLower) || 
                    String(targetVal).toLowerCase().includes(filterLower) ||
                    (block.name && block.name.toLowerCase().includes(filterLower))
                );

                if (matches && firstMatch === null) firstMatch = targetVal;

                if (filter === "" || isSelected || matches) {
                    matchingBlocks.push({ targetVal, displayName, isSelected });
                }
            });
        }

        select.appendChild(noneOption);
        
        const MAX_OPTIONS = 500;
        let count = 0;
        for (const block of matchingBlocks) {
            if (count >= MAX_OPTIONS && !block.isSelected) continue;

            const option = document.createElement("option");
            option.value = block.targetVal;
            let display = block.displayName;
            if (display.length > 100) display = display.substring(0, 97) + "...";
            option.textContent = `${display} (${block.targetVal})`;
            if (block.isSelected) option.selected = true;
            select.appendChild(option);

            if (!block.isSelected) count++;
        }

        const customOption = document.createElement("option");
        customOption.value = "__custom__";
        customOption.textContent = "Custom...";
        if (!valueFound) customOption.selected = true;
        select.appendChild(customOption);
        
        customInput.style.display = valueFound ? "none" : "inline-block";
        return firstMatch;
    };

    populateOptions();

    searchInput.oninput = (e) => {
        const match = populateOptions(e.target.value);
        if (match !== null && String(match) !== String(value)) {
            const oldValue = value;
            value = match;
            data[key] = match;
            customInput.value = match;
            populateOptions(e.target.value);
            if (state.onUpdate) state.onUpdate(key, match, oldValue);
        }
    };

    select.onchange = (e) => {
        if (e.target.value === "__custom__") {
            customInput.style.display = "inline-block";
        } else {
            customInput.style.display = "none";
            let val = e.target.value;
            if (!isNaN(val) && val !== "") val = parseFloat(val);
            const oldValue = data[key];
            data[key] = val;
            customInput.value = (typeof val === 'string') ? escapeControlChars(val) : val;
            if (state.onUpdate) state.onUpdate(key, val, oldValue);
        }
    };

    customInput.onchange = (e) => {
        let val = e.target.value;
        if (!isNaN(val) && val !== "") val = parseFloat(val);
        const oldValue = data[key];
        
        if (typeof val === 'string') {
            val = unescapeControlChars(val);
        }
        
        data[key] = val;
        if (state.onUpdate) state.onUpdate(key, val, oldValue);
    };

    container.appendChild(searchInput);
    container.appendChild(select);
    container.appendChild(customInput);
}

function renderEnumSelect(container, data, key, value, schemaNode, state) {
    const enumName = getEnumName(schemaNode);
    const enumValues = schemaNode.enumValues || state.enums[enumName];
    const isNumeric = schemaNode && ["Int32", "UInt32", "Single", "Double", "Int16", "UInt16", "Byte"].includes(schemaNode.type);
    
    const searchInput = document.createElement("input");
    searchInput.type = "text";
    searchInput.placeholder = "Search...";
    searchInput.className = "tree-select-search";

    const select = document.createElement("select");
    
    const customInput = document.createElement("input");
    customInput.type = "text";
    customInput.className = "tree-input-custom";
    customInput.value = (typeof value === 'string') ? escapeControlChars(value) : (value !== undefined && value !== null ? value : "");

    const populateOptions = (filter = "") => {
        select.innerHTML = "";
        let valueFound = (value === undefined || value === null);
        const filterLower = filter.toLowerCase();
        let firstMatch = null;

        if (enumValues) {
            enumValues.forEach(ev => {
                const targetVal = isNumeric ? ev.value : ev.name;
                const isSelected = String(value) === String(ev.name) || String(value) === String(ev.value);
                if (isSelected) valueFound = true;

                const matches = filter !== "" && ev.name.toLowerCase().includes(filterLower);
                if (matches && firstMatch === null) firstMatch = targetVal;

                if (filter === "" || isSelected || matches) {
                    const option = document.createElement("option");
                    option.value = targetVal;
                    option.textContent = ev.name;
                    if (isSelected) option.selected = true;
                    select.appendChild(option);
                }
            });
        }

        const customOption = document.createElement("option");
        customOption.value = "__custom__";
        customOption.textContent = "Custom...";
        if (!valueFound && value !== undefined && value !== null) customOption.selected = true;
        select.appendChild(customOption);
        
        customInput.style.display = valueFound ? "none" : "inline-block";
        return firstMatch;
    };

    populateOptions();

    searchInput.oninput = (e) => {
        const match = populateOptions(e.target.value);
        if (match !== null && String(match) !== String(value)) {
            const oldValue = value;
            value = match;
            data[key] = match;
            customInput.value = match;
            populateOptions(e.target.value);
            if (state.onUpdate) state.onUpdate(key, match, oldValue);
        }
    };

    select.onchange = (e) => {
        if (e.target.value === "__custom__") {
            customInput.style.display = "inline-block";
        } else {
            customInput.style.display = "none";
            let val = e.target.value;
            if (isNumeric && !isNaN(val) && val !== "") val = parseFloat(val);
            const oldValue = data[key];
            data[key] = val;
            customInput.value = (typeof val === 'string') ? escapeControlChars(val) : val;
            if (state.onUpdate) state.onUpdate(key, val, oldValue);
        }
    };

    customInput.onchange = (e) => {
        const oldValue = data[key];
        let val = e.target.value;
        if (typeof val === 'string') {
            val = unescapeControlChars(val);
        }
        data[key] = val;
        if (state.onUpdate) state.onUpdate(key, val, oldValue);
    };

    container.appendChild(searchInput);
    container.appendChild(select);
    container.appendChild(customInput);
}

function renderBooleanSelect(container, data, key, value, state) {
    const select = document.createElement("select");
    [true, false].forEach(v => {
        const option = document.createElement("option");
        option.value = v;
        option.textContent = v;
        if (value === v) option.selected = true;
        select.appendChild(option);
    });
    select.onchange = (e) => {
        const oldValue = data[key];
        const val = e.target.value === "true";
        data[key] = val;
        if (state.onUpdate) state.onUpdate(key, val, oldValue);
    };
    container.appendChild(select);
}

function createDefaultInput(nodeEl, data, key, value, schemaNode, state) {
    const isString = typeof value === "string" || (schemaNode && (schemaNode.type === "String" || schemaNode.type === "LocalizedText"));
    const input = document.createElement("input");
    
    let displayValue = (value !== undefined && value !== null) ? value : "";
    if (isString && typeof displayValue === 'string') {
        displayValue = escapeControlChars(displayValue);
    }
    input.value = displayValue;

    input.oninput = (e) => {
        // Debounced update
        clearTimeout(input.timeout);
        input.timeout = setTimeout(() => {
            const oldValue = data[key];
            let newValue = e.target.value;
            
            if (isString) {
                newValue = unescapeControlChars(newValue);
            } else if (!isString && (typeof value === "number" || (schemaNode && ["Int32", "UInt32", "Single", "Double", "Int16", "UInt16", "Byte"].includes(schemaNode.type)))) {
                newValue = parseFloat(newValue);
            }
            
            data[key] = newValue;
            if (state.onUpdate) state.onUpdate(key, newValue, oldValue);
        }, 300);
    };
    nodeEl.appendChild(input);

    if (key === "persistentID") {
        const randomBtn = document.createElement("button");
        randomBtn.className = "randomize-button";
        randomBtn.textContent = "🎲";
        attachTooltip(randomBtn, "Randomize persistentID");
        randomBtn.onclick = () => {
            const oldValue = data[key];
            const newId = Math.floor(Math.random() * 1000000000);
            data[key] = newId;
            input.value = newId;
            if (state.onUpdate) state.onUpdate(key, newId, oldValue);
        };
        nodeEl.appendChild(randomBtn);
    }
}

function getSchemaNode(schema, path) {
    if (!schema) return null;
    const parts = path.split(".");
    let current = { children: schema };
    for (const part of parts) {
        if (!part) continue;
        // Handle array indices by staying at the same node but looking into its children for next parts
        if (/^\d+$/.test(part)) {
            const isList = (current.type && current.type.startsWith("List<")) || (current.baseType && current.baseType.startsWith("List<"));
            if (isList) {
                const typeStr = (current.baseType && current.baseType.startsWith("List<")) ? current.baseType : current.type;
                const innerType = typeStr.substring(5, typeStr.length - 1);
                current = { ...current, type: innerType, children: getSchemaChildren({ type: innerType, children: current.children }) };
                if (current.baseType && current.baseType.startsWith("List<")) {
                    current.baseType = current.baseType.substring(5, current.baseType.length - 1);
                }
            }
            continue;
        }
        const children = getSchemaChildren(current);
        if (children[part]) {
            current = children[part];
        } else {
            return null;
        }
    }
    return current;
}

export function createDefaultValue(schemaNode, state, path = "") {
    if (!schemaNode) return "";

    const type = schemaNode.type || "";
    const isList = type.startsWith("List<") || (schemaNode.baseType && schemaNode.baseType.startsWith("List<"));
    if (isList) return [];

    const children = getSchemaChildren(schemaNode);
    if (Object.keys(children).length > 0) {
        const obj = {};
        for (const [name, child] of Object.entries(children)) {
            obj[name] = createDefaultValue(child, state, path ? `${path}.${name}` : name);
        }
        return obj;
    }

    const blockDefaults = state.defaults ? state.defaults[state.datablockName] : null;
    if (blockDefaults && blockDefaults[path] !== undefined) return blockDefaults[path];

    if (path.endsWith("internalEnabled")) return true;

    if (type === "LocalizedText") return "";

    if (type === "Boolean") return false;
    if (["Int32", "UInt32", "Single", "Double", "Int16", "UInt16", "Byte"].includes(type)) return 0;

    if (schemaNode.specialType === "enum") {
        const enumName = getEnumName(schemaNode);
        const enums = state.enums?.[enumName];
        return enums?.length > 0 ? enums[0].name : "";
    }

    return "";
}

export function createDefaultElement(schemaNode, state, path = "", existingData = null) {
    if (!schemaNode) {
        if (Array.isArray(existingData) && existingData.length > 0) {
            const first = existingData[0];
            if (typeof first === 'object' && first !== null) return {};
            if (typeof first === 'number') return 0;
            if (typeof first === 'boolean') return false;
            return "";
        }
        return {};
    }
    const type = schemaNode.type || "";
    const isList = type.startsWith("List<") || (schemaNode.baseType && schemaNode.baseType.startsWith("List<"));

    if (isList) {
        const typeStr = (schemaNode.baseType && schemaNode.baseType.startsWith("List<")) ? schemaNode.baseType : type;
        const innerType = typeStr.substring(5, typeStr.length - 1);
        const children = getSchemaChildren({ type: innerType, children: schemaNode.children });
        if (Object.keys(children).length > 0) {
            const obj = {};
            for (const [name, child] of Object.entries(children)) {
                obj[name] = createDefaultValue(child, state, path ? `${path}.${name}` : name);
            }
            return obj;
        }

        if (innerType === "Boolean") return false;
        if (["Int32", "UInt32", "Single", "Double", "Int16", "UInt16", "Byte"].includes(innerType)) return 0;
        if (schemaNode.specialType === "enum") {
            const enumName = getEnumName(schemaNode);
            const enums = state.enums?.[enumName];
            return enums?.length > 0 ? enums[0].name : "";
        }
        return "";
    }
    return createDefaultValue(schemaNode, state, path);
}

export function createVirtualJsonViewer(container, jsonObject, options = {}) {
    const onUpdate = options.onUpdate;
    const currentJson = JSON.stringify(jsonObject, null, 2);

    if (onUpdate) {
        const wrapper = document.createElement("div");
        wrapper.classList.add("json-editor-container");
        
        const gutter = document.createElement("div");
        gutter.classList.add("json-editor-gutter");
        
        const textarea = document.createElement("textarea");
        textarea.classList.add("json-editor-textarea");
        textarea.spellcheck = false;
        
        wrapper.appendChild(gutter);
        wrapper.appendChild(textarea);
        
        textarea.value = currentJson;
        
        const updateGutter = () => {
            const lines = textarea.value.split("\n").length;
            const lineNumbers = [];
            for (let i = 1; i <= lines; i++) lineNumbers.push(i);
            gutter.textContent = lineNumbers.join("\n");
        };
        
        textarea.oninput = () => {
            updateGutter();
            clearTimeout(textarea.timeout);
            textarea.timeout = setTimeout(() => {
                const newValue = textarea.value;
                try {
                    const parsed = parseJSONC(newValue);
                    onUpdate(parsed, null);
                } catch (err) {
                    onUpdate(null, err.message);
                }
            }, 300);
        };
        
        textarea.onscroll = () => {
            gutter.scrollTop = textarea.scrollTop;
        };

        updateGutter();
        container.replaceChildren(wrapper);
        return;
    }

    container.replaceChildren();
    const lines = currentJson.split("\n");
    const lineHeight = 20;
    const bufferLines = 30;

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

function escapeControlChars(str) {
    if (typeof str !== 'string') return str;
    return str.replace(/\\/g, "\\\\")
              .replace(/\r/g, "\\r")
              .replace(/\n/g, "\\n")
              .replace(/\t/g, "\\t");
}

function unescapeControlChars(str) {
    if (typeof str !== 'string') return str;
    return str.replace(/\\(.)/g, (match, p1) => {
        if (p1 === 'r') return '\r';
        if (p1 === 'n') return '\n';
        if (p1 === 't') return '\t';
        if (p1 === '\\') return '\\';
        return match;
    });
}