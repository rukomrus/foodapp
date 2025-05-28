<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="theme-color" content="#28a745">
    <title>База рецептов</title>
    <link rel="manifest" href="/manifest.json">
    <link rel="icon" href="icon-192x192.png">
    <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>
    <style>
        body { 
            font-family: 'Roboto', sans-serif; 
            background-color: #fff8e1; 
            margin: 20px; 
            letter-spacing: 0.5px; 
            transition: background-color 0.3s, color 0.3s;
        }
        * {
            box-sizing: border-box;
        }
        input, select, button, textarea { 
            width: 100%; 
            margin-bottom: 10px; 
            padding: 8px; 
            font-size: 16px; 
            border: 1px solid #e0e0e0; 
            border-radius: 5px; 
            transition: background-color 0.3s, color 0.3s, border-color 0.3s;
        }
        textarea {
            resize: vertical;
        }
        button { 
            background-color: #28a745; 
            color: white; 
            border: none; 
            cursor: pointer; 
        }
        button:hover { 
            background-color: #218838; 
        }
        button[onclick="toggleRecipes()"] { 
            background-color: #007bff; 
        }
        button[onclick="toggleRecipes()"]:hover { 
            background-color: #0056b3; 
        }
        button[onclick="saveRecipesToExcel()"] { 
            background-color: #17a2b8; 
        }
        button[onclick="saveRecipesToExcel()"]:hover { 
            background-color: #138496; 
        }
        button i { 
            margin-right: 5px; 
        }
        .ingredient { 
            margin-bottom: 15px; 
            padding: 10px; 
            border: 1px solid #e0e0e0; 
            border-radius: 5px; 
            background-color: #f9f9f9; 
            cursor: move; 
            position: relative; 
            display: flex; 
            flex-wrap: wrap; 
            gap: 10px; 
        }
        .ingredient:hover { 
            background-color: #f0f0f0; 
        }
        .ingredient.dragging { 
            opacity: 0.5; 
            border: 2px dashed #28a745; 
        }
        .ingredient .drag-handle { 
            position: absolute; 
            left: 5px; 
            top: 50%; 
            transform: translateY(-50%); 
            font-size: 16px; 
            color: #28a745; 
            cursor: move; 
        }
        .ingredient-content { 
            margin-left: 30px; 
            flex: 1; 
            display: flex; 
            flex-wrap: wrap; 
            gap: 10px; 
            width: calc(100% - 30px); 
        }
        .ingredient-content select, 
        .ingredient-content input, 
        .ingredient-content button { 
            flex: 1 1 auto; 
            width: auto; 
            min-width: 120px; 
        }
        .ingredient-content input[type="number"] { 
            width: 100px; 
        }
        .new-ingredient-section {
            display: none;
            margin-top: 10px;
        }
        .new-ingredient-section.show {
            display: block;
        }
        .recipe { 
            margin: 15px 0; 
            padding: 15px; 
            border: 1px solid #e0e0e0; 
            border-radius: 8px; 
            box-shadow: 0 2px 5px rgba(0,0,0,0.1); 
            opacity: 0; 
            transform: translateY(20px); 
            animation: fadeIn 0.3s ease forwards; 
            transition: background-color 0.3s, border-color 0.3s;
            position: relative; 
        }
        @keyframes fadeIn {
            to { opacity: 1; transform: translateY(0); }
        }
        .recipe-header { 
            display: flex; 
            justify-content: space-between; 
            align-items: flex-start; 
        }
        .recipe-title-container { 
            display: flex; 
            align-items: center; 
            max-width: 60%; 
            flex: 1; 
        }
        .recipe h3 { 
            margin: 0 0 5px 0; 
            cursor: pointer; 
            color: #218838; 
            font-size: 20px; 
            font-weight: bold; 
            word-wrap: break-word; 
        }
        .recipe h3:hover { 
            color: #1e7e34; 
        }
        .recipe .delete-icon { 
            font-size: 16px; 
            color: #dc3545; 
            margin-right: 10px; 
            cursor: pointer; 
            transition: color 0.3s; 
        }
        .recipe .delete-icon:hover { 
            color: #c82333; 
        }
        .recipe .edit-btn { 
            background-color: #007bff; 
            padding: 5px 10px; 
            border-radius: 5px; 
            cursor: pointer; 
        }
        .recipe .edit-btn:hover { 
            background-color: #0056b3; 
        }
        .recipe .select-container { 
            display: flex; 
            flex-direction: column; 
            align-items: flex-end; 
            gap: 5px; 
        }
        .recipe .category-select, .recipe .tag-select { 
            font-size: 14px; 
            width: 150px; 
            padding: 2px 5px; 
        }
        .recipe .tag-container { 
            margin-left: 26px; 
        }
        .recipe .tag { 
            font-size: 12px; 
            padding: 2px 6px; 
            border-radius: 3px; 
            color: white; 
        }
        .tag-топ { background-color: #28a745; }
        .tag-доработать { background-color: #ffc107; }
        .tag-любовь-по-жизни { background-color: #dc3545; }
        .recipe-details { 
            max-height: 0; 
            overflow: hidden; 
            transition: max-height 0.3s ease; 
            margin-top: 10px; 
        }
        .recipe-details.show { 
            max-height: 700px; 
        }
        .instructions-block { 
            border-left: 3px solid #28a745; 
            padding-left: 10px; 
        }
        .recipe-details ol { 
            margin: 10px 0 0 30px; 
            padding-left: 0; 
            list-style-position: outside; 
        }
        .recipe-details ol li { 
            margin-bottom: 5px; 
        }
        .delete-btn { 
            background-color: #dc3545; 
            color: white; 
            border: none; 
            border-radius: 5px; 
            padding: 5px 10px; 
            cursor: pointer; 
        }
        .delete-btn:hover { 
            background-color: #c82333; 
        }
        #recipesList { 
            display: none; 
        }
        .category { 
            font-size: 14px; 
            padding: 2px 6px; 
            border-radius: 3px; 
            margin-left: 10px; 
        }
        .category-выпечка { background-color: #ffc107; }
        .category-супы { background-color: #28a745; }
        .category-салаты { background-color: #17a2b8; }
        .category-десерты { background-color: #fd7e14; }
        .category-основные-блюда { background-color: #6f42c1; }
        .dark-theme {
            background-color: #333;
            color: #fff;
        }
        .dark-theme .recipe { 
            background-color: #444; 
            border-color: #555; 
            box-shadow: 0 2px 5px rgba(0,0,0,0.3); 
        }
        .dark-theme input, .dark-theme select, .dark-theme textarea { 
            background-color: #555; 
            color: #fff; 
            border-color: #666; 
        }
        .dark-theme button { 
            background-color: #218838; 
        }
        .dark-theme button:hover { 
            background-color: #1e7e34; 
        }
        .dark-theme button[onclick="toggleRecipes()"] { 
            background-color: #0056b3; 
        }
        .dark-theme button[onclick="toggleRecipes()"]:hover { 
            background-color: #003d82; 
        }
        .dark-theme button[onclick="saveRecipesToExcel()"] { 
            background-color: #138496; 
        }
        .dark-theme button[onclick="saveRecipesToExcel()"]:hover { 
            background-color: #117a8b; 
        }
        .dark-theme .delete-btn { 
            background-color: #c82333; 
        }
        .dark-theme .delete-btn:hover { 
            background-color: #a71d2a; 
        }
        .dark-theme .delete-icon { 
            color: #c82333; 
        }
        .dark-theme .delete-icon:hover { 
            color: #a71d2a; 
        }
        .dark-theme .edit-btn { 
            background-color: #0056b3; 
        }
        .dark-theme .edit-btn:hover { 
            background-color: #003d82; 
        }
        .dark-theme .instructions-block { 
            border-left-color: #218838; 
        }
        .dark-theme .ingredient { 
            background-color: #555; 
            border-color: #666; 
        }
        .dark-theme .ingredient:hover { 
            background-color: #666; 
        }
        .dark-theme .ingredient.dragging { 
            border-color: #218838; 
        }
        .dark-theme .drag-handle { 
            color: #218838; 
        }
        #loadingMessage {
            color: #28a745;
            font-weight: bold;
            margin-bottom: 10px;
        }
        .collapsible-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            background-color: #28a745;
            color: white;
            padding: 10px;
            border-radius: 5px;
            cursor: pointer;
        }
        .collapsible-header:hover {
            background-color: #218838;
        }
        .collapsible-content {
            max-height: 0;
            overflow: hidden;
            transition: max-height 0.3s ease;
            padding: 0 10px;
        }
        .collapsible-content.show {
            max-height: none;
            padding: 10px;
        }
        .header-icon {
            display: flex;
            justify-content: center;
            align-items: center;
            margin-bottom: 20px;
        }
        .header-icon i {
            font-size: 40px;
            color: #28a745;
            margin: 0 10px;
            transition: color 0.3s;
        }
        .header-icon i:hover {
            color: #218838;
        }
        .dark-theme .header-icon i {
            color: #218838;
        }
        .dark-theme .header-icon i:hover {
            color: #1e7e34;
        }
        #editRecipeModal {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.5);
            z-index: 1000;
            overflow-y: auto;
        }
        #editRecipeContent {
            background-color: white;
            margin: 50px auto;
            padding: 20px;
            width: 90%;
            max-width: 600px;
            border-radius: 5px;
            position: relative;
            min-height: 80vh;
            max-height: 80vh;
            overflow-y: auto;
            box-sizing: border-box;
        }
        #editRecipeContent label {
            display: block;
            margin-bottom: 5px;
            font-weight: bold;
        }
        #editRecipeContent input,
        #editRecipeContent select,
        #editRecipeContent textarea {
            width: 100%;
            padding: 8px;
            font-size: 16px;
        }
        .dark-theme #editRecipeContent {
            background-color: #444;
        }
        .close-modal {
            position: absolute;
            top: 10px;
            right: 10px;
            font-size: 20px;
            cursor: pointer;
            color: #dc3545;
        }
        .dark-theme .close-modal {
            color: #c82333;
        }
        @media (max-width: 600px) {
            .ingredient { 
                flex-direction: column; 
                gap: 10px; 
            }
            .ingredient-content { 
                margin-left: 0; 
                width: 100%; 
            }
            .ingredient .drag-handle { 
                position: static; 
                transform: none; 
                margin-bottom: 5px; 
            }
            .ingredient-content select, 
            .ingredient-content input, 
            .ingredient-content button { 
                width: 100%; 
                min-width: 0; 
            }
            .ingredient-content input[type="number"] { 
                width: 100%; 
            }
            .delete-btn { margin-top: 10px; }
            .recipe .category-select, .recipe .tag-select { width: 100px; }
            .recipe .recipe-header { 
                flex-direction: column; 
                align-items: flex-start; 
            }
            .recipe .select-container { 
                align-items: flex-start; 
                margin-top: 10px; 
            }
            .recipe .tag-container { margin-left: 0; }
            .header-icon i {
                font-size: 30px;
                margin: 0 5px;
            }
            #editRecipeContent {
                margin: 20px auto;
                width: 90%;
                min-height: 70vh;
                max-height: 70vh;
                padding: 15px;
            }
        }
    </style>
