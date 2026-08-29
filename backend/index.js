require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { DatabaseSync } = require('node:sqlite');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-here';

// Middleware — CORS is configurable via env so the deployed Cloudflare backend
// can be reached from the Vercel-hosted frontend.
const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || '*')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: ALLOWED_ORIGINS.includes('*')
      ? true
      : (origin, callback) => {
          // Allow requests with no origin (same-origin, curl, server-to-server).
          if (!origin || ALLOWED_ORIGINS.includes(origin)) {
            return callback(null, true);
          }
          callback(new Error('Not allowed by CORS'));
        },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.use(bodyParser.json());

// Database setup — uses Node's built-in synchronous SQLite (no native modules,
// so it installs and runs anywhere Node 22+ is available).
const db = new DatabaseSync(process.env.DATABASE_PATH || './affiliate-hub.db');
db.exec('PRAGMA journal_mode = WAL;');
initializeDatabase();

// Initialize database with tables
function initializeDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      whatsapp TEXT,
      country TEXT DEFAULT 'NG',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      price REAL NOT NULL,
      commission REAL NOT NULL,
      category TEXT,
      image_url TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS affiliate_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      link_code TEXT UNIQUE NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      type TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      description TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS profile (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE NOT NULL,
      bio TEXT,
      phone TEXT,
      address TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS bank_details (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE NOT NULL,
      bank_name TEXT,
      account_name TEXT,
      account_number TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      clicks INTEGER DEFAULT 0,
      conversions INTEGER DEFAULT 0,
      earnings REAL DEFAULT 0,
      date TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  seedSampleData();
}

// Seed sample data (only when empty)
function seedSampleData() {
  const count = db.prepare('SELECT COUNT(*) AS count FROM users').get();
  if (count && count.count > 0) return;

  const insertUser = db.prepare(
    'INSERT INTO users (name, email, password) VALUES (?, ?, ?)'
  );
  insertUser.run('Chinedu Nwankwo', 'chinedu@example.com', bcrypt.hashSync('password123', 10));
  insertUser.run('Amaka Udo', 'amaka@example.com', bcrypt.hashSync('password123', 10));

  const insertProduct = db.prepare(
    'INSERT INTO products (title, description, price, commission, category, image_url) VALUES (?, ?, ?, ?, ?, ?)'
  );
  insertProduct.run(
    'Premium Forex Trading Course',
    'Complete forex trading course for beginners to advanced traders',
    150000,
    45,
    'Digital',
    'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=400&h=400&fit=crop'
  );
  insertProduct.run(
    'Smart Fitness Watch Pro',
    'Advanced fitness tracker with heart rate monitoring',
    45000,
    25,
    'Tech',
    'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&h=400&fit=crop'
  );
  insertProduct.run(
    'Organic Skincare Set',
    'Complete organic skincare routine with natural ingredients',
    28000,
    30,
    'Beauty',
    'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=400&h=400&fit=crop'
  );
  insertProduct.run(
    'Online Business Masterclass',
    'Learn to build a profitable online business from scratch',
    95000,
    50,
    'Digital',
    'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=400&h=400&fit=crop'
  );

  // Seed demo wallet transactions + stats for the seeded accounts so the
  // dashboard and wallet are populated out of the box.
  const insertTx = db.prepare(
    'INSERT INTO transactions (user_id, amount, type, status, description) VALUES (?, ?, ?, ?, ?)'
  );
  insertTx.run(1, 67500, 'credit', 'completed', 'Premium Forex Trading Course — commission');
  insertTx.run(1, 45000, 'credit', 'completed', 'Smart Fitness Watch Pro — commission');
  insertTx.run(1, 28500, 'credit', 'pending', 'Organic Skincare Set — commission');
  insertTx.run(2, 95000, 'credit', 'completed', 'Online Business Masterclass — commission');

  const insertStats = db.prepare(
    "INSERT INTO stats (user_id, clicks, conversions, earnings, date) VALUES (?, ?, ?, ?, date('now'))"
  );
  insertStats.run(1, 12847, 456, 141000);
  insertStats.run(2, 9400, 380, 95000);

  console.log('Database seeded with sample data.');
}

// Authentication middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    whatsapp: user.whatsapp || null,
    country: user.country || 'NG',
  };
}

function withCommission(product) {
  return {
    ...product,
    commissionAmount: Math.round(product.price * (product.commission / 100)),
  };
}

// ===========================================================================
// Auth routes
// ===========================================================================
app.post('/api/v1/auth/login', (req, res) => {
  const { email, password } = req.body;

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, name: user.name },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  res.json({ token, user: publicUser(user) });
});

app.post('/api/v1/auth/signup', (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required' });
  }
  if (String(password).length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) {
    return res.status(400).json({ error: 'Enter a valid email address' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    return res.status(400).json({ error: 'Email already exists' });
  }

  const hashedPassword = bcrypt.hashSync(password, 10);
  const result = db
    .prepare('INSERT INTO users (name, email, password) VALUES (?, ?, ?)')
    .run(name, email, hashedPassword);

  const id = Number(result.lastInsertRowid);
  const token = jwt.sign({ id, email, name }, JWT_SECRET, { expiresIn: '24h' });

  res.status(201).json({
    token,
    user: { id, name, email, whatsapp: null, country: 'NG' },
  });
});

app.post('/api/v1/auth/social-auth', (req, res) => {
  const { provider, token } = req.body;
  // In a real implementation, verify the token with the social provider.
  // For this reference backend we create/link a demo user.
  const email = `${provider}_${Date.now()}@example.com`;
  const name = `${provider}_user`;

  const existing = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (existing) {
    const authToken = jwt.sign(
      { id: existing.id, email: existing.email, name: existing.name },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    return res.json({ token: authToken, user: publicUser(existing) });
  }

  const hashedPassword = bcrypt.hashSync(Math.random().toString(36).slice(-8), 10);
  const result = db
    .prepare('INSERT INTO users (name, email, password) VALUES (?, ?, ?)')
    .run(name, email, hashedPassword);
  const id = Number(result.lastInsertRowid);
  const authToken = jwt.sign({ id, email, name }, JWT_SECRET, { expiresIn: '24h' });

  res.status(201).json({ token: authToken, user: { id, name, email, whatsapp: null, country: 'NG' } });
});

app.post('/api/v1/auth/refresh-token', (req, res) => {
  const { refreshToken } = req.body;
  try {
    const decoded = jwt.verify(refreshToken, JWT_SECRET);
    const newToken = jwt.sign(
      { id: decoded.id, email: decoded.email, name: decoded.name },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    res.json({ token: newToken });
  } catch (err) {
    res.status(403).json({ error: 'Invalid refresh token' });
  }
});

// ===========================================================================
// Product routes
// ===========================================================================
app.get('/api/v1/products', (req, res) => {
  const { category, sort } = req.query;

  let query = 'SELECT * FROM products';
  const params = [];

  if (category) {
    query += ' WHERE LOWER(category) = LOWER(?)';
    params.push(category);
  }

  if (sort) {
    switch (sort) {
      case 'price-low':
        query += ' ORDER BY price ASC';
        break;
      case 'price-high':
        query += ' ORDER BY price DESC';
        break;
      case 'commission':
        query += ' ORDER BY commission DESC';
        break;
      default:
        query += ' ORDER BY id DESC';
    }
  }

  const products = db.prepare(query).all(...params);
  res.json(products.map(withCommission));
});

app.get('/api/v1/products/search', (req, res) => {
  const { q } = req.query;
  if (!q) {
    return res.status(400).json({ error: 'Search query is required' });
  }

  const products = db
    .prepare('SELECT * FROM products WHERE title LIKE ? OR description LIKE ?')
    .all(`%${q}%`, `%${q}%`);

  res.json(products.map(withCommission));
});

app.get('/api/v1/products/categories', (req, res) => {
  const rows = db
    .prepare('SELECT DISTINCT category FROM products WHERE category IS NOT NULL')
    .all();
  res.json(rows.map((r) => r.category));
});

// NOTE: the /:id route must be registered AFTER the static product routes
// (/search, /categories) so those paths aren't captured by the :id param.
app.get('/api/v1/products/:id', (req, res) => {
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }

  const image = product.image_url;
  const promoAssets = [image, image];
  res.json({
    ...product,
    commissionAmount: Math.round(product.price * (product.commission / 100)),
    images: [image],
    whyPromote: [
      'High conversion rate',
      '30-day cookie duration',
      'Recurring commissions on upsells',
      'Professional marketing materials',
      'Dedicated affiliate support',
    ],
    promoAssets,
  });
});

// ===========================================================================
// Wallet routes
// ===========================================================================
app.get('/api/v1/wallet/balance', authenticateToken, (req, res) => {
  const row = db
    .prepare(
      "SELECT SUM(CASE WHEN type = 'credit' THEN amount ELSE -amount END) AS balance FROM transactions WHERE user_id = ?"
    )
    .get(req.user.id);
  const balance = row && row.balance ? row.balance : 0;
  res.json({ ngnBalance: balance, usdBalance: Math.round(balance / 450) });
});

app.get('/api/v1/wallet/transactions', authenticateToken, (req, res) => {
  const limit = Math.max(1, parseInt(req.query.limit, 10) || 10);
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const offset = (page - 1) * limit;

  const transactions = db
    .prepare('SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?')
    .all(req.user.id, limit, offset);

  res.json(transactions);
});

app.post('/api/v1/wallet/withdraw', authenticateToken, (req, res) => {
  const userId = req.user.id;
  const { amount, method, details } = req.body;

  const numericAmount = Number(amount);
  if (!numericAmount || numericAmount <= 0 || !method) {
    return res.status(400).json({ error: 'Amount and method are required' });
  }

  const row = db
    .prepare(
      "SELECT SUM(CASE WHEN type = 'credit' THEN amount ELSE -amount END) AS balance FROM transactions WHERE user_id = ?"
    )
    .get(userId);
  const balance = row && row.balance ? row.balance : 0;

  if (balance < numericAmount) {
    return res.status(400).json({ error: 'Insufficient balance' });
  }

  const result = db
    .prepare(
      'INSERT INTO transactions (user_id, amount, type, status, description) VALUES (?, ?, ?, ?, ?)'
    )
    .run(userId, numericAmount, 'debit', 'pending', `Withdrawal via ${method}${details ? ' — bank transfer' : ''}`);

  res.json({
    message: 'Withdrawal request submitted successfully',
    transactionId: Number(result.lastInsertRowid),
  });
});

app.get('/api/v1/wallet/withdraw-methods', authenticateToken, (req, res) => {
  res.json([
    { id: 'bank', name: 'Bank Transfer', description: 'Direct bank transfer' },
    { id: 'paypal', name: 'PayPal', description: 'PayPal transfer' },
    { id: 'usdt', name: 'USDT (TRC20)', description: 'Crypto transfer' },
  ]);
});

// ===========================================================================
// Stats routes
// ===========================================================================
app.get('/api/v1/stats/dashboard', authenticateToken, (req, res) => {
  const row = db
    .prepare(
      'SELECT SUM(clicks) AS totalClicks, SUM(conversions) AS totalConversions, SUM(earnings) AS totalEarnings FROM stats WHERE user_id = ?'
    )
    .get(req.user.id);

  const totalClicks = row && row.totalClicks ? row.totalClicks : 0;
  const totalConversions = row && row.totalConversions ? row.totalConversions : 0;
  const totalEarnings = row && row.totalEarnings ? row.totalEarnings : 0;

  res.json({
    totalClicks,
    totalConversions,
    totalEarnings,
    conversionRate: totalClicks ? Math.round((totalConversions / totalClicks) * 100) : 0,
  });
});

app.get('/api/v1/stats/performance', authenticateToken, (req, res) => {
  const { period = 'month' } = req.query;

  let dateCondition = '';
  switch (period) {
    case 'week':
      dateCondition = "AND date >= date('now', '-7 days')";
      break;
    case 'month':
      dateCondition = "AND date >= date('now', '-30 days')";
      break;
    case 'year':
      dateCondition = "AND date >= date('now', '-1 year')";
      break;
  }

  const stats = db
    .prepare(
      `SELECT date, clicks, conversions, earnings FROM stats WHERE user_id = ? ${dateCondition} ORDER BY date DESC`
    )
    .all(req.user.id);

  res.json(stats);
});

app.get('/api/v1/stats/leaderboard', authenticateToken, (req, res) => {
  const limit = Math.max(1, parseInt(req.query.limit, 10) || 10);

  const leaderboard = db
    .prepare(
      `SELECT u.id, u.name, COALESCE(SUM(s.earnings), 0) AS totalEarnings
       FROM users u
       LEFT JOIN stats s ON u.id = s.user_id
       GROUP BY u.id
       ORDER BY totalEarnings DESC
       LIMIT ?`
    )
    .all(limit);

  res.json(leaderboard);
});

// ===========================================================================
// Profile routes
// ===========================================================================
app.get('/api/v1/profile', authenticateToken, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  res.json({ ...publicUser(user), created_at: user.created_at });
});

app.put('/api/v1/profile/update', authenticateToken, (req, res) => {
  const userId = req.user.id;
  const { name, whatsapp, country } = req.body;

  if (!name && !whatsapp && !country) {
    return res.status(400).json({ error: 'Nothing to update' });
  }

  const current = db.prepare('SELECT name, whatsapp, country FROM users WHERE id = ?').get(userId);
  if (!current) {
    return res.status(404).json({ error: 'User not found' });
  }

  db.prepare('UPDATE users SET name = ?, whatsapp = ?, country = ? WHERE id = ?').run(
    name !== undefined ? name : current.name,
    whatsapp !== undefined ? whatsapp : current.whatsapp,
    country !== undefined ? country : current.country,
    userId
  );

  res.json({ message: 'Profile updated successfully' });
});

app.put('/api/v1/profile/bank-details', authenticateToken, (req, res) => {
  const userId = req.user.id;
  const { bank_name, account_name, account_number } = req.body;

  db.prepare(
    'INSERT INTO bank_details (user_id, bank_name, account_name, account_number) VALUES (?, ?, ?, ?) ' +
      'ON CONFLICT(user_id) DO UPDATE SET bank_name = excluded.bank_name, account_name = excluded.account_name, account_number = excluded.account_number'
  ).run(userId, bank_name, account_name, account_number);

  res.json({ message: 'Bank details updated successfully' });
});

app.put('/api/v1/profile/security', authenticateToken, (req, res) => {
  const userId = req.user.id;
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current and new passwords are required' });
  }

  const user = db.prepare('SELECT password FROM users WHERE id = ?').get(userId);
  if (!user || !bcrypt.compareSync(currentPassword, user.password)) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }

  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(
    bcrypt.hashSync(newPassword, 10),
    userId
  );

  res.json({ message: 'Password updated successfully' });
});

// ===========================================================================
// Affiliate routes
// ===========================================================================
app.get('/api/v1/affiliate/links', authenticateToken, (req, res) => {
  const links = db
    .prepare(
      'SELECT al.id, al.product_id, al.link_code, al.created_at, p.title AS product_title ' +
        'FROM affiliate_links al JOIN products p ON al.product_id = p.id WHERE al.user_id = ?'
    )
    .all(req.user.id);
  res.json(links);
});

app.post('/api/v1/affiliate/generate-link', authenticateToken, (req, res) => {
  const userId = req.user.id;
  const { productId } = req.body;

  if (!productId) {
    return res.status(400).json({ error: 'Product ID is required' });
  }

  // Prevent duplicate links for the same product+user.
  const existing = db
    .prepare('SELECT * FROM affiliate_links WHERE user_id = ? AND product_id = ?')
    .get(userId, productId);
  const baseUrl = req.headers.origin || `${req.protocol}://${req.get('host')}`;
  if (existing) {
    return res.json({
      linkCode: existing.link_code,
      affiliateLink: `${baseUrl}/product/${productId}?ref=${existing.link_code}`,
    });
  }

  // Generate a unique, collision-safe link code.
  let linkCode;
  let unique = false;
  while (!unique) {
    linkCode = `AFF${Date.now()}${Math.floor(Math.random() * 100000)}`;
    const clash = db.prepare('SELECT id FROM affiliate_links WHERE link_code = ?').get(linkCode);
    unique = !clash;
  }

  db.prepare('INSERT INTO affiliate_links (user_id, product_id, link_code) VALUES (?, ?, ?)').run(
    userId,
    productId,
    linkCode
  );

  res.json({
    linkCode,
    affiliateLink: `${baseUrl}/product/${productId}?ref=${linkCode}`,
  });
});

app.get('/api/v1/affiliate/assets', authenticateToken, (req, res) => {
  const { productId } = req.query;
  if (!productId) {
    return res.status(400).json({ error: 'Product ID is required' });
  }

  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }

  res.json({
    productId: product.id,
    assets: [
      { type: 'banner', url: product.image_url, dimensions: '728x90' },
      { type: 'square', url: product.image_url, dimensions: '300x300' },
      { type: 'text', content: `Earn ${product.commission}% commission on ${product.title}!` },
    ],
  });
});

// ===========================================================================
// Health & API docs
// ===========================================================================
app.get('/api/v1/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.get('/api-docs', (req, res) => {
  res.json({
    title: 'Affiliate Hub API',
    version: '1.0.0',
    endpoints: {
      auth: {
        login: 'POST /api/v1/auth/login',
        signup: 'POST /api/v1/auth/signup',
        socialAuth: 'POST /api/v1/auth/social-auth',
        refreshToken: 'POST /api/v1/auth/refresh-token',
      },
      products: {
        list: 'GET /api/v1/products',
        detail: 'GET /api/v1/products/:id',
        search: 'GET /api/v1/products/search',
        categories: 'GET /api/v1/products/categories',
      },
      wallet: {
        balance: 'GET /api/v1/wallet/balance',
        transactions: 'GET /api/v1/wallet/transactions',
        withdraw: 'POST /api/v1/wallet/withdraw',
        withdrawMethods: 'GET /api/v1/wallet/withdraw-methods',
      },
      stats: {
        dashboard: 'GET /api/v1/stats/dashboard',
        performance: 'GET /api/v1/stats/performance',
        leaderboard: 'GET /api/v1/stats/leaderboard',
      },
      profile: {
        get: 'GET /api/v1/profile',
        update: 'PUT /api/v1/profile/update',
        bankDetails: 'PUT /api/v1/profile/bank-details',
        security: 'PUT /api/v1/profile/security',
      },
      affiliate: {
        links: 'GET /api/v1/affiliate/links',
        generateLink: 'POST /api/v1/affiliate/generate-link',
        assets: 'GET /api/v1/affiliate/assets',
      },
      health: 'GET /api/v1/health',
    },
  });
});

// Start server (exported for testing)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
    console.log(`API documentation: http://localhost:${PORT}/api-docs`);
  });
}

module.exports = app;
