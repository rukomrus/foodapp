const CACHE_NAME = 'recipes-app-v9'; // Обновляем версию кэша
const urlsToCache = [
    '/',
    '/index.html',
    '/script.js',
    '/ingredients.xlsx',
    '/recipes.xlsx',
    'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

self.addEventListener('install', event => {
    console.log('Service Worker: установка');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Service Worker: кэширование основных файлов');
                // Пропускаем кэширование отсутствующих файлов
                return Promise.all(
                    urlsToCache.map(url =>
                        cache.add(url).catch(error => {
                            console.warn(`Service Worker: не удалось кэшировать ${url}: ${error}`);
                        })
                    )
                );
            })
            .then(() => self.skipWaiting()) // Активируем новый Service Worker сразу
            .catch(error => {
                console.error('Service Worker: ошибка кэширования:', error);
            })
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                if (response) {
                    console.log('Service Worker: найден кэш для:', event.request.url);
                    return response;
                }
                console.log('Service Worker: загрузка из сети:', event.request.url);
                return fetch(event.request)
                    .catch(error => {
                        console.error('Service Worker: ошибка загрузки:', error);
                        // Если это Excel-файлы, возвращаем null, чтобы приложение обработало отсутствие
                        if (event.request.url.includes('ingredients.xlsx') || event.request.url.includes('recipes.xlsx')) {
                            return new Response(null, { status: 404 });
                        }
                        throw error;
                    });
            })
    );
});

self.addEventListener('activate', event => {
    console.log('Service Worker: активация');
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (!cacheWhitelist.includes(cacheName)) {
                        console.log('Service Worker: удаление старого кэша:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
        .then(() => self.clients.claim()) // Активируем новый Service Worker для всех клиентов
    );
});