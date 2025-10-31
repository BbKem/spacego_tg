// Инициализация Telegram Web App
const tg = window.Telegram.WebApp;
tg.expand(); // Раскрываем на весь экран
tg.ready(); // Говорим Telegram, что приложение готово

// URL вашего сервера - ПОМЕНЯЙТЕ НА СВОЙ ПОЗЖЕ
const backendUrl = 'https://spacegotg-production.up.railway.app';

// Загружаем объявления при загрузке страницы
document.addEventListener('DOMContentLoaded', loadAds);

async function loadAds() {
    try {
        const response = await fetch(`${backendUrl}/api/ads`);
        const data = await response.json(); // Получаем объект с ads внутри
        const ads = data.ads || []; // Извлекаем массив объявлений
        
        const adsList = document.getElementById('adsList');
        
        if (!ads || ads.length === 0) {
            adsList.innerHTML = '<div class="loading">Объявлений пока нет. Будьте первым!</div>';
            return;
        }
        
        adsList.innerHTML = '';
        
        ads.forEach(ad => {
            const adElement = document.createElement('div');
            adElement.className = 'ad-card';
            adElement.innerHTML = `
                <div class="ad-title">${ad.title}</div>
                <div>${ad.description}</div>
                <div class="category">📁 ${ad.category}</div>
                ${ad.price ? `<div class="ad-price">💰 ${ad.price} ₽</div>` : ''}
                ${ad.imageUrl ? `<img src="${ad.imageUrl}" style="max-width: 100%; border-radius: 8px; margin-top: 10px;">` : ''}
                <div style="margin-top: 10px; font-size: 12px; color: #999;">
                    👤 ${ad.author?.firstName || 'User'} • ${new Date(ad.createdAt).toLocaleDateString()}
                </div>
            `;
            adsList.appendChild(adElement);
        });
    } catch (error) {
        console.error('Ошибка загрузки:', error);
        document.getElementById('adsList').innerHTML = '<div class="loading">Ошибка загрузки. Проверьте подключение.</div>';
    }
}

function showCreateForm() {
    document.getElementById('createAdForm').style.display = 'block';
}

async function createAd() {
    const title = document.getElementById('adTitle').value;
    const description = document.getElementById('adDescription').value;
    const price = document.getElementById('adPrice').value;
    const category = document.getElementById('adCategory').value;
    const imageUrl = document.getElementById('adImageUrl').value;

    if (!title || !description || !category) {
        tg.showPopup({ title: "Ошибка", message: "Заполните обязательные поля: заголовок, описание и категория" });
        return;
    }

    // Получаем данные пользователя из Telegram
    const user = tg.initDataUnsafe?.user;
    const authorTelegramId = user?.id.toString();

    if (!authorTelegramId) {
        tg.showPopup({ title: "Ошибка", message: "Не удалось идентифицировать пользователя" });
        return;
    }

    try {
        const response = await fetch(`${backendUrl}/api/ads`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title,
                description,
                price,
                category,
                imageUrl,
                authorTelegramId
            })
        });

        if (response.ok) {
            // Очищаем форму и скрываем её
            document.getElementById('createAdForm').style.display = 'none';
            document.getElementById('adTitle').value = '';
            document.getElementById('adDescription').value = '';
            document.getElementById('adPrice').value = '';
            document.getElementById('adCategory').value = '';
            document.getElementById('adImageUrl').value = '';
            
            // Перезагружаем список объявлений
            loadAds();
            
            tg.showPopup({ 
                title: "Успех!", 
                message: "Ваше объявление опубликовано!" 
            });
        } else {
            const error = await response.json();
            tg.showPopup({ title: "Ошибка", message: error.error });
        }
    } catch (error) {
        console.error('Ошибка:', error);
        tg.showPopup({ title: "Ошибка", message: "Проверьте подключение к интернету" });
    }
}