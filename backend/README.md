# Affiliate Hub Backend - Simple Implementation

This is a simple backend implementation for the Affiliate Hub project using Node.js, Express, and SQLite. It's designed to be easy to set up and run with minimal configuration.

## Features

- **Authentication**: JWT-based auth with login/signup
- **Product Management**: CRUD operations for products
- **Wallet System**: Balance and transaction tracking
- **SQLite Database**: Simple file-based database (no separate server needed)
- **RESTful API**: Clean, well-structured endpoints

## Quick Start

### Prerequisites

- Node.js (v14 or later)
- npm or yarn

### Installation

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file (or use the provided one):
   ```bash
   cp .env.example .env
   ```

4. Start the server:
   ```bash
   npm start
   ```

   For development with auto-restart:
   ```bash
   npm run dev
   ```

The server will start on `http://localhost:3001`

## API Endpoints

### Authentication

- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/signup` - User registration

### Products

- `GET /api/v1/products` - List all products
- `GET /api/v1/products/:id` - Get product details
- `GET /api/v1/products/categories` - List product categories

### Wallet

- `GET /api/v1/wallet/balance` - Get user balance (requires auth)
- `GET /api/v1/wallet/transactions` - Get transaction history (requires auth)

## Database

The backend uses SQLite, which stores data in a single file (`affiliate-hub.db`). No separate database server is required.

### Database Schema

- **users**: Stores user accounts
- **products**: Stores product information
- **affiliate_links**: Tracks affiliate links
- **transactions**: Records financial transactions

## Connecting the Frontend

Update the frontend's API configuration to point to this backend:

```javascript
// In src/lib/api.ts
const API_BASE_URL = 'http://localhost:3001/api/v1';
```

## Testing the API

You can test the API using:

1. **API Documentation**: `http://localhost:3001/api-docs`
2. **Postman/Insomnia**: Import the API endpoints
3. **cURL**: Example requests

### Example cURL Requests

**Login:**
```bash
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"chinedu@example.com","password":"password123"}'
```

**Get Products:**
```bash
curl http://localhost:3001/api/v1/products
```

**Get Product Detail:**
```bash
curl http://localhost:3001/api/v1/products/1
```

## Deployment

For production deployment:

1. Use a proper JWT secret (not the default)
2. Set up proper CORS configuration
3. Implement rate limiting
4. Use HTTPS
5. Consider using PostgreSQL instead of SQLite for production

## Next Steps

1. **Extend the API**: Add more endpoints as needed
2. **Add Validation**: Implement more robust input validation
3. **Add Tests**: Write unit and integration tests
4. **Add Monitoring**: Implement logging and monitoring
5. **Scale**: Consider using PostgreSQL for production

## Troubleshooting

- **Database not created**: Make sure the backend has write permissions in the directory
- **Port conflict**: Change the PORT in .env if 3001 is already in use
- **CORS issues**: Ensure the frontend is configured to connect to the correct backend URL

## License

This project is open source and available under the ISC License.