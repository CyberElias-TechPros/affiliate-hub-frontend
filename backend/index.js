require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-here';

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Database setup
const db = new sqlite3.Database('./affiliate-hub.db', (err) => {
  if (err) {
    console.error('Database connection error:', err.message);
  } else {
    console.log('Connected to SQLite database.');
    initializeDatabase();
  }
});

// Initialize database with tables
function initializeDatabase() {
  db.serialize(() => {
    // Users table
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        whatsapp TEXT,
        country TEXT DEFAULT 'NG',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Products table
    db.run(`
      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        price REAL NOT NULL,
        commission REAL NOT NULL,
        category TEXT,
        image_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Affiliate links table
    db.run(`
      CREATE TABLE IF NOT EXISTS affiliate_links (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        link_code TEXT UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (product_id) REFERENCES products(id)
      )
    `);

    // Transactions table
    db.run(`
      CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        amount REAL NOT NULL,
        type TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

    // Profile table
    db.run(`
      CREATE TABLE IF NOT EXISTS profile (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER UNIQUE NOT NULL,
        bio TEXT,
        phone TEXT,
        address TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

    // Bank details table
    db.run(`
      CREATE TABLE IF NOT EXISTS bank_details (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER UNIQUE NOT NULL,
        bank_name TEXT,
        account_name TEXT,
        account_number TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

    // Stats table
    db.run(`
      CREATE TABLE IF NOT EXISTS stats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        clicks INTEGER DEFAULT 0,
        conversions INTEGER DEFAULT 0,
        earnings REAL DEFAULT 0,
        date TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

    // Seed some sample data
    seedSampleData();
  });
}

// Seed sample data
function seedSampleData() {
  // Check if we already have data
  db.get('SELECT COUNT(*) as count FROM users', (err, row) => {
    if (err || row.count > 0) return;

    // Seed users
    const users = [
      { name: 'Chinedu Nwankwo', email: 'chinedu@example.com', password: bcrypt.hashSync('password123', 10) },
      { name: 'Amaka Udo', email: 'amaka@example.com', password: bcrypt.hashSync('password123', 10) },
    ];

    users.forEach(user => {
      db.run('INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
        [user.name, user.email, user.password]);
    });

    // Seed products
    const products = [
      {
        title: 'Premium Forex Trading Course',
        description: 'Complete forex trading course for beginners to advanced traders',
        price: 150000,
        commission: 45,
        category: 'Digital',
        image_url: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=400&h=400&fit=crop'
      },
      {
        title: 'Smart Fitness Watch Pro',
        description: 'Advanced fitness tracker with heart rate monitoring',
        price: 45000,
        commission: 25,
        category: 'Tech',
        image_url: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&h=400&fit=crop'
      },
      {
        title: 'Organic Skincare Set',
        description: 'Complete organic skincare routine with natural ingredients',
        price: 28000,
        commission: 30,
        category: 'Beauty',
        image_url: 'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=400&h=400&fit=crop'
      }
    ];

    products.forEach(product => {
      db.run(
        'INSERT INTO products (title, description, price, commission, category, image_url) VALUES (?, ?, ?, ?, ?, ?)',
        [product.title, product.description, product.price, product.commission, product.category, product.image_url]
      );
    });

    console.log('Database seeded with sample data.');
  });
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

// API Routes

// Auth routes
app.post('/api/v1/auth/login', (req, res) => {
  const { email, password } = req.body;

  db.get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
    if (err || !user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    bcrypt.compare(password, user.password, (err, result) => {
      if (err || !result) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const token = jwt.sign(
        { id: user.id, email: user.email, name: user.name },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      res.json({
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          whatsapp: user.whatsapp,
          country: user.country
        }
      });
    });
  });
});

app.post('/api/v1/auth/signup', (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required' });
  }

  const hashedPassword = bcrypt.hashSync(password, 10);

  db.run(
    'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
    [name, email, hashedPassword],
    function(err) {
      if (err) {
        if (err.code === 'SQLITE_CONSTRAINT') {
          return res.status(400).json({ error: 'Email already exists' });
        }
        return res.status(500).json({ error: 'Database error' });
      }

      const token = jwt.sign(
        { id: this.lastID, email, name },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      res.status(201).json({
        token,
        user: {
          id: this.lastID,
          name,
          email,
          whatsapp: null,
          country: 'NG'
        }
      });
    }
  );
});

app.post('/api/v1/auth/social-auth', (req, res) => {
  const { provider, token } = req.body;

  // In a real implementation, verify the token with the social provider
  // For this demo, we'll create a user if they don't exist
  const email = `${provider}_${Date.now()}@example.com`;
  const name = `${provider}_user`;

  db.get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    if (user) {
      const token = jwt.sign(
        { id: user.id, email: user.email, name: user.name },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      return res.json({
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          whatsapp: user.whatsapp,
          country: user.country
        }
      });
    }

    // Create new user
    db.run(
      'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
      [name, email, bcrypt.hashSync(Math.random().toString(36).slice(-8), 10)],
      function(err) {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }

        const token = jwt.sign(
          { id: this.lastID, email, name },
          JWT_SECRET,
          { expiresIn: '24h' }
        );

        res.status(201).json({
          token,
          user: {
            id: this.lastID,
            name,
            email,
            whatsapp: null,
            country: 'NG'
          }
        });
      }
    );
  });
});

app.post('/api/v1/auth/refresh-token', (req, res) => {
  const { refreshToken } = req.body;

  // In a real implementation, verify the refresh token
  // For this demo, we'll just issue a new token
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

// Product routes
app.get('/api/v1/products', (req, res) => {
  const { category, sort } = req.query;
  
  let query = 'SELECT * FROM products';
  const params = [];
  
  if (category) {
    query += ' WHERE category = ?';
    params.push(category);
  }
  
  // Add sorting
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
 
  db.all(query, params, (err, products) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    } 
    
    // Calculate commission amount for each product
    const productsWithCommission = products.map(product => ({
      ...product,
      commissionAmount: product.price * (product.commission / 100)
    }));
    
    res.json(productsWithCommission);
  });
});

app.get('/api/v1/products/:id', (req, res) => {
  const { id } = req.params;

  db.get('SELECT * FROM products WHERE id = ?', [id], (err, product) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    } 
    
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    } 
    
    // Add calculated fields
    const productWithDetails = {
      ...product,
      commissionAmount: product.price * (product.commission / 100),
      whyPromote: [
        `High conversion rate`,
        `30-day cookie duration`,
        `Recurring commissions on upsells`,
        `Professional marketing materials`,
        `Dedicated affiliate support`
      ],
      promoAssets: [
        product.image_url,
        product.image_url
      ]
    };
    
    res.json(productWithDetails);
  });
});

app.get('/api/v1/products/search', (req, res) => {
  const { q } = req.query;

  if (!q) {
    return res.status(400).json({ error: 'Search query is required' });
  }

  const query = 'SELECT * FROM products WHERE title LIKE ? OR description LIKE ?';
  const params = [`%${q}%`, `%${q}%`];

  db.all(query, params, (err, products) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    // Calculate commission amount for each product
    const productsWithCommission = products.map(product => ({
      ...product,
      commissionAmount: product.price * (product.commission / 100)
    }));

    res.json(productsWithCommission);
  });
});

app.get('/api/v1/products/categories', (req, res) => {
  db.all('SELECT DISTINCT category FROM products WHERE category IS NOT NULL', (err, categories) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    } 
    
    const categoryList = categories.map(c => c.category);
    res.json(categoryList);
  });
});

// Wallet routes
app.get('/api/v1/wallet/balance', authenticateToken, (req, res) => {
  const userId = req.user.id;

  // Calculate balance from transactions
  db.all(
    'SELECT SUM(CASE WHEN type = "credit" THEN amount ELSE -amount END) as balance FROM transactions WHERE user_id = ?',
    [userId],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      } 
      
      const balance = rows[0].balance || 0;
      
      res.json({
        ngnBalance: balance,
        usdBalance: Math.round(balance / 450) // Simple conversion for demo
      });
    }
  );
});

app.get('/api/v1/wallet/transactions', authenticateToken, (req, res) => {
  const userId = req.user.id;
  const { limit = 10, page = 1 } = req.query;
  
  const offset = (page - 1) * limit;

  db.all(
    'SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
    [userId, limit, offset],
    (err, transactions) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      } 
      
      res.json(transactions);
    }
  );
});

app.post('/api/v1/wallet/withdraw', authenticateToken, (req, res) => {
  const userId = req.user.id;
  const { amount, method, details } = req.body;

  if (!amount || !method) {
    return res.status(400).json({ error: 'Amount and method are required' });
  }

  // Check if user has sufficient balance
  db.get(
    'SELECT SUM(CASE WHEN type = "credit" THEN amount ELSE -amount END) as balance FROM transactions WHERE user_id = ?',
    [userId],
    (err, row) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      const balance = row.balance || 0;
      if (balance < amount) {
        return res.status(400).json({ error: 'Insufficient balance' });
      }

      // Record the withdrawal transaction
      db.run(
        'INSERT INTO transactions (user_id, amount, type, status, description) VALUES (?, ?, ?, ?, ?)',
        [userId, amount, 'debit', 'pending', `Withdrawal via ${method}`],
        function(err) {
          if (err) {
            return res.status(500).json({ error: 'Database error' });
          }

          res.json({
            message: 'Withdrawal request submitted successfully',
            transactionId: this.lastID
          });
        }
      );
    }
  );
});

app.get('/api/v1/wallet/withdraw-methods', authenticateToken, (req, res) => {
  // Return available withdrawal methods
  res.json([
    { id: 'bank', name: 'Bank Transfer', description: 'Direct bank transfer' },
    { id: 'paypal', name: 'PayPal', description: 'PayPal transfer' },
    { id: 'crypto', name: 'Cryptocurrency', description: 'Crypto transfer' }
  ]);
});

// Stats routes
app.get('/api/v1/stats/dashboard', authenticateToken, (req, res) => {
  const userId = req.user.id;

  // Get basic stats
  db.get(
    'SELECT SUM(clicks) as totalClicks, SUM(conversions) as totalConversions, SUM(earnings) as totalEarnings FROM stats WHERE user_id = ?',
    [userId],
    (err, row) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      res.json({
        totalClicks: row.totalClicks || 0,
        totalConversions: row.totalConversions || 0,
        totalEarnings: row.totalEarnings || 0,
        conversionRate: row.totalClicks ? Math.round((row.totalConversions / row.totalClicks) * 100) : 0
      });
    }
  );
});

app.get('/api/v1/stats/performance', authenticateToken, (req, res) => {
  const userId = req.user.id;
  const { period = 'month' } = req.query;

  let dateCondition = '';
  switch (period) {
    case 'week':
      dateCondition = 'AND date >= date(\'now\', \'-7 days\')';
      break;
    case 'month':
      dateCondition = 'AND date >= date(\'now\', \'-30 days\')';
      break;
    case 'year':
      dateCondition = 'AND date >= date(\'now\', \'-1 year\')';
      break;
  }

  db.all(
    `SELECT date, clicks, conversions, earnings FROM stats WHERE user_id = ? ${dateCondition} ORDER BY date DESC`,
    [userId],
    (err, stats) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      res.json(stats);
    }
  );
});

app.get('/api/v1/stats/leaderboard', authenticateToken, (req, res) => {
  const { limit = 10 } = req.query;

  db.all(
    `SELECT u.id, u.name, SUM(s.earnings) as totalEarnings 
     FROM users u 
     LEFT JOIN stats s ON u.id = s.user_id 
     GROUP BY u.id 
     ORDER BY totalEarnings DESC 
     LIMIT ?`,
    [limit],
    (err, leaderboard) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      res.json(leaderboard);
    }
  );
});

// Profile routes
app.get('/api/v1/profile', authenticateToken, (req, res) => {
  const userId = req.user.id;

  db.get('SELECT * FROM users WHERE id = ?', [userId], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      whatsapp: user.whatsapp,
      country: user.country,
      created_at: user.created_at
    });
  });
});

app.put('/api/v1/profile/update', authenticateToken, (req, res) => {
  const userId = req.user.id;
  const { name, whatsapp, country } = req.body;

  db.run(
    'UPDATE users SET name = ?, whatsapp = ?, country = ? WHERE id = ?',
    [name, whatsapp, country, userId],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      res.json({ message: 'Profile updated successfully' });
    }
  );
});

app.put('/api/v1/profile/bank-details', authenticateToken, (req, res) => {
  const userId = req.user.id;
  const { bank_name, account_name, account_number } = req.body;

  db.run(
    'INSERT OR REPLACE INTO bank_details (user_id, bank_name, account_name, account_number) VALUES (?, ?, ?, ?)',
    [userId, bank_name, account_name, account_number],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      res.json({ message: 'Bank details updated successfully' });
    }
  );
});

app.put('/api/v1/profile/security', authenticateToken, (req, res) => {
  const userId = req.user.id;
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current and new passwords are required' });
  }

  db.get('SELECT password FROM users WHERE id = ?', [userId], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    bcrypt.compare(currentPassword, user.password, (err, result) => {
      if (err || !result) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }

      const hashedPassword = bcrypt.hashSync(newPassword, 10);

      db.run(
        'UPDATE users SET password = ? WHERE id = ?',
        [hashedPassword, userId],
        function(err) {
          if (err) {
            return res.status(500).json({ error: 'Database error' });
          }

          res.json({ message: 'Password updated successfully' });
        }
      );
    });
  });
});

// Affiliate routes
app.get('/api/v1/affiliate/links', authenticateToken, (req, res) => {
  const userId = req.user.id;

  db.all(
    'SELECT al.id, al.product_id, al.link_code, al.created_at, p.title as product_title FROM affiliate_links al JOIN products p ON al.product_id = p.id WHERE al.user_id = ?',
    [userId],
    (err, links) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      res.json(links);
    }
  );
});

app.post('/api/v1/affiliate/generate-link', authenticateToken, (req, res) => {
  const userId = req.user.id;
  const { productId } = req.body;

  if (!productId) {
    return res.status(400).json({ error: 'Product ID is required' });
  }

  // Generate a unique link code
  const linkCode = `AFF${Date.now()}${Math.floor(Math.random() * 1000)}`;

  db.run(
    'INSERT INTO affiliate_links (user_id, product_id, link_code) VALUES (?, ?, ?)',
    [userId, productId, linkCode],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      res.json({
        linkCode,
        affiliateLink: `${req.headers.origin}/products/${productId}?ref=${linkCode}`
      });
    }
  );
});

app.get('/api/v1/affiliate/assets', authenticateToken, (req, res) => {
  const { productId } = req.query;

  if (!productId) {
    return res.status(400).json({ error: 'Product ID is required' });
  }

  db.get('SELECT * FROM products WHERE id = ?', [productId], (err, product) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json({
      productId: product.id,
      assets: [
        {
          type: 'banner',
          url: product.image_url,
          dimensions: '728x90'
        },
        {
          type: 'square',
          url: product.image_url,
          dimensions: '300x300'
        },
        {
          type: 'text',
          content: `Earn ${product.commission}% commission on ${product.title}!`
        }
      ]
    });
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
  console.log(`API documentation: http://localhost:${PORT}/api-docs`);
});

// Simple API documentation endpoint
app.get('/api-docs', (req, res) => {
  res.json({
    title: 'Affiliate Hub API',
    version: '1.0.0',
    endpoints: {
      auth: {
        login: 'POST /api/v1/auth/login',
        signup: 'POST /api/v1/auth/signup',
        socialAuth: 'POST /api/v1/auth/social-auth',
        refreshToken: 'POST /api/v1/auth/refresh-token'
      },
      products: {
        list: 'GET /api/v1/products',
        detail: 'GET /api/v1/products/:id',
        search: 'GET /api/v1/products/search',
        categories: 'GET /api/v1/products/categories'
      },
      wallet: {
        balance: 'GET /api/v1/wallet/balance',
        transactions: 'GET /api/v1/wallet/transactions',
        withdraw: 'POST /api/v1/wallet/withdraw',
        withdrawMethods: 'GET /api/v1/wallet/withdraw-methods'
      },
      stats: {
        dashboard: 'GET /api/v1/stats/dashboard',
        performance: 'GET /api/v1/stats/performance',
        leaderboard: 'GET /api/v1/stats/leaderboard'
      },
      profile: {
        get: 'GET /api/v1/profile',
        update: 'PUT /api/v1/profile/update',
        bankDetails: 'PUT /api/v1/profile/bank-details',
        security: 'PUT /api/v1/profile/security'
      },
      affiliate: {
        links: 'GET /api/v1/affiliate/links',
        generateLink: 'POST /api/v1/affiliate/generate-link',
        assets: 'GET /api/v1/affiliate/assets'
      }
    }
  });
});