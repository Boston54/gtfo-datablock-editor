export function initTreeEditor(container, data, schema, enums, datablockName, linkages, getDatablockData, definitions, defaults, onUpdate) {
    const state = {
        container,
        data,
        schema,
        enums,
        datablockName: datablockName ? datablockName.replace(".json", "") : null,
        linkages: linkages || {},
        getDatablockData,
        definitions: definitions || {},
        defaults: defaults || {},
        onUpdate,
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
    const currentSchemaNode = getSchemaNode(state.schema, path);
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
        const value = data ? data[key] : undefined;
        const currentPath = path ? `${path}.${key}` : key;
        const cleanPath = currentPath.split('.').filter(p => isNaN(p)).join('.');
        const schemaNode = getSchemaNode(state.schema, currentPath);
        
        const isActuallyArray = Array.isArray(value);
        const isSchemaList = schemaNode && schemaNode.type && schemaNode.type.startsWith("List<");

        const isCustom = !isDataArray && !schemaChildren[key];

        let nodeEl;
        if (isActuallyArray || isSchemaList || (typeof value === "object" && value !== null)) {
            nodeEl = renderBranch(key, value, currentPath, cleanPath, schemaNode, isActuallyArray, isSchemaList, isDataArray, data, state, blockDefs, isCustom);
        } else {
            nodeEl = renderLeaf(key, value, currentPath, cleanPath, schemaNode, isDataArray, data, state, blockDefs, isCustom);
        }

        if (path === "" && key === lastTopKey) {
            nodeEl.classList.add("root-field-separator");
        }
        container.appendChild(nodeEl);
    }

    if (data && typeof data === 'object') {
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
            if (!currentSchemaNode || (currentSchemaNode.type && !currentSchemaNode.type.startsWith("List<"))) {
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
                addBtn.title = "Add new entry";
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
    if (definition) header.title = definition;

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
                data[key] = isSchemaList ? [] : {};
                if (state.onUpdate) state.onUpdate(key, data[key], undefined);
            }
        }
        updateDetailPane(state);
    };

    if (isParentArray) {
        appendDeleteButton(header, data, key, state);
    } else if (isCustom) {
        appendDeleteButtonForObject(header, data, key, state);
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
    
    if (isCustom) {
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
    } else {
        const label = document.createElement("span");
        label.textContent = `${key}: `;
        const definition = blockDefs ? blockDefs[cleanPath] : null;
        if (definition) label.title = definition;
        nodeEl.appendChild(label);
    }

    const enumName = getEnumName(schemaNode);
    const isEnum = schemaNode && schemaNode.specialType === "enum";
    const isBoolean = typeof value === "boolean" || (schemaNode && schemaNode.type === "Boolean");

    let linkage = (state.linkages && state.datablockName && state.linkages[state.datablockName]) 
        ? state.linkages[state.datablockName][cleanPath] 
        : null;
    
    if (!linkage && state.linkages && state.linkages.Assumptions) {
        linkage = state.linkages.Assumptions[key];
    }

    if (linkage && state.getDatablockData) {
        renderLinkageSelect(nodeEl, data, key, value, linkage, state);
    } else if (isEnum && state.enums && state.enums[enumName]) {
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
    return nodeEl;
}

function appendDeleteButton(container, data, key, state) {
    const deleteBtn = document.createElement("button");
    deleteBtn.className = "delete-entry-button";
    deleteBtn.textContent = "✖";
    deleteBtn.title = "Delete this entry";
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
    deleteBtn.title = "Delete this custom entry";
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

    const targetData = state.getDatablockData(linkage.block);
    const select = document.createElement("select");
    
    const noneOption = document.createElement("option");
    noneOption.value = 0;
    noneOption.textContent = "None (0)";
    if (String(value) === "0" || value === undefined || value === null) noneOption.selected = true;
    select.appendChild(noneOption);

    let valueFound = (String(value) === "0" || value === undefined || value === null);

    if (targetData && targetData.Blocks) {
        targetData.Blocks.forEach(block => {
            const option = document.createElement("option");
            const targetVal = block[linkage.target];
            option.value = targetVal;
            const displayName = block[linkage.display] || "Unnamed";
            option.textContent = `${displayName} (${targetVal})`;
            if (String(value) === String(targetVal) && String(value) !== "0") {
                option.selected = true;
                valueFound = true;
            }
            select.appendChild(option);
        });
    }

    const customOption = document.createElement("option");
    customOption.value = "__custom__";
    customOption.textContent = "Custom...";
    if (!valueFound) customOption.selected = true;
    select.appendChild(customOption);

    const customInput = document.createElement("input");
    customInput.type = "text";
    customInput.className = "tree-input-custom";
    customInput.value = value !== undefined ? value : "";
    customInput.style.display = valueFound ? "none" : "inline-block";

    select.onchange = (e) => {
        if (e.target.value === "__custom__") {
            customInput.style.display = "inline-block";
        } else {
            customInput.style.display = "none";
            let val = e.target.value;
            if (!isNaN(val) && val !== "") val = parseFloat(val);
            const oldValue = data[key];
            data[key] = val;
            customInput.value = val;
            if (state.onUpdate) state.onUpdate(key, val, oldValue);
        }
    };

    customInput.onchange = (e) => {
        let val = e.target.value;
        if (!isNaN(val) && val !== "") val = parseFloat(val);
        const oldValue = data[key];
        data[key] = val;
        if (state.onUpdate) state.onUpdate(key, val, oldValue);
    };

    container.appendChild(select);
    container.appendChild(customInput);
}

function renderEnumSelect(container, data, key, value, schemaNode, state) {
    const enumName = getEnumName(schemaNode);
    const enumValues = state.enums[enumName];
    const select = document.createElement("select");
    
    let valueFound = false;
    if (enumValues) {
        enumValues.forEach(ev => {
            const option = document.createElement("option");
            option.value = ev.name;
            option.textContent = ev.name;
            if (String(value) === String(ev.name) || String(value) === String(ev.value)) {
                option.selected = true;
                valueFound = true;
            }
            select.appendChild(option);
        });
    }

    const customOption = document.createElement("option");
    customOption.value = "__custom__";
    customOption.textContent = "Custom...";
    if (!valueFound && value !== undefined && value !== null) customOption.selected = true;
    select.appendChild(customOption);

    const customInput = document.createElement("input");
    customInput.type = "text";
    customInput.className = "tree-input-custom";
    customInput.value = value !== undefined ? value : "";
    customInput.style.display = valueFound ? "none" : "inline-block";

    select.onchange = (e) => {
        if (e.target.value === "__custom__") {
            customInput.style.display = "inline-block";
        } else {
            customInput.style.display = "none";
            const oldValue = data[key];
            data[key] = e.target.value;
            customInput.value = e.target.value;
            if (state.onUpdate) state.onUpdate(key, e.target.value, oldValue);
        }
    };

    customInput.onchange = (e) => {
        const oldValue = data[key];
        data[key] = e.target.value;
        if (state.onUpdate) state.onUpdate(key, e.target.value, oldValue);
    };

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
    const input = document.createElement("input");
    input.value = value !== undefined ? value : "";
    input.oninput = (e) => {
        // Debounced update
        clearTimeout(input.timeout);
        input.timeout = setTimeout(() => {
            const oldValue = data[key];
            let newValue = e.target.value;
            // Basic type conversion
            if (typeof value === "number" || (schemaNode && ["Int32", "UInt32", "Single", "Double", "Int16", "UInt16", "Byte"].includes(schemaNode.type))) {
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
        randomBtn.title = "Randomize persistentID";
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
            if (current.type && current.type.startsWith("List<")) {
                const innerType = current.type.substring(5, current.type.length - 1);
                current = { ...current, type: innerType, children: getSchemaChildren({ type: innerType, children: current.children }) };
                if (current.specialType === "enum" && current.baseType && current.baseType.startsWith("List<")) {
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
    if (type.startsWith("List<")) return [];

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

    if (type.startsWith("List<")) {
        const innerType = type.substring(5, type.length - 1);
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

export function createVirtualJsonViewer(container, jsonObject) {
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