export async function initChangelog() {
    try {
        const response = await fetch("./public/changelog.md");
        if (!response.ok) {
            throw new Error(`Failed to load changelog: ${response.status} ${response.statusText}`);
        }
        const markdown = await response.text();
        
        // Simple markdown parser
        const lines = markdown.split('\n');
        let html = '';
        let inList = false;

        for (let line of lines) {
            line = line.trim();
            
            if (line.startsWith('# ')) {
                if (inList) {
                    html += '</ul>';
                    inList = false;
                }
                html += `<h3>${line.substring(2)}</h3>`;
            } else if (line.startsWith('- ')) {
                if (!inList) {
                    html += '<ul>';
                    inList = true;
                }
                html += `<li>${line.substring(2)}</li>`;
            } else if (line === '') {
                if (inList) {
                    html += '</ul>';
                    inList = false;
                }
                // Don't add multiple <br> for empty lines
                if (!html.endsWith('<br>')) {
                    html += '<br>';
                }
            } else if (line.length > 0) {
                if (inList) {
                    html += '</ul>';
                    inList = false;
                }
                html += `<p>${line}</p>`;
            }
        }

        if (inList) {
            html += '</ul>';
        }

        document.getElementById("changelog-content").innerHTML = html;
    } catch (err) {
        console.error("Changelog error:", err);
    }
}