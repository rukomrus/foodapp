// === IndexedDB Setup ===
const DB_NAME = 'RecipeBaseDB';
const DB_VERSION = 2; // Увеличено для миграции
let db;

function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = function(event) {
            db = event.target.result;

            if (!db.objectStoreNames.contains('recipes')) {
                db.createObjectStore('recipes', { keyPath: 'name' });
            }
            if (!db.objectStoreNames.contains('ingredients')) {
                db.createObjectStore('ingredients', { keyPath: 'Ингредиент' });
            }
            if (!db.objectStoreNames.contains('categories')) {
                db.createObjectStore('categories', { keyPath: 'category' });
            }
            if (!db.objectStoreNames.contains('tags')) {
                db.createObjectStore('tags', { keyPath: 'tag' });
            }
        };

        request.onsuccess = function(event) {
            db = event.target.result;
            resolve();
        };

        request.onerror = function(event) {
            console.error('Ошибка открытия IndexedDB:', event.target.error);
            reject(event.target.error);
        };
    });
}

function saveToIndexedDB(storeName, data) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);

        const clearRequest = store.clear();
        clearRequest.onsuccess = () => {
            if (Array.isArray(data)) {
                data.forEach(item => store.put(item));
            } else if (typeof data === 'object' && data !== null) {
                store.put(data);
            }
            resolve();
        };

        clearRequest.onerror = () => {
            reject(clearRequest.error);
        };
    });
}

function loadFromIndexedDB(storeName) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.getAll();

        request.onsuccess = function(event) {
            resolve(event.target.result);
        };

        request.onerror = function(event) {
            reject(event.target.error);
        };
    });
}
// === Конец IndexedDB Setup ===

// === Остальной код приложения с интеграцией IndexedDB ===
let ingredientsData = [];
let allRecipes = [];
let categories = [];
let tags = ['Топ', 'Доработать', 'Любовь по жизни'];
let editingRecipeIndex = null;
let usedTagColors = new Set(); // Отслеживание использованных цветов
const categoryColors = [
    '#ffc107', '#28a745', '#17a2b8', '#fd7e14', '#6f42c1',
    '#e83e8c', '#20c997', '#6610f2', '#d63384', '#dc3545'
];

// Проверка загрузки библиотеки XLSX
function checkXLSXLoaded() {
    return new Promise((resolve, reject) => {
        const maxWaitTime = 10000; // 10 секунд
        const startTime = Date.now();
        function check() {
            if (typeof XLSX !== 'undefined') {
                resolve();
            } else if (Date.now() - startTime > maxWaitTime) {
                reject(new Error('Библиотека XLSX не загрузилась вовремя'));
            } else {
                setTimeout(check, 100);
            }
        }
        check();
    });
}

// Автоматическая загрузка файлов при старте
window.onload = async function () {
    const loadingMessage = document.getElementById('loadingMessage');

    try {
        await checkXLSXLoaded();

        // Подключаем IndexedDB
        await openDatabase();

        // Загружаем данные из IndexedDB
        let loadedIngredients = await loadFromIndexedDB('ingredients');
        let loadedRecipes = await loadFromIndexedDB('recipes');
        let loadedCategories = await loadFromIndexedDB('categories');
        let loadedTags = await loadFromIndexedDB('tags');

        // Если есть — используем их
        if (loadedIngredients.length > 0) ingredientsData = loadedIngredients;
        if (loadedRecipes.length > 0) allRecipes = loadedRecipes;
        if (loadedCategories.length > 0) categories = loadedCategories.map(c => c.category);
        if (loadedTags.length > 0) tags = loadedTags.map(t => t.tag);

        // Если нет — загружаем из Excel
        if (ingredientsData.length === 0) await loadIngredientsFile();
        if (allRecipes.length === 0) await loadRecipesFile();

        // Сохраняем всё в IndexedDB
        await saveToIndexedDB('ingredients', ingredientsData);
        await saveToIndexedDB('recipes', allRecipes);
        await saveToIndexedDB('categories', categories.map(category => ({ category })));
        await saveToIndexedDB('tags', tags.map(tag => ({ tag })));

        loadingMessage.style.display = 'none';

        updateCategoryFilter();
        updateTagFilter();
        updateEditCategorySelect();
        updateEditTagSelect();
        populateUnitSelect();

    } catch (error) {
        console.error('Ошибка при автоматической загрузке данных:', error);
        loadingMessage.textContent = `Ошибка загрузки данных: ${error.message}. Проверьте наличие файлов ingredients.xlsx и recipes.xlsx или подключение к сети.`;
        loadingMessage.style.color = '#dc3545'; // Красный цвет для ошибки
        document.querySelectorAll('button, input, select, textarea').forEach(el => el.disabled = false);
    }
};