</head>
<body>
    <div class="header-icon">
        <i class="fas fa-utensil-spoon"></i>
        <i class="fas fa-plate-wheat"></i>
        <i class="fas fa-utensil-fork"></i>
    </div>
    <div id="loadingMessage">Загрузка данных...</div>
    <button onclick="toggleTheme()"><i class="fas fa-moon"></i> Тёмная тема</button><br><br>

    <div class="collapsible-header" onclick="toggleAddRecipe()">
        <span>Добавить рецепт</span>
        <i class="fas fa-plus"></i>
    </div>
    <div id="addRecipeContent" class="collapsible-content">
        <label>Категория рецепта:</label>
        <select id="recipeCategory" onchange="updateRecipeList()">
            <option value="">Все категории</option>
            <!-- Категории добавляются динамически -->
        </select>
        <input type="text" id="newCategory" placeholder="Новая категория">
        <button onclick="addCategory()"><i class="fas fa-plus"></i> Добавить категорию</button>
        <button onclick="deleteCategory()"><i class="fas fa-trash"></i> Удалить категорию</button>
        <label>Метка рецепта:</label>
        <select id="recipeTag">
            <option value="">Без метки</option>
            <option value="Топ">Топ</option>
            <option value="Доработать">Доработать</option>
            <option value="Любовь по жизни">Любовь по жизни</option>
        </select>
        <input type="text" id="newTag" placeholder="Новая метка">
        <button onclick="addTag()"><i class="fas fa-plus"></i> Добавить метку</button>
        <button onclick="deleteTag()"><i class="fas fa-trash"></i> Удалить метку</button><br><br>
        
        <label>Наименование рецепта:</label>
        <input type="text" id="recipeName" placeholder="Введите название рецепта"><br>
        <label>Инструкции приготовления:</label>
        <textarea id="recipeInstructions" placeholder="Введите инструкции приготовления, например: 1. Смешать муку. 2. Выпекать." rows="6"></textarea><br><br>
        
        <div id="ingredientsList"></div>
        <button id="addIngredientBtn" onclick="addIngredient()"><i class="fas fa-plus"></i> Добавить ингредиент</button><br>
        <div id="newIngredientSection" class="new-ingredient-section">
            <label>Новый ингредиент:</label>
            <input type="text" id="newIngredientName" placeholder="Введите новый ингредиент">
            <select id="newIngredientUnit">
                <option value="">Выберите единицу</option>
                <!-- Единицы добавляются динамически -->
            </select>
            <button onclick="saveNewIngredient()">Сохранить новый ингредиент</button>
        </div>
        <button id="saveRecipeBtn" onclick="saveRecipe()"><i class="fas fa-check"></i> Сохранить рецепт</button><br>
    </div><br>

    <div id="editRecipeModal">
        <div id="editRecipeContent">
            <span class="close-modal" onclick="closeEditModal()">×</span>
            <label>Категория рецепта:</label>
            <select id="editRecipeCategory">
                <option value="">Все категории</option>
                <!-- Категории добавляются динамически -->
            </select>
            <label>Метка рецепта:</label>
            <select id="editRecipeTag">
                <option value="">Без метки</option>
                <!-- Метки добавляются динамически -->
            </select>
            <label>Наименование рецепта:</label>
            <input type="text" id="editRecipeName" placeholder="Введите название рецепта"><br>
            <label>Инструкции приготовления:</label>
            <textarea id="editRecipeInstructions" placeholder="Введите инструкции приготовления" rows="6"></textarea><br><br>
            <div id="editIngredientsList"></div>
            <button id="addEditIngredientBtn" onclick="addEditIngredient()"><i class="fas fa-plus"></i> Добавить ингредиент</button><br>
            <button id="saveEditRecipeBtn" onclick="saveEditRecipe()"><i class="fas fa-check"></i> Сохранить изменения</button>
        </div>
    </div>

    <button onclick="saveRecipesToExcel()"><i class="fas fa-download"></i> Сохранить рецепты в Excel</button><br>
    <button onclick="toggleRecipes()"><i class="fas fa-eye"></i> Показать/Скрыть рецепты</button><br>
    <button onclick="clearRecipes()"><i class="fas fa-trash-alt"></i> Очистить все рецепты</button><br>
    <input type="text" id="searchRecipes" placeholder="Поиск по названию"><br>
    <select id="recipeCategoryFilter" onchange="updateRecipeList()">
        <option value="">Все категории</option>
        <!-- Категории добавляются динамически -->
    </select><br>
    <select id="recipeTagFilter" onchange="updateRecipeList()">
        <option value="">Все метки</option>
        <!-- Метки добавляются динамически -->
    </select><br>
    <select id="sortRecipes" onchange="updateRecipeList()">
        <option value="category-asc">По категории (A-Z)</option>
        <option value="category-desc">По категории (Z-A)</option>
        <option value="name-asc">По названию (A-Z)</option>
        <option value="name-desc">По названию (Z-A)</option>
    </select><br>
    <div id="recipesList"></div>

    <script>
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('/sw.js')
                    .then(registration => {
                        console.log('Service Worker зарегистрирован:', registration);
                    })
                    .catch(error => {
                        console.error('Ошибка регистрации Service Worker:', error);
                    });
            });
        }
        // Загрузка темы
        if (localStorage.getItem('theme') === 'dark') {
            document.body.classList.add('dark-theme');
            document.querySelector('button[onclick="toggleTheme()"]').innerHTML = '<i class="fas fa-sun"></i> Светлая тема';
        }
        // Подсказка для новичков
        if (!localStorage.getItem('firstVisit')) {
            alert('Добро пожаловать! Ингредиенты и рецепты загружаются автоматически из ingredients.xlsx и recipes.xlsx. Добавляйте новые рецепты с категориями и метками. Используйте поиск, сортировку и фильтры. ВАЖНО: Данные хранятся в памяти. Чтобы не потерять изменения, сохраните их в файл recipes.xlsx кнопкой "Сохранить рецепты в Excel"!');
            localStorage.setItem('firstVisit', 'true');
        }
        // Сворачиваемый блок "Добавить рецепт" по умолчанию
        document.getElementById('addRecipeContent').classList.remove('show');
    </script>
    <script src="script.js"></script>
</body>
</html>
