
import {parseJSONC} from './jsonc.js';

const schemaCache = new Map();

export async function loadSchema(datablockName) {
    if (schemaCache.has(datablockName)) return schemaCache.get(datablockName);

    const name = datablockName.replace(".json", "");
    try {
        const response = await fetch(`public/vanilla/datablocks/TypeList/GameData.${name}.txt`);
        if (!response.ok) return null;
        const text = await response.text();
        const blockFields = parseSchema(text);
        
        const schema = {
            Blocks: {
                name: "Blocks",
                type: `List<${name}>`,
                children: blockFields
            },
            Headers: {
                name: "Headers",
                type: "List<DataBlockHeader>",
                children: {
                    AboveBlockID: { name: "AboveBlockID", type: "UInt32" },
                    LabelText: { name: "LabelText", type: "String" }
                }
            },
            LastPersistentID: {
                name: "LastPersistentID",
                type: "UInt32"
            }
        };
        schemaCache.set(datablockName, schema);
        return schema;
    } catch (e) {
        console.error(`Failed to load schema for ${datablockName}`, e);
        return null;
    }
}

function parseSchema(text) {
    const lines = text.split("\n");
    const root = {};
    const stack = [{ indent: -1, node: root }];

    for (const line of lines) {
        if (!line.trim()) continue;

        const indent = line.search(/\S/);
        const content = line.trim();
        
        // Remove leading numbers if present (e.g. "9:(enum)")
        const cleanContent = content.replace(/^\d+:/, "");
        
        const lastColonIndex = cleanContent.lastIndexOf(": ");
        if (lastColonIndex === -1) continue;

        const typeInfo = cleanContent.substring(0, lastColonIndex).trim();
        const fieldName = cleanContent.substring(lastColonIndex + 2).trim();

        const node = {
            name: fieldName,
            type: typeInfo,
            children: {}
        };

        // Parse special types like (enum) or (BlockName)
        const specialTypeMatch = typeInfo.match(/\((.*?)\)\s*(.*)/);
        if (specialTypeMatch) {
            node.specialType = specialTypeMatch[1];
            node.baseType = specialTypeMatch[2] || null;
        }

        while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
            stack.pop();
        }

        if (stack[stack.length - 1]) {
            stack[stack.length - 1].node[fieldName] = node;
            stack.push({ indent, node: node.children });
        }
    }

    return root;
}

export async function loadEnums() {
    try {
        const response = await fetch("public/vanilla/datablocks/TypeList/Enums/Enums.json");
        if (!response.ok) return {};
        const text = await response.text();
        const enumFiles = parseJSONC(text);
        const enums = {};

        const promises = enumFiles.map(async (file) => {
            const enumName = file.replace(".txt", "");
            try {
                const res = await fetch(`public/vanilla/datablocks/TypeList/Enums/${file}`);
                if (res.ok) {
                    const text = await res.text();
                    enums[enumName] = parseEnum(text);
                }
            } catch (e) {
                console.error(`Failed to load enum ${file}`, e);
            }
        });

        await Promise.all(promises);
        return enums;
    } catch (e) {
        console.error("Failed to load enums list", e);
        return {};
    }
}

function parseEnum(text) {
    const lines = text.split("\n");
    const values = [];
    for (const line of lines) {
        if (!line.trim()) continue;
        const parts = line.split(" - ");
        if (parts.length === 2) {
            values.push({
                name: parts[0].trim(),
                value: parts[1].trim()
            });
        } else {
            // Some might not have " - value"
            values.push({
                name: line.trim(),
                value: line.trim()
            });
        }
    }
    return values;
}