// Загрузка ingredients.xlsx с тайм-аутом
async function loadIngredientsFile() {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // Тайм-аут 5 секунд
        const response = await fetch('ingredients.xlsx', { signal: controller.signal });
        clearTimeout(timeoutId);
        if (!response.ok) {
            throw new Error('Файл ingredients.xlsx не найден или недоступен');
        }
        const arrayBuffer = await response.arrayBuffer();
        const data = new Uint8Array(arrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        ingredientsData = XLSX.utils.sheet_to_json(worksheet);
        if (ingredientsData.length === 0) {
            console.warn('Файл ingredients.xlsx пуст или неверный формат');
        } else {
            console.log('Ингредиенты загружены автоматически:', ingredientsData.length, 'шт.');
        }
    } catch (error) {
        console.error('Ошибка при загрузке ingredients.xlsx:', error);
        throw error;
    }
}

// Загрузка recipes.xlsx с тайм-аутом
async function loadRecipesFile() {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // Тайм-аут 5 секунд
        const response = await fetch('recipes.xlsx', { signal: controller.signal });
        clearTimeout(timeoutId);
        if (!response.ok) {
            console.warn('Файл recipes.xlsx не найден, пропускаем...');
            return;
        }
        const arrayBuffer = await response.arrayBuffer();
        const data = new Uint8Array(arrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const loadedRecipes = XLSX.utils.sheet_to_json(worksheet);
        let currentRecipe = null;
        allRecipes = [];
        loadedRecipes.forEach(row => {
            if (row['Наименование'] || row['Категория'] || row['Инструкции'] || row['Ингредиент']) {
                if (row['Наименование']) {
                    currentRecipe = {
                        name: row['Наименование'] || 'Без названия',
                        category: row['Категория'] || 'Без категории',
                        tag: row['Метка'] || '',
                        ingredients: [],
                        instructions: row['Инструкции'] || ''
                    };
                    allRecipes.push(currentRecipe);
                    if (!categories.includes(row['Категория']) && row['Категория']) {
                        categories.push(row['Категория']);
                    }
                    if (row['Метка'] && !tags.includes(row['Метка'])) {
                        tags.push(row['Метка']);
                    }
                }
                if (row['Ингредиент'] && currentRecipe) {
                    currentRecipe.ingredients.push({
                        Ингредиент: row['Ингредиент'] || 'Не указан',
                        Количество: row['Количество'] || '',
                        Единица: row['Единица'] || 'Не указана'
                    });
                }
            }
        });
        updateCategorySelect();
        updateTagSelect();
        console.log('Рецепты загружены автоматически:', allRecipes.length, 'шт.');
    } catch (error) {
        console.error('Ошибка при загрузке recipes.xlsx:', error);
        throw error;
    }
}

// Обновление фильтров и выпадающих списков
function updateCategoryFilter() {
    const select = document.getElementById('recipeCategoryFilter');
    if (!select) return;
    select.innerHTML = '<option value="">Все категории</option>';
    categories.forEach(category => {
        select.innerHTML += `<option value="${category}">${category}</option>`;
    });
}

function updateTagFilter() {
    const select = document.getElementById('recipeTagFilter');
    if (!select) return;
    select.innerHTML = '<option value="">Все метки</option>';
    tags.sort().forEach(tag => {
        select.innerHTML += `<option value="${tag}">${tag}</option>`;
    });
}

function updateCategorySelect() {
    const select = document.getElementById('recipeCategory');
    if (!select) return;
    select.innerHTML = '<option value="">Все категории</option>';
    categories.forEach(category => {
        select.innerHTML += `<option value="${category}">${category}</option>`;
    });
}

function updateTagSelect() {
    const select = document.getElementById('recipeTag');
    if (!select) return;
    select.innerHTML = '<option value="">Без метки</option>';
    tags.sort().forEach(tag => {
        select.innerHTML += `<option value="${tag}">${tag}</option>`;
    });
}

function updateEditCategorySelect() {
    const select = document.getElementById('editRecipeCategory');
    if (!select) return;
    select.innerHTML = '<option value="">Без категории</option>';
    categories.forEach(category => {
        select.innerHTML += `<option value="${category}">${category}</option>`;
    });
}

function updateEditTagSelect() {
    const select = document.getElementById('editRecipeTag');
    if (!select) return;
    select.innerHTML = '<option value="">Без метки</option>';
    tags.sort().forEach(tag => {
        select.innerHTML += `<option value="${tag}">${tag}</option>`;
    });
}

// Инициализация выпадающего списка единиц измерения
function populateUnitSelect() {
    const unitSelect = document.getElementById('newIngredientUnit');
    if (!unitSelect) return;
    const units = [...new Set(ingredientsData.map(ing => ing['Единица измерения'] || 'шт'))];
    unitSelect.innerHTML = '<option value="">Выберите единицу</option>';
    units.forEach(unit => {
        unitSelect.innerHTML += `<option value="${unit}">${unit}</option>`;
    });
}

