(() => {
  const params = new URLSearchParams(window.location.search);
  const slug = params.get('id');
  const config = window.BMRecipeConfig || {};
  const manifestPath = config.manifestPath || './manifest.json';
  const inlineManifest = Array.isArray(config.inlineManifest) ? config.inlineManifest : null;
  const isFileProtocol = window.location.protocol === 'file:';

  const categoryEl = document.getElementById('recipe-category');
  const titleEl = document.getElementById('recipe-title');
  const subtitleEl = document.getElementById('recipe-subtitle');
  const introEl = document.getElementById('recipe-intro');
  const highlightsEl = document.getElementById('recipe-highlights');
  const metaEl = document.getElementById('recipe-meta');
  const contentEl = document.getElementById('recipe-content');
  const keepAwakeButton = document.getElementById('keep-awake-toggle');

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

  const StepProgress = (() => {
    const PREFIX = 'bm-step-progress:';

    const load = (recipeId) => {
      if (!recipeId) return [];
      try {
        const stored = localStorage.getItem(`${PREFIX}${recipeId}`);
        if (!stored) return [];
        const parsed = JSON.parse(stored);
        return Array.isArray(parsed) ? parsed : [];
      } catch (error) {
        console.warn('Kunne ikke læse trinstatus', error);
        return [];
      }
    };

    const save = (recipeId, data) => {
      if (!recipeId) return;
      try {
        localStorage.setItem(`${PREFIX}${recipeId}`, JSON.stringify(data));
      } catch (error) {
        console.warn('Kunne ikke gemme trinstatus', error);
      }
    };

    return { load, save };
  })();

  const persistStepProgress = (recipeId, stepLists) => {
    if (!recipeId || !stepLists?.length) return;
    const state = stepLists.map((list) =>
      Array.from(list.querySelectorAll('.step-checkbox')).map((checkbox) => checkbox.checked)
    );
    StepProgress.save(recipeId, state);
  };

  const enhanceStepLists = (container, recipeId) => {
    const stepLists = Array.from(container.querySelectorAll('ol.steps'));
    if (!stepLists.length) return;

    const storedState = recipeId ? StepProgress.load(recipeId) : [];

    stepLists.forEach((listEl, listIndex) => {
      const savedSteps = Array.isArray(storedState?.[listIndex]) ? storedState[listIndex] : [];
      Array.from(listEl.children).forEach((item, itemIndex) => {
        if (!(item instanceof HTMLElement)) return;
        if (item.dataset.stepsEnhanced === 'true') return;

        item.dataset.stepsEnhanced = 'true';

        const nestedLists = [];
        let child = item.firstChild;
        while (child) {
          const next = child.nextSibling;
          if (child.nodeType === 1 && ['OL', 'UL'].includes(child.tagName)) {
            nestedLists.push(child);
            item.removeChild(child);
          }
          child = next;
        }

        const label = document.createElement('label');
        label.className = 'step-label';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'step-checkbox';

        const text = document.createElement('div');
        text.className = 'step-text';
        const fragment = document.createDocumentFragment();
        while (item.firstChild) {
          fragment.appendChild(item.firstChild);
        }
        text.appendChild(fragment);

        const isChecked = !!savedSteps[itemIndex];
        checkbox.checked = isChecked;
        item.classList.toggle('is-checked', isChecked);

        label.appendChild(checkbox);
        label.appendChild(text);
        item.appendChild(label);
        nestedLists.forEach((nested) => item.appendChild(nested));

        checkbox.addEventListener('change', () => {
          item.classList.toggle('is-checked', checkbox.checked);
          if (recipeId) {
            persistStepProgress(recipeId, stepLists);
          }
        });
      });
    });

    if (recipeId) {
      persistStepProgress(recipeId, stepLists);
    }
  };

  const postProcessContent = (container, recipeId) => {
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

    enhanceStepLists(container, recipeId);
  };

  const initWakeLockToggle = () => {
    if (!keepAwakeButton) return;

    const supported = 'wakeLock' in navigator;
    if (!supported) {
      keepAwakeButton.disabled = true;
      keepAwakeButton.setAttribute('aria-disabled', 'true');
      keepAwakeButton.textContent = 'Skærmlås ikke understøttet';
      return;
    }

    let wakeLockSentinel = null;
    let shouldHold = false;

    const updateButtonState = (isActive) => {
      keepAwakeButton.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      keepAwakeButton.classList.toggle('is-active', isActive);
      keepAwakeButton.textContent = isActive ? 'Skærmen holdes tændt' : 'Hold skærmen tændt';
    };

    updateButtonState(false);

    const requestWakeLock = async () => {
      try {
        wakeLockSentinel = await navigator.wakeLock.request('screen');
        wakeLockSentinel.addEventListener('release', handleRelease);
        updateButtonState(true);
      } catch (error) {
        console.warn('Kunne ikke aktivere skærmlås', error);
        shouldHold = false;
        updateButtonState(false);
      }
    };

    async function handleRelease() {
      wakeLockSentinel = null;
      if (shouldHold && document.visibilityState === 'visible') {
        requestWakeLock();
      } else {
        shouldHold = false;
        updateButtonState(false);
      }
    }

    const releaseWakeLock = async () => {
      if (!wakeLockSentinel) return;
      try {
        await wakeLockSentinel.release();
      } catch (error) {
        console.warn('Kunne ikke frigive skærmlås', error);
      }
    };

    keepAwakeButton.addEventListener('click', async () => {
      if (wakeLockSentinel) {
        shouldHold = false;
        await releaseWakeLock();
      } else {
        shouldHold = true;
        await requestWakeLock();
      }
    });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && shouldHold && !wakeLockSentinel) {
        requestWakeLock();
      }
    });
  };

  const escapeHtml = (value = '') =>
    value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  const renderMarkdown = (markdownBody = '') => {
    const trimmed = markdownBody.trim();
    if (window.marked?.parse) {
      return window.marked.parse(trimmed);
    }

    console.warn('Marked kunne ikke indlæses – viser opskriften som rå tekst.');
    return trimmed
      .split(/\n{2,}/)
      .map((block) => `<p>${escapeHtml(block).replace(/\n/g, '<br />')}</p>`)
      .join('');
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

    const recipeId = attributes.slug || slug;

    if (recipeId) {
      document.body.dataset.recipeId = recipeId;
    } else {
      delete document.body.dataset.recipeId;
    }

    document.title = `${title} · Brandsborgs Magtfulde Opskrifter`;
    titleEl.textContent = heroEmoji ? `${heroEmoji} ${title}` : title;
    categoryEl.textContent = category ?? 'Opskrift';
    subtitleEl.textContent = subtitle ?? title;
    introEl.textContent = intro ?? description ?? 'Her finder du detaljerne om opskriften.';
    renderHighlights(highlights);
    renderMeta(meta);

    const html = renderMarkdown(markdownBody);
    contentEl.innerHTML = html;
    contentEl.classList.remove('recipe-content--fallback');

    if (window.marked?.parse) {
      postProcessContent(contentEl, recipeId);
    } else {
      contentEl.classList.add('recipe-content--fallback');
    }

    if (recipeId) {
      window.BMRecipeUtils?.initIngredients?.(recipeId);
    }
  };

  const fetchManifest = async () => {
    if (isFileProtocol && inlineManifest?.length) {
      return inlineManifest;
    }
    try {
      const response = await fetch(manifestPath);
      if (!response.ok) throw new Error('Manifest kunne ikke indlæses');
      const data = await response.json();
      return Array.isArray(data) ? data : inlineManifest ?? [];
    } catch (error) {
      console.warn('Kunne ikke hente manifest', error);
      return inlineManifest ?? [];
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
      const message =
        isFileProtocol
          ? 'Ups! Vi kunne ikke indlæse opskriften direkte fra filsystemet. Åbn siden via en lokal server, f.eks. "python -m http.server".'
          : 'Ups! Vi kunne ikke indlæse opskriften.';
      renderError(message);
    }
  };

  initWakeLockToggle();
  loadRecipe();
})();
