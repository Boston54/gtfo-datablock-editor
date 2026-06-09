export function stripComments(json) {
    return json.replace(/("(?:[^"\\]|\\.)*")|(\/\/[^\n]*|\/\*[\s\S]*?\*\/)/g, (match, string, comment) => {
        if (string) return string;
        return "";
    });
}

export function parseJSONC(json) {
    return JSON.parse(stripComments(json));
}