function addCategory() {
    try {
        const newCategoryInput = document.getElementById('newCategory');
        const newCategory = newCategoryInput.value.trim();
        if (!newCategory || categories.includes(newCategory)) return;
        categories.push(newCategory);
        updateCategorySelect();
        updateCategoryFilter();
        updateEditCategorySelect();
        newCategoryInput.value = '';
        alert(`Категория "${newCategory}" добавлена!`);
        const style = document.createElement('style');
        const safeCategoryClass = newCategory.toLowerCase().replace(/\s+/g, '-');
        const colorIndex = (categories.length - 1) % categoryColors.length;
        style.textContent = `.category-${safeCategoryClass} { background-color: ${categoryColors[colorIndex]}; }`;
        document.head.appendChild(style);
        updateRecipeList();
        // Сохраняем в IndexedDB
        saveToIndexedDB('categories', categories.map(category => ({ category })));
    } catch (error) {
        console.error('Ошибка при добавлении категории:', error);
        alert('Ошибка при добавлении категории: ' + error.message);
    }
}

function deleteCategory() {
    try {
        const category = document.getElementById('recipeCategory').value;
        if (!category || allRecipes.some(recipe => recipe.category === category)) return;
        if (confirm(`Удалить категорию "${category}"?`)) {
            categories = categories.filter(cat => cat !== category);
            updateCategorySelect();
            updateCategoryFilter();
            updateEditCategorySelect();
            alert(`Категория "${category}" удалена!`);
            updateRecipeList();
            // Сохраняем в IndexedDB
            saveToIndexedDB('categories', categories.map(category => ({ category })));
        }
    } catch (error) {
        console.error('Ошибка при удалении категории:', error);
        alert('Ошибка при удалении категории: ' + error.message);
    }
}

function addTag() {
    try {
        const newTagInput = document.getElementById('newTag');
        const newTag = newTagInput.value.trim();
        if (!newTag || tags.includes(newTag)) return;
        tags.push(newTag);
        updateTagSelect();
        updateTagFilter();
        updateEditTagSelect();
        newTagInput.value = '';
        alert(`Метка "${newTag}" добавлена!`);
        const style = document.createElement('style');
        const safeTagClass = newTag.toLowerCase().replace(/\s+/g, '-');
        let colorIndex;
        const availableColors = categoryColors.filter(color => !usedTagColors.has(color));
        if (availableColors.length > 0) {
            colorIndex = Math.floor(Math.random() * availableColors.length);
            colorIndex = categoryColors.indexOf(availableColors[colorIndex]);
        } else {
            usedTagColors.clear();
            colorIndex = Math.floor(Math.random() * categoryColors.length);
        }
        usedTagColors.add(categoryColors[colorIndex]);
        style.textContent = `.tag-${safeTagClass} { background-color: ${categoryColors[colorIndex]}; }`;
        document.head.appendChild(style);
        updateRecipeList();
        // Сохраняем в IndexedDB
        saveToIndexedDB('tags', tags.map(tag => ({ tag })));
    } catch (error) {
        console.error('Ошибка при добавлении метки:', error);
        alert('Ошибка при добавлении метки: ' + error.message);
    }
}

function deleteTag() {
    try {
        const tag = document.getElementById('recipeTag').value;
        if (!tag || allRecipes.some(recipe => recipe.tag === tag)) return;
        if (confirm(`Удалить метку "${tag}"?`)) {
            tags = tags.filter(t => t !== tag);
            const safeTagClass = tag.toLowerCase().replace(/\s+/g, '-');
            const existingStyle = [...document.querySelectorAll('style')].find(style =>
                style.textContent.includes(`.tag-${safeTagClass}`)
            );
            if (existingStyle) {
                const color = categoryColors.find(c => existingStyle.textContent.includes(c));
                if (color) usedTagColors.delete(color);
            }
            updateTagSelect();
            updateTagFilter();
            updateEditTagSelect();
            alert(`Метка "${tag}" удалена!`);
            updateRecipeList();
            // Сохраняем в IndexedDB
            saveToIndexedDB('tags', tags.map(tag => ({ tag })));
        }
    } catch (error) {
        console.error('Ошибка при удалении метки:', error);
        alert('Ошибка при удалении метки: ' + error.message);
    }
}

document.getElementById('searchRecipes').addEventListener('input', function () {
    try {
        updateRecipeList();
    } catch (error) {
        console.error('Ошибка при поиске:', error);
        alert('Ошибка при поиске: ' + error.message);
    }
});

function addIngredient() {
    try {
        if (ingredientsData.length === 0) {
            alert('Ингредиенты не загружены! Проверьте файл ingredients.xlsx.');
            return;
        }
        const container = document.getElementById('ingredientsList');
        const content = document.getElementById('addRecipeContent');
        if (!content.classList.contains('show')) {
            content.classList.add('show');
            document.querySelector('.collapsible-header').innerHTML = '<span>Добавить рецепт</span> <i class="fas fa-minus"></i>';
        }
        const div = document.createElement('div');
        div.className = 'ingredient';
        div.setAttribute('draggable', 'true');
        let ingredientSelect = `<select class="ingredient-select" onchange="toggleNewIngredient(this)">`;
        ingredientsData.sort((a, b) => a['Ингредиент'].localeCompare(b['Ингредиент'])).forEach(ing => {
            ingredientSelect += `<option value="${ing['Ингредиент']}">${ing['Ингредиент']}</option>`;
        });
        ingredientSelect += `<option value="new">Добавить новый ингредиент</option>`;
        ingredientSelect += '</select>';
        let unitSelect = `<select class="unit-select">`;
        const units = [...new Set(ingredientsData.map(ing => ing['Единица измерения']))];
        units.forEach(unit => {
            unitSelect += `<option value="${unit}">${unit}</option>`;
        });
        unitSelect += '</select>';
        div.innerHTML = `
            <i class="fas fa-grip-vertical drag-handle"></i>
            <div class="ingredient-content">
                ${ingredientSelect}
                <input type="text" class="quantity" placeholder="Количество (например, 1-2 или 1 ложка)" value="">
                ${unitSelect}
                <button onclick="this.parentElement.parentElement.remove();"><i class="fas fa-trash"></i> Удалить</button>
            </div>
        `;
        container.appendChild(div);
        div.addEventListener('dragstart', handleDragStart);
        div.addEventListener('dragover', handleDragOver);
        div.addEventListener('drop', handleDrop);
        div.addEventListener('dragend', handleDragEnd);
        console.log('Ингредиент добавлен');
    } catch (error) {
        console.error('Ошибка при добавлении ингредиента:', error);
        alert('Ошибка при добавлении ингредиента: ' + error.message);
    }
}

function toggleNewIngredient(select) {
    const newIngredientSection = document.getElementById('newIngredientSection');
    const parentIngredient = select.closest('.ingredient');
    if (select.value === 'new') {
        newIngredientSection.classList.add('show');
        parentIngredient.querySelector('.quantity').disabled = true;
        parentIngredient.querySelector('.unit-select').disabled = true;
    } else {
        newIngredientSection.classList.remove('show');
        parentIngredient.querySelector('.quantity').disabled = false;
        parentIngredient.querySelector('.unit-select').disabled = false;
    }
}

function saveNewIngredient() {
    try {
        const newIngredientName = document.getElementById('newIngredientName').value.trim();
        const newIngredientUnit = document.getElementById('newIngredientUnit').value;
        if (!newIngredientName || !newIngredientUnit) {
            alert('Введите название ингредиента и выберите единицу измерения!');
            return;
        }
        if (ingredientsData.some(ing => ing['Ингредиент'].toLowerCase() === newIngredientName.toLowerCase())) {
            alert('Такой ингредиент уже существует!');
            return;
        }
        const lastIngredient = document.querySelector('#ingredientsList .ingredient:last-child');
        if (lastIngredient) {
            const select = lastIngredient.querySelector('.ingredient-select');
            select.value = newIngredientName;
            lastIngredient.querySelector('.quantity').value = '';
            lastIngredient.querySelector('.quantity').disabled = false;
            lastIngredient.querySelector('.unit-select').value = newIngredientUnit;
            lastIngredient.querySelector('.unit-select').disabled = false;
        }
        if (confirm(`Добавить "${newIngredientName}" в общий список ингредиентов?`)) {
            ingredientsData.push({ 'Ингредиент': newIngredientName, 'Единица измерения': newIngredientUnit });
            alert(`Ингредиент "${newIngredientName}" добавлен в общий список!`);
        }
        document.getElementById('newIngredientName').value = '';
        document.getElementById('newIngredientUnit').value = '';
        document.getElementById('newIngredientSection').classList.remove('show');
        // Сохраняем в IndexedDB
        saveToIndexedDB('ingredients', ingredientsData);
    } catch (error) {
        console.error('Ошибка при сохранении нового ингредиента:', error);
        alert('Ошибка при сохранении нового ингредиента: ' + error.message);
    }
}

let draggedItem = null;

function handleDragStart(e) {
    draggedItem = this;
    setTimeout(() => this.classList.add('dragging'), 0);
    e.dataTransfer.effectAllowed = 'move';
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
}

function handleDrop(e) {
    e.preventDefault();
    if (draggedItem !== this) {
        const container = draggedItem.closest('#ingredientsList') || draggedItem.closest('#editIngredientsList');
        const draggedIndex = [...container.querySelectorAll('.ingredient')].indexOf(draggedItem);
        const targetIndex = [...container.querySelectorAll('.ingredient:not(.dragging)')].indexOf(this);
        if (draggedIndex < targetIndex) {
            this.parentNode.insertBefore(draggedItem, this.nextSibling);
        } else {
            this.parentNode.insertBefore(draggedItem, this);
        }
    }
}

function handleDragEnd() {
    this.classList.remove('dragging');
    draggedItem = null;
}

function saveRecipe() {
    try {
        const recipeName = document.getElementById('recipeName').value.trim();
        const recipeCategory = document.getElementById('recipeCategory').value || 'Без категории';
        const recipeTag = document.getElementById('recipeTag').value || '';
        const recipeInstructions = document.getElementById('recipeInstructions').value.trim();
        if (!recipeName || allRecipes.some(recipe => recipe.name.toLowerCase() === recipeName.toLowerCase())) {
            alert(!recipeName ? 'Введите название рецепта!' : `Рецепт с названием "${recipeName}" уже существует!`);
            return;
        }
        const ingredients = [];
        let hasInvalidIngredient = false;
        document.querySelectorAll('#ingredientsList .ingredient').forEach(ingDiv => {
            const select = ingDiv.querySelector('.ingredient-select');
            const ingredient = select.value;
            const quantity = ingDiv.querySelector('.quantity').value.trim();
            const unit = ingDiv.querySelector('.unit-select').value;
            if (ingredient === 'new') {
                alert('Сначала сохраните новый ингредиент!');
                hasInvalidIngredient = true;
                return;
            }
            if (ingredient && quantity && unit) {
                const quantityValue = quantity.replace(/[^0-9-]/g, '');
                if (!quantityValue && quantity !== '') {
                    alert(`Количество для ингредиента "${ingredient}" должно содержать хотя бы одну цифру или диапазон (например, 1-2)!`);
                    hasInvalidIngredient = true;
                    return;
                }
                ingredients.push({ Ингредиент: ingredient, Количество: quantity, Единица: unit });
            } else {
                alert(`Заполните все поля для ингредиента "${ingredient || 'не указан'}"!`);
                hasInvalidIngredient = true;
                return;
            }
        });
        if (hasInvalidIngredient || ingredients.length === 0) {
            if (ingredients.length === 0) alert('Добавьте хотя бы один ингредиент!');
            return;
        }
        allRecipes.push({ name: recipeName, category: recipeCategory, tag: recipeTag, ingredients, instructions: recipeInstructions });
        alert(`Рецепт "${recipeName}" добавлен в базу!`);
        document.getElementById('recipeName').value = '';
        document.getElementById('recipeCategory').value = '';
        document.getElementById('recipeTag').value = '';
        document.getElementById('recipeInstructions').value = '';
        document.getElementById('ingredientsList').innerHTML = '';
        document.getElementById('addRecipeContent').classList.remove('show');
        document.querySelector('.collapsible-header').innerHTML = '<span>Добавить рецепт</span> <i class="fas fa-plus"></i>';
        updateRecipeList();
        // Сохраняем в IndexedDB
        saveToIndexedDB('recipes', allRecipes);
    } catch (error) {
        console.error('Ошибка при сохранении рецепта:', error);
        alert('Ошибка при сохранении: ' + error.message);
    }
}

function saveRecipesToExcel() {
    try {
        const data = [];
        categories.forEach(category => {
            data.push({ Наименование: '', Категория: category, Метка: '', Ингредиент: '', Количество: '', Единица: '', Инструкции: '' });
        });
        allRecipes.forEach(recipe => {
            const firstRow = { Наименование: recipe.name, Категория: recipe.category, Метка: recipe.tag, Инструкции: recipe.instructions };
            data.push(firstRow);
            recipe.ingredients.forEach(ing => {
                data.push({ Наименование: '', Категория: '', Метка: '', Ингредиент: ing.Ингредиент, Количество: ing.Количество, Единица: ing.Единица, Инструкции: '' });
            });
        });
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Recipes');
        XLSX.writeFile(wb, 'recipes.xlsx');
    } catch (error) {
        console.error('Ошибка при сохранении рецептов в Excel:', error);
        alert('Ошибка при сохранении в Excel: ' + error.message);
    }
}

function showRecipes(searchTerm = '', categoryFilter = '', tagFilter = '') {
    try {
        const container = document.getElementById('recipesList');
        container.innerHTML = `<p>Найдено: ${allRecipes.length} рецептов</p>`;
        const indexedRecipes = allRecipes.map((recipe, originalIndex) => ({
            recipe,
            originalIndex
        }));
        const filteredRecipes = indexedRecipes.filter(({ recipe }) => {
            const matchesSearch = !searchTerm || (recipe.name && recipe.name.toLowerCase().includes(searchTerm));
            const matchesCategory = !categoryFilter || (recipe.category === categoryFilter);
            const matchesTag = !tagFilter || (recipe.tag === tagFilter);
            return matchesSearch && matchesCategory && matchesTag;
        });
        if (filteredRecipes.length === 0) {
            container.innerHTML = '<p>Рецепты не найдены.</p>';
            return;
        }
        const sortOption = document.getElementById('sortRecipes').value;
        filteredRecipes.sort((a, b) => {
            if (sortOption === 'name-asc') return (a.recipe.name || '').localeCompare(b.recipe.name || '');
            if (sortOption === 'name-desc') return (b.recipe.name || '').localeCompare(a.recipe.name || '');
            if (sortOption === 'category-asc') return (a.recipe.category || '').localeCompare(b.recipe.category || '');
            if (sortOption === 'category-desc') return (b.recipe.category || '').localeCompare(a.recipe.category || '');
        });
        container.innerHTML = `<p>Найдено: ${filteredRecipes.length} рецептов</p>`;
        filteredRecipes.forEach(({ recipe, originalIndex }, displayIndex) => {
            const div = document.createElement('div');
            div.className = 'recipe';
            div.setAttribute('data-index', originalIndex);
            const titleContainer = document.createElement('div');
            titleContainer.className = 'recipe-title-container';
            const deleteIcon = document.createElement('i');
            deleteIcon.className = 'fas fa-trash delete-icon';
            deleteIcon.onclick = (e) => { e.stopPropagation(); deleteRecipe(recipe.name); };
            const title = document.createElement('h3');
            title.innerHTML = `${recipe.name || 'Без названия'}`;
            title.onclick = () => toggleDetails(displayIndex);
            titleContainer.appendChild(deleteIcon);
            titleContainer.appendChild(title);
            const editBtn = document.createElement('button');
            editBtn.className = 'edit-btn';
            editBtn.innerHTML = '<i class="fas fa-edit"></i> Редактировать';
            editBtn.onclick = (e) => { e.stopPropagation(); editRecipe(originalIndex); };
            const tagContainer = document.createElement('div');
            tagContainer.className = 'tag-container';
            if (recipe.tag) {
                const tagSpan = document.createElement('span');
                const safeTagClass = recipe.tag.toLowerCase().replace(/\s+/g, '-');
                tagSpan.className = `tag tag-${safeTagClass}`;
                tagSpan.textContent = recipe.tag;
                tagContainer.appendChild(tagSpan);
            }
            const selectContainer = document.createElement('div');
            selectContainer.className = 'select-container';
            const categorySelect = document.createElement('select');
            categorySelect.className = 'category-select';
            categorySelect.innerHTML = '<option value="">Без категории</option>';
            categories.forEach(cat => {
                const option = document.createElement('option');
                option.value = cat;
                option.text = cat;
                if (recipe.category === cat) option.selected = true;
                categorySelect.appendChild(option);
            });
            categorySelect.onchange = () => {
                recipe.category = categorySelect.value || 'Без категории';
                updateRecipeList();
                saveToIndexedDB('recipes', allRecipes);
            };
            selectContainer.appendChild(categorySelect);
            const tagSelect = document.createElement('select');
            tagSelect.className = 'tag-select';
            const tagOptions = ['', ...tags.sort()];
            tagSelect.innerHTML = tagOptions.map(tag => `<option value="${tag}" ${recipe.tag === tag ? 'selected' : ''}>${tag || 'Без метки'}</option>`).join('');
            tagSelect.onchange = () => {
                recipe.tag = tagSelect.value;
                updateRecipeList();
                saveToIndexedDB('recipes', allRecipes);
            };
            selectContainer.appendChild(tagSelect);
            div.appendChild(titleContainer);
            div.appendChild(editBtn);
            div.appendChild(tagContainer);
            div.appendChild(selectContainer);
            const details = document.createElement('div');
            details.className = 'recipe-details';
            details.id = `recipe-details-${displayIndex}`;
            (recipe.ingredients || []).forEach(ing => {
                details.innerHTML += `<p>${ing.Ингредиент || 'Не указан'}: ${ing.Количество || ''} ${ing.Единица || 'Не указана'}</p>`;
            });
            if (recipe.instructions) {
                const instructionsBlock = document.createElement('div');
                instructionsBlock.className = 'instructions-block';
                const steps = recipe.instructions.split('\n').reduce((acc, line) => {
                    const stepMatch = line.match(/^(\d+)\.\s(.+)/);
                    if (stepMatch) {
                        acc.push({ number: stepMatch[1], text: stepMatch[2].trim(), isStep: true });
                    } else if (line.trim()) {
                        acc.push({ text: line.trim(), isStep: false });
                    }
                    return acc;
                }, []);
                if (steps.length > 0) {
                    const stepElements = [];
                    let hasSteps = false;
                    steps.forEach((item, index) => {
                        if (item.isStep) {
                            hasSteps = true;
                            stepElements.push(`<li>${item.text}</li>`);
                        } else {
                            stepElements.push(`<p>${item.text}</p>`);
                        }
                    });
                    if (hasSteps) {
                        const orderedList = `<ol>${steps.filter(item => item.isStep).map(item => `<li>${item.text}</li>`).join('')}</ol>`;
                        const additionalText = steps.filter(item => !item.isStep).map(item => `<p>${item.text}</p>`).join('');
                        instructionsBlock.innerHTML += orderedList + additionalText;
                    } else {
                        instructionsBlock.innerHTML += stepElements.join('');
                    }
                } else {
                    instructionsBlock.innerHTML += `<p>${recipe.instructions}</p>`;
                }
                details.appendChild(instructionsBlock);
            }
            div.appendChild(details);
            container.appendChild(div);
        });
    } catch (error) {
        console.error('Ошибка при отображении рецептов:', error);
        alert('Ошибка при отображении рецептов: ' + error.message);
    }
}

function toggleRecipes() {
    try {
        const recipesList = document.getElementById('recipesList');
        if (recipesList.style.display === 'none' || !recipesList.style.display) {
            updateRecipeList();
            recipesList.style.display = 'block';
            document.querySelector('button[onclick="toggleRecipes()"]').innerHTML = '<i class="fas fa-eye-slash"></i> Скрыть рецепты';
        } else {
            recipesList.style.display = 'none';
            recipesList.innerHTML = '';
            document.querySelector('button[onclick="toggleRecipes()"]').innerHTML = '<i class="fas fa-eye"></i> Показать/Скрыть рецепты';
        }
    } catch (error) {
        console.error('Ошибка при переключении рецептов:', error);
        alert('Ошибка при переключении рецептов: ' + error.message);
    }
}

