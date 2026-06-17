export function stripComments(json) {
    if (!json || json.length < 2) return json;
    if (!json.includes('//') && !json.includes('/*')) return json;
    
    // Fast path: if it's a huge string and we only see :// (common in URLs), skip
    if (json.length > 1000000 && !json.includes('// ') && !json.includes('\n//') && !json.includes('/*')) {
        // This is a heuristic: actual comments in GTFO datablocks usually have a space after //
        // or start at the beginning of a line. :// is almost always part of a URL or similar.
        // We still check for /* as it's less common inside strings.
        return json;
    }

    return json.replace(/("(?:[^"\\]|\\.)*")|(\/\/[^\n]*|\/\*[\s\S]*?\*\/)/g, (match, string, comment) => {
        if (string) return string;
        return "";
    });
}

export function parseJSONC(json) {
    return JSON.parse(stripComments(json));
}
