(() => {
  const config = window.BMRecipeConfig || {};
  const manifestPath = config.manifestPath || 'opskrifter/manifest.json';
  const grid = document.querySelector('[data-recipes-grid]');
  const loading = document.querySelector('[data-recipes-loading]');

  if (!grid) return;

  const renderCard = (recipe) => {
    const article = document.createElement('article');
    article.className = 'recipe-card';
    article.innerHTML = `
      <span class="category">${recipe.category ?? 'Opskrift'}</span>
      <h3>${recipe.accent ? `${recipe.accent} ${recipe.title}` : recipe.title}</h3>
      <p>${recipe.description ?? ''}</p>
      <a class="link" href="${recipe.url ?? '#'}">Se opskriften</a>
    `;
    return article;
  };

  const renderRecipes = (recipes) => {
    grid.innerHTML = '';
    if (!recipes.length) {
      const empty = document.createElement('p');
      empty.className = 'empty-state';
      empty.textContent = 'Opskrifterne kunne ikke indlæses lige nu.';
      grid.appendChild(empty);
      return;
    }
    recipes.forEach((recipe) => {
      grid.appendChild(renderCard(recipe));
    });
  };

  const load = async () => {
    if (loading) {
      loading.hidden = false;
    }
    try {
      const response = await fetch(manifestPath);
      if (!response.ok) throw new Error('Manifest kunne ikke indlæses');
      const data = await response.json();
      renderRecipes(data);
    } catch (error) {
      console.error('Opskrifterne kunne ikke hentes', error);
      renderRecipes([]);
    } finally {
      if (loading) {
        loading.hidden = true;
      }
    }
  };

  load();
})();