function toggleDetails(index) {
    try {
        const details = document.getElementById(`recipe-details-${index}`);
        details.classList.toggle('show');
    } catch (error) {
        console.error('Ошибка при переключении деталей:', error);
        alert('Ошибка при переключении деталей: ' + error.message);
    }
}

function deleteRecipe(recipeName) {
    try {
        if (confirm(`Удалить рецепт "${recipeName || 'Без названия'}"?`)) {
            allRecipes = allRecipes.filter(recipe => recipe.name !== recipeName);
            alert('Рецепт удалён, база обновлена!');
            updateRecipeList();
            saveToIndexedDB('recipes', allRecipes);
        }
    } catch (error) {
        console.error('Ошибка при удалении рецепта:', error);
        alert('Ошибка при удалении рецепта: ' + error.message);
    }
}

function editRecipe(index) {
    try {
        editingRecipeIndex = index;
        const recipe = allRecipes[index];
        document.getElementById('editRecipeName').value = recipe.name;
        document.getElementById('editRecipeCategory').value = recipe.category;
        document.getElementById('editRecipeTag').value = recipe.tag;
        document.getElementById('editRecipeInstructions').value = recipe.instructions;
        const editIngredientsList = document.getElementById('editIngredientsList');
        editIngredientsList.innerHTML = '';
        recipe.ingredients.forEach(ing => {
            const div = document.createElement('div');
            div.className = 'ingredient';
            div.setAttribute('draggable', 'true');
            let ingredientSelect = `<select class="ingredient-select">`;
            ingredientsData.sort((a, b) => a['Ингредиент'].localeCompare(b['Ингредиент'])).forEach(i => {
                ingredientSelect += `<option value="${i['Ингредиент']}" ${i['Ингредиент'] === ing.Ингредиент ? 'selected' : ''}>${i['Ингредиент']}</option>`;
            });
            ingredientSelect += '</select>';
            let unitSelect = `<select class="unit-select">`;
            const units = [...new Set(ingredientsData.map(i => i['Единица измерения']))];
            units.forEach(unit => {
                unitSelect += `<option value="${unit}" ${unit === ing.Единица ? 'selected' : ''}>${unit}</option>`;
            });
            unitSelect += '</select>';
            div.innerHTML = `
                <i class="fas fa-grip-vertical drag-handle"></i>
                <div class="ingredient-content">
                    ${ingredientSelect}
                    <input type="text" class="quantity" placeholder="Количество (например, 1-2 или 1 ложка)" value="${ing.Количество}">
                    ${unitSelect}
                    <button onclick="this.parentElement.parentElement.remove();"><i class="fas fa-trash"></i> Удалить</button>
                </div>
            `;
            editIngredientsList.appendChild(div);
            div.addEventListener('dragstart', handleDragStart);
            div.addEventListener('dragover', handleDragOver);
            div.addEventListener('drop', handleDrop);
            div.addEventListener('dragend', handleDragEnd);
        });
        document.getElementById('editRecipeModal').style.display = 'block';
    } catch (error) {
        console.error('Ошибка при редактировании рецепта:', error);
        alert('Ошибка при редактировании рецепта: ' + error.message);
    }
}

function closeEditModal() {
    document.getElementById('editRecipeModal').style.display = 'none';
    editingRecipeIndex = null;
}

function addEditIngredient() {
    try {
        if (ingredientsData.length === 0) {
            alert('Ингредиенты не загружены! Проверьте файл ingredients.xlsx.');
            return;
        }
        const container = document.getElementById('editIngredientsList');
        const div = document.createElement('div');
        div.className = 'ingredient';
        div.setAttribute('draggable', 'true');
        let ingredientSelect = `<select class="ingredient-select">`;
        ingredientsData.sort((a, b) => a['Ингредиент'].localeCompare(b['Ингредиент'])).forEach(ing => {
            ingredientSelect += `<option value="${ing['Ингредиент']}">${ing['Ингредиент']}</option>`;
        });
        ingredientSelect += '</select>';
        let unitSelect = `<select class="unit-select">`;
        const units = [...new Set(ingredientsData.map(ing => ing['Единица измерения']))];
        units.forEach(unit => {
            unitSelect += `<option value="${unit}">${unit}</option>`;
        });
        unitSelect += '</select>';
        div.innerHTML = `
            <i class="fas fa-grip-vertical drag-handle"></i>
            <div class="ingredient-content">
                ${ingredientSelect}
                <input type="text" class="quantity" placeholder="Количество (например, 1-2 или 1 ложка)" value="">
                ${unitSelect}
                <button onclick="this.parentElement.parentElement.remove();"><i class="fas fa-trash"></i> Удалить</button>
            </div>
        `;
        container.appendChild(div);
        div.addEventListener('dragstart', handleDragStart);
        div.addEventListener('dragover', handleDragOver);
        div.addEventListener('drop', handleDrop);
        div.addEventListener('dragend', handleDragEnd);
    } catch (error) {
        console.error('Ошибка при добавлении ингредиента для редактирования:', error);
        alert('Ошибка при добавлении ингредиента: ' + error.message);
    }
}

