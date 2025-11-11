(() => {
  const params = new URLSearchParams(window.location.search);
  const slug = params.get('id');
  const config = window.BMRecipeConfig || {};
  const manifestPath = config.manifestPath || './manifest.json';

  const categoryEl = document.getElementById('recipe-category');
  const titleEl = document.getElementById('recipe-title');
  const subtitleEl = document.getElementById('recipe-subtitle');
  const introEl = document.getElementById('recipe-intro');
  const highlightsEl = document.getElementById('recipe-highlights');
  const metaEl = document.getElementById('recipe-meta');
  const contentEl = document.getElementById('recipe-content');

  const renderError = (message) => {
    contentEl.innerHTML = '';
    const error = document.createElement('div');
    error.className = 'recipe-error';
    error.innerHTML = `<p>${message}</p><p><a href="../index.html">Tilbage til forsiden</a></p>`;
    contentEl.appendChild(error);
  };

  const parseFrontMatter = (markdown) => {
    const frontMatterRegex = /^---\s*([\s\S]*?)\s*---\s*/;
    const match = markdown.match(frontMatterRegex);
    if (!match) {
      return { attributes: {}, body: markdown };
    }
    const jsonText = match[1];
    try {
      const attributes = JSON.parse(jsonText);
      const body = markdown.slice(match[0].length);
      return { attributes, body };
    } catch (error) {
      console.error('Kunne ikke parse metadata for opskrift', error);
      return { attributes: {}, body: markdown.slice(match[0].length) };
    }
  };

  const renderHighlights = (highlights = []) => {
    highlightsEl.innerHTML = '';
    if (!highlights.length) {
      highlightsEl.classList.add('is-empty');
      return;
    }
    highlightsEl.classList.remove('is-empty');
    highlights.forEach((item) => {
      const li = document.createElement('li');
      li.textContent = item;
      highlightsEl.appendChild(li);
    });
  };

  const renderMeta = (metaItems = []) => {
    metaEl.innerHTML = '';
    if (!metaItems.length) {
      metaEl.classList.add('is-empty');
      return;
    }
    metaEl.classList.remove('is-empty');
    metaItems.forEach((item) => {
      const dt = document.createElement('dt');
      dt.textContent = `${item.icon ?? ''} ${item.label ?? ''}`.trim();
      const dd = document.createElement('dd');
      dd.textContent = item.value ?? '';
      metaEl.appendChild(dt);
      metaEl.appendChild(dd);
    });
  };

  const postProcessContent = (container) => {
    const headings = container.querySelectorAll('h2, h3');
    headings.forEach((heading) => {
      heading.classList.add(heading.tagName === 'H2' ? 'recipe-section-title' : 'recipe-subtitle');
    });

    container.querySelectorAll('hr').forEach((divider) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'recipe-divider';
      divider.replaceWith(wrapper);
    });

    let currentSection = '';
    [...container.children].forEach((child) => {
      if (child.matches('h2.recipe-section-title')) {
        currentSection = child.textContent.toLowerCase();
      }
      if (child.tagName === 'UL' && currentSection.includes('ingrediens')) {
        child.classList.add('ingredients');
      }
      if (child.tagName === 'OL') {
        child.classList.add('steps');
      }
    });

    container.querySelectorAll('table').forEach((table) => {
      table.classList.add('recipe-table');
    });
  };

  const hydrateRecipe = (attributes, markdownBody) => {
    const {
      title = 'Opskrift',
      subtitle,
      description,
      category,
      heroEmoji,
      highlights,
      meta,
      intro
    } = attributes;

    document.title = `${title} · Brandsborgs Magtfulde Opskrifter`;
    titleEl.textContent = heroEmoji ? `${heroEmoji} ${title}` : title;
    categoryEl.textContent = category ?? 'Opskrift';
    subtitleEl.textContent = subtitle ?? title;
    introEl.textContent = intro ?? description ?? 'Her finder du detaljerne om opskriften.';
    renderHighlights(highlights);
    renderMeta(meta);

    const html = window.marked.parse(markdownBody.trim());
    contentEl.innerHTML = html;
    postProcessContent(contentEl);

    const recipeId = attributes.slug || slug;
    if (recipeId) {
      document.body.dataset.recipeId = recipeId;
      window.BMRecipeUtils?.initIngredients?.(recipeId);
    }
  };

  const fetchManifest = async () => {
    try {
      const response = await fetch(manifestPath);
      if (!response.ok) throw new Error('Manifest kunne ikke indlæses');
      return response.json();
    } catch (error) {
      console.warn('Kunne ikke hente manifest', error);
      return [];
    }
  };

  const syncFromManifest = async (slug, attributes) => {
    if (attributes.subtitle && attributes.category && attributes.description) {
      return attributes;
    }
    const manifest = await fetchManifest();
    const entry = manifest.find((item) => item.slug === slug);
    if (!entry) return attributes;
    return {
      category: entry.category ?? attributes.category,
      subtitle: entry.title ?? attributes.subtitle,
      description: entry.description ?? attributes.description,
      ...attributes
    };
  };

  const loadRecipe = async () => {
    if (!slug) {
      renderError('Der mangler et opskrifts-id i adressen.');
      return;
    }

    try {
      const response = await fetch(`${slug}.md`);
      if (!response.ok) {
        throw new Error('Opskriften blev ikke fundet.');
      }
      const markdown = await response.text();
      const { attributes, body } = parseFrontMatter(markdown);
      const enrichedAttributes = await syncFromManifest(slug, attributes);
      if (!enrichedAttributes.slug) {
        enrichedAttributes.slug = slug;
      }
      hydrateRecipe(enrichedAttributes, body);
    } catch (error) {
      console.error('Opskriften kunne ikke indlæses', error);
      renderError('Ups! Vi kunne ikke indlæse opskriften.');
    }
  };

  loadRecipe();
})();
