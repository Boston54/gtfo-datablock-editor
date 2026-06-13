let tooltipEl = null;

export function attachTooltip(el, text) {
    if (!text) return;
    
    // Remove native title if it exists to avoid double tooltips
    el.removeAttribute('title');

    el.addEventListener('mouseenter', (e) => {
        if (!tooltipEl) {
            tooltipEl = document.createElement('div');
            tooltipEl.className = 'custom-tooltip';
            document.body.appendChild(tooltipEl);
        }
        tooltipEl.textContent = text;
        tooltipEl.style.display = 'block';
        updateTooltipPosition(e);
    });

    el.addEventListener('mousemove', (e) => {
        updateTooltipPosition(e);
    });

    el.addEventListener('mouseleave', () => {
        if (tooltipEl) tooltipEl.style.display = 'none';
    });
}

function updateTooltipPosition(e) {
    if (!tooltipEl) return;
    const padding = 15;
    let x = e.clientX + padding;
    let y = e.clientY + padding;
    
    // Initial rect to get dimensions
    const rect = tooltipEl.getBoundingClientRect();
    
    // Boundary checks
    if (x + rect.width > window.innerWidth) {
        x = e.clientX - rect.width - padding;
    }
    if (y + rect.height > window.innerHeight) {
        y = e.clientY - rect.height - padding;
    }

    // Ensure it doesn't go off the top/left
    if (x < 0) x = 0;
    if (y < 0) y = 0;
    
    tooltipEl.style.left = x + 'px';
    tooltipEl.style.top = y + 'px';
}