function saveEditRecipe() {
    try {
        if (editingRecipeIndex === null) return;
        const recipeName = document.getElementById('editRecipeName').value.trim();
        const recipeCategory = document.getElementById('editRecipeCategory').value || 'Без категории';
        const recipeTag = document.getElementById('editRecipeTag').value || '';
        const recipeInstructions = document.getElementById('editRecipeInstructions').value.trim();
        if (!recipeName || (allRecipes.some((r, i) => r.name.toLowerCase() === recipeName.toLowerCase() && i !== editingRecipeIndex))) {
            alert(!recipeName ? 'Введите название рецепта!' : `Рецепт с названием "${recipeName}" уже существует!`);
            return;
        }
        const ingredients = [];
        let hasInvalidIngredient = false;
        document.querySelectorAll('#editIngredientsList .ingredient').forEach(ingDiv => {
            const ingredient = ingDiv.querySelector('.ingredient-select').value;
            const quantity = ingDiv.querySelector('.quantity').value.trim();
            const unit = ingDiv.querySelector('.unit-select').value;
            if (ingredient && quantity && unit) {
                const quantityValue = quantity.replace(/[^0-9-]/g, '');
                if (!quantityValue && quantity !== '') {
                    alert(`Количество для ингредиента "${ingredient}" должно содержать хотя бы одну цифру или диапазон (например, 1-2)!`);
                    hasInvalidIngredient = true;
                    return;
                }
                ingredients.push({ Ингредиент: ingredient, Количество: quantity, Единица: unit });
            } else {
                alert(`Заполните все поля для ингредиента "${ingredient || 'не указан'}"!`);
                hasInvalidIngredient = true;
                return;
            }
        });
        if (hasInvalidIngredient || ingredients.length === 0) {
            if (ingredients.length === 0) alert('Добавьте хотя бы один ингредиент!');
            return;
        }
        allRecipes[editingRecipeIndex] = { name: recipeName, category: recipeCategory, tag: recipeTag, ingredients, instructions: recipeInstructions };
        alert(`Рецепт "${recipeName}" обновлён!`);
        closeEditModal();
        updateRecipeList();
        saveToIndexedDB('recipes', allRecipes);
    } catch (error) {
        console.error('Ошибка при сохранении изменений рецепта:', error);
        alert('Ошибка при сохранении изменений: ' + error.message);
    }
}

function clearRecipes() {
    try {
        if (confirm('Удалить все рецепты?')) {
            allRecipes = [];
            categories = [];
            tags = ['Топ', 'Доработать', 'Любовь по жизни'];
            usedTagColors.clear();
            updateCategorySelect();
            updateCategoryFilter();
            updateEditCategorySelect();
            updateTagSelect();
            updateTagFilter();
            updateEditTagSelect();
            showRecipes();
            alert('Все рецепты удалены!');
            // Сохраняем в IndexedDB
            saveToIndexedDB('recipes', []);
            saveToIndexedDB('categories', []);
            saveToIndexedDB('tags', []);
        }
    } catch (error) {
        console.error('Ошибка при очистке рецептов:', error);
        alert('Ошибка при очистке рецептов: ' + error.message);
    }
}

function updateRecipeList() {
    try {
        const searchTerm = document.getElementById('searchRecipes').value.toLowerCase();
        const categoryFilter = document.getElementById('recipeCategoryFilter').value;
        const tagFilter = document.getElementById('recipeTagFilter').value;
        if (document.getElementById('recipesList').style.display === 'block') {
            showRecipes(searchTerm, categoryFilter, tagFilter);
        }
    } catch (error) {
        console.error('Ошибка при обновлении списка:', error);
        alert('Ошибка при обновлении списка: ' + error.message);
    }
}

function toggleTheme() {
    try {
        const isDark = document.body.classList.toggle('dark-theme');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        const icon = document.querySelector('#themeToggleBtn i');
        if (icon) {
            icon.className = isDark ? 'fas fa-sun' : 'fas fa-moon';
        }
    } catch (error) {
        console.error('Ошибка при переключении темы:', error);
        alert('Ошибка при переключении темы: ' + error.message);
    }
}

function toggleAddRecipe() {
    try {
        const content = document.getElementById('addRecipeContent');
        const header = document.querySelector('.collapsible-header');
        content.classList.toggle('show');
        header.innerHTML = `<span>Добавить рецепт</span> <i class="fas fa-${content.classList.contains('show') ? 'minus' : 'plus'}"></i>`;
    } catch (error) {
        console.error('Ошибка при переключении блока "Добавить рецепт":', error);
        alert('Ошибка при переключении блока "Добавить рецепт": ' + error.message);
    }
}

console.log('script.js загружен');
