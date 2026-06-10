import {parseJSONC} from './jsonc.js';

export async function initGeomorphs() {
    try {
        const response = await fetch('./public/vanilla/geomorphs/layout.json');
        if (!response.ok) throw new Error('Failed to load layout.json');
        const text = await response.text();
        const layout = parseJSONC(text);
        
        const rootTabs = document.getElementById('geomorph-tabs-root');
        const rootContent = document.getElementById('geomorph-content-root');
        
        if (rootTabs) rootTabs.innerHTML = '';
        if (rootContent) rootContent.innerHTML = '';

        if (rootTabs && rootContent) {
            buildLayout(layout, rootTabs, rootContent, 'geo');
        }
    } catch (error) {
        console.error('Error initializing geomorphs:', error);
    }
}

function buildLayout(data, tabsContainer, contentContainer, prefix) {
    let first = true;
    for (const key in data) {
        if (key === 'content' || key === 'complexId') continue;
        const value = data[key];
        const id = `${prefix}-${key.replace(/\s+/g, '-').toLowerCase()}`;
        
        // Create tab button
        const btn = document.createElement('button');
        btn.textContent = key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
        if (first) btn.className = 'active';
        
        // Create content page
        const page = document.createElement('div');
        page.id = id;
        page.className = 'geomorph-tab-page';
        if (first) page.classList.add('active');
        contentContainer.appendChild(page);

        const buildContent = () => {
            if (page.dataset.built) return;
            page.dataset.built = 'true';
            renderPageContent(value, page, id);
        };

        btn.onclick = () => {
            // Deactivate sibling buttons
            const siblingButtons = tabsContainer.querySelectorAll(':scope > button');
            siblingButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Deactivate sibling pages
            const siblingPages = contentContainer.querySelectorAll(':scope > .geomorph-tab-page');
            siblingPages.forEach(p => p.classList.remove('active'));
            
            page.classList.add('active');
            buildContent();
        };
        tabsContainer.appendChild(btn);
        
        if (first) {
            buildContent();
        }
        
        first = false;
    }
}

function renderPageContent(value, page, id) {
    // Add ComplexResourceData ID if it's a top-level complex
    if (id.startsWith('geo-') && value.complexId) {
        const idEl = document.createElement('div');
        idEl.className = 'geomorph-complex-id';
        idEl.textContent = `ComplexResourceData: ${value.complexId}`;
        page.appendChild(idEl);
    }

    // Add content if present
    if (value && typeof value === 'object' && value.content) {
        const contentEl = document.createElement('p');
        contentEl.className = 'geomorph-page-content';
        contentEl.textContent = value.content;
        page.appendChild(contentEl);
    }
    
    const subKeys = (value && typeof value === 'object' && !Array.isArray(value)) ? Object.keys(value).filter(k => k !== 'content' && k !== 'complexId') : [];
    
    if (Array.isArray(value)) {
        // Leaf node with geomorph list
        const leafContent = document.createElement('div');
        leafContent.className = 'geomorph-sub-content geomorph-leaf-content';
        page.appendChild(leafContent);

        value.forEach(geo => {
            const geoEl = document.createElement('div');
            geoEl.className = 'geomorph-entry';
            
            const geoTitle = document.createElement('h4');
            geoTitle.textContent = geo.name;
            geoEl.appendChild(geoTitle);

            if (geo.description) {
                const mainDesc = document.createElement('p');
                mainDesc.className = 'geomorph-description main-description';
                mainDesc.textContent = geo.description;
                geoEl.appendChild(mainDesc);
            }
            
            const variants = geo.variants || [];
            variants.forEach((variant, index) => {
                const variantEl = document.createElement('div');
                variantEl.className = 'geomorph-variant';
                if (index > 0) variantEl.classList.add('variant-separator');
                
                if (variant.images && variant.images.length > 0) {
                    const imgContainer = document.createElement('div');
                    imgContainer.className = 'geomorph-images';
                    variant.images.forEach(img => {
                        const imgEl = document.createElement('img');
                        imgEl.src = `./public/vanilla/geomorphs/images/${img}`;
                        imgEl.alt = geo.name;
                        imgContainer.appendChild(imgEl);
                    });
                    variantEl.appendChild(imgContainer);
                }
                
                if (variant.prefabs && variant.prefabs.length > 0) {
                    const prefabsEl = document.createElement('div');
                    prefabsEl.className = 'geomorph-prefabs';
                    variant.prefabs.forEach(prefab => {
                        const code = document.createElement('code');
                        code.textContent = prefab;
                        prefabsEl.appendChild(code);
                    });
                    variantEl.appendChild(prefabsEl);
                }
                
                if (variant.description) {
                    const descEl = document.createElement('p');
                    descEl.className = 'geomorph-description';
                    descEl.textContent = variant.description;
                    variantEl.appendChild(descEl);
                }
                
                geoEl.appendChild(variantEl);
            });
            
            leafContent.appendChild(geoEl);
        });
    } else if (subKeys.length > 0) {
        const subTabs = document.createElement('div');
        subTabs.className = 'sub-tabs';
        page.appendChild(subTabs);
        
        const subContent = document.createElement('div');
        subContent.className = 'geomorph-sub-content';
        page.appendChild(subContent);
        
        buildLayout(value, subTabs, subContent, id);
    } else {
        // Leaf node (empty or other)
        const leafContent = document.createElement('div');
        leafContent.className = 'geomorph-sub-content geomorph-leaf-content';
        page.appendChild(leafContent);

        const title = document.createElement('h3');
        title.textContent = id.split('-').pop().split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
        leafContent.appendChild(title);
        
        const placeholder = document.createElement('p');
        placeholder.textContent = `No geomorphs found for ${title.textContent}.`;
        leafContent.appendChild(placeholder);
    }
}
