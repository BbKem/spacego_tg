const express = require('express');
const { Client } = require('pg');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// PostgreSQL клиент
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Подключение к базе
client.connect()
  .then(() => console.log('✅ Подключение к PostgreSQL установлено'))
  .catch(err => {
    console.error('❌ Ошибка подключения:', err);
    process.exit(1); // Завершаем процесс, если нет подключения
  });

// Health check
app.get('/api/health', async (req, res) => {
  try {
    await client.query('SELECT 1');
    res.json({ 
      status: 'OK', 
      message: 'Сервер и база данных работают!',
      database: 'PostgreSQL Connected'
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'ERROR', 
      message: 'Ошибка подключения к базе данных'
    });
  }
});

async function initializeDatabase() {
  try {
    // Таблица пользователей
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        telegram_id VARCHAR(255) UNIQUE NOT NULL,
        username VARCHAR(255),
        first_name VARCHAR(255),
        last_name VARCHAR(255),
        is_shop BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Таблица объявлений
    await client.query(`
      CREATE TABLE IF NOT EXISTS ads (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        price DECIMAL(10,2),
        category VARCHAR(255) NOT NULL,
        image_url TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        author_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('✅ Таблицы созданы/проверены');
  } catch (error) {
    console.error('❌ Ошибка создания таблиц:', error);
    process.exit(1); // Завершаем процесс, если таблицы не созданы
  }
}

// API: Получить все объявления
app.get('/api/ads', async (req, res) => {
  try {
    const result = await client.query(`
      SELECT 
        a.*,
        u.first_name,
        u.last_name,
        u.is_shop
      FROM ads a
      LEFT JOIN users u ON a.author_id = u.id
      WHERE a.is_active = TRUE
      ORDER BY a.created_at DESC
    `);

    const ads = result.rows.map(row => ({
      id: row.id,
      title: row.title,
      description: row.description,
      price: row.price,
      category: row.category,
      imageUrl: row.image_url,
      isActive: row.is_active,
      createdAt: row.created_at,
      author: {
        firstName: row.first_name || 'User',
        lastName: row.last_name || '',
        isShop: row.is_shop
      }
    }));

    res.json({
      ads: ads,
      total: ads.length
    });
  } catch (error) {
    console.error('Error fetching ads:', error);
    res.status(500).json({ error: 'Ошибка при загрузке объявлений' });
  }
});

// API: Создать объявление
// API: Создать объявление
app.post('/api/ads', async (req, res) => {
  const { title, description, price, category, imageUrl, authorTelegramId } = req.body;

  // Валидация обязательных полей
  if (!title || !description || !category) {
    return res.status(400).json({ error: 'Заполните обязательные поля: заголовок, описание и категория' });
  }

  // Проверка Telegram ID
  if (!authorTelegramId) {
    return res.status(400).json({ error: 'Не удалось определить пользователя. Пожалуйста, перезапустите приложение.' });
  }

  try {
    // Находим или создаем пользователя
    let userResult = await client.query(
      'SELECT id FROM users WHERE telegram_id = $1',
      [authorTelegramId]
    );

    let userId;
    if (userResult.rows.length === 0) {
      // Создаем нового пользователя с минимальными данными
      const newUser = await client.query(
        'INSERT INTO users (telegram_id, first_name, username) VALUES ($1, $2, $3) RETURNING id',
        [authorTelegramId, 'User', 'unknown'] // Добавляем username, чтобы избежать ошибки
      );
      userId = newUser.rows[0].id;
    } else {
      userId = userResult.rows[0].id;
    }

    // Создаем объявление
    const newAd = await client.query(
      `INSERT INTO ads (title, description, price, category, image_url, author_id) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [title.trim(), description.trim(), price ? parseFloat(price) : null, category.trim(), imageUrl || null, userId]
    );

    const ad = newAd.rows[0];

    res.status(201).json({
      id: ad.id,
      title: ad.title,
      description: ad.description,
      price: ad.price,
      category: ad.category,
      imageUrl: ad.image_url,
      createdAt: ad.created_at,
      author: {
        firstName: 'User',
        isShop: false
      }
    });
  } catch (error) {
    console.error('Error creating ad:', error);
    res.status(500).json({ error: 'Ошибка при создании объявления' });
  }
});

// Запуск сервера
app.listen(port, async () => {
  await initializeDatabase();
  console.log(`🚀 Сервер запущен на порту ${port}`);
  console.log(`📊 База данных: PostgreSQL (прямое подключение)`);
});