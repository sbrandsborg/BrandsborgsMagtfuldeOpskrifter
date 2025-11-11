(() => {
  const html = document.documentElement;
  const themeButton = document.querySelector('.theme-toggle');
  const toggleIcon = themeButton?.querySelector('.toggle-icon');
  const toggleLabel = themeButton?.querySelector('.toggle-label');
  const storageKey = 'bm-theme-mode';
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
  const modes = ['auto', 'light', 'dark'];

  let currentMode = localStorage.getItem(storageKey) || 'auto';

  const updateToggleVisuals = (mode, resolvedTheme) => {
    if (!toggleIcon || !toggleLabel) return;
    const iconMap = {
      auto: '🌗',
      light: '☀️',
      dark: '🌙'
    };
    const labelMap = {
      auto: 'Auto',
      light: 'Lyst',
      dark: 'Mørkt'
    };
    toggleIcon.textContent = iconMap[mode] ?? '🌗';
    toggleLabel.textContent = `Tema · ${labelMap[mode] ?? resolvedTheme}`;
    themeButton.setAttribute('aria-pressed', mode !== 'auto');
    themeButton.setAttribute('data-theme', resolvedTheme);
  };

  const resolveTheme = (mode) => {
    return mode === 'auto' ? (prefersDark.matches ? 'dark' : 'light') : mode;
  };

  const applyTheme = (mode) => {
    const resolvedTheme = resolveTheme(mode);
    html.setAttribute('data-theme', resolvedTheme);
    html.setAttribute('data-theme-mode', mode);
    if (mode === 'auto') {
      localStorage.removeItem(storageKey);
    } else {
      localStorage.setItem(storageKey, mode);
    }
    updateToggleVisuals(mode, resolvedTheme);
  };

  const cycleMode = () => {
    const currentIndex = modes.indexOf(currentMode);
    const nextMode = modes[(currentIndex + 1) % modes.length];
    currentMode = nextMode;
    applyTheme(currentMode);
  };

  applyTheme(currentMode);

  prefersDark.addEventListener('change', () => {
    if (currentMode === 'auto') {
      applyTheme('auto');
    }
  });

  themeButton?.addEventListener('click', cycleMode);

  // Ingredient toggles per opskriftsside
  const recipeId = document.body?.dataset?.recipeId;
  if (!recipeId) return;

  const ingredientLists = document.querySelectorAll('.ingredients');
  if (!ingredientLists.length) return;

  const listStorageKey = `bm-ingredients-${recipeId}`;

  const loadState = () => {
    try {
      const stored = localStorage.getItem(listStorageKey);
      if (!stored) return new Set();
      return new Set(JSON.parse(stored));
    } catch (error) {
      console.error('Kunne ikke læse ingrediensstatus', error);
      return new Set();
    }
  };

  const saveState = (set) => {
    try {
      localStorage.setItem(listStorageKey, JSON.stringify([...set]));
    } catch (error) {
      console.error('Kunne ikke gemme ingrediensstatus', error);
    }
  };

  const checked = loadState();

  ingredientLists.forEach((list) => {
    list.querySelectorAll('li').forEach((item, index) => {
      const key = `${index}-${item.textContent.trim()}`;
      item.dataset.key = key;
      item.setAttribute('role', 'checkbox');
      item.setAttribute('tabindex', '0');
      const isChecked = checked.has(key);
      item.classList.toggle('is-checked', isChecked);
      item.setAttribute('aria-checked', isChecked ? 'true' : 'false');
    });
  });

  const toggleItem = (item) => {
    const key = item.dataset.key;
    if (!key) return;
    const isChecked = item.classList.toggle('is-checked');
    item.setAttribute('aria-checked', isChecked ? 'true' : 'false');
    if (isChecked) {
      checked.add(key);
    } else {
      checked.delete(key);
    }
    saveState(checked);
  };

  const handleActivation = (event) => {
    const target = event.target.closest('li');
    if (!target || !event.currentTarget.contains(target)) return;
    if (event.type === 'keydown' && !['Enter', ' '].includes(event.key)) return;
    event.preventDefault();
    toggleItem(target);
  };

  ingredientLists.forEach((list) => {
    list.addEventListener('click', handleActivation);
    list.addEventListener('keydown', handleActivation);
  });
})();
