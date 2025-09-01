# Xeno API Server

A comprehensive Node.js Express server with PostgreSQL database, user authentication, and Swagger documentation.

## Features

- 🔐 **User Authentication**: Signup, login, JWT token-based authentication
- 👤 **User Management**: CRUD operations for users, profile management
- 📚 **Database Integration**: PostgreSQL with automatic table creation
- 📖 **API Documentation**: Interactive Swagger UI documentation
- 🚀 **Express Server**: Fast and scalable REST API
- 🔒 **Security**: Password hashing, JWT tokens, input validation

## Database Schema

The server automatically creates the following tables based on your schema:

- **User**: User accounts with authentication
- **Books**: User's book collection
- **Pages**: Book pages with URLs
- **Category**: Content categories
- **Model**: AI models
- **Prompting**: AI prompts
- **Explanation**: AI explanations for content
- **Quizzes**: User quiz results
- **Questions**: Quiz questions and answers

## Prerequisites

- Node.js (v14 or higher)
- PostgreSQL database (Supabase in this case)
- npm or yarn package manager

## Installation

1. **Clone the repository and install dependencies:**

   ```bash
   npm install
   ```

2. **Database Configuration:**
   The database connection is already configured in `server/db.js` with your Supabase credentials.

3. **Install additional dependencies:**
   ```bash
   npm install jsonwebtoken swagger-jsdoc swagger-ui-express
   ```

## Running the Server

### Development Mode

```bash
npm run dev
```

### Production Mode

```bash
npm start
```

The server will start on port 5000 and automatically:

- Connect to your PostgreSQL database
- Create/verify all required tables
- Start the Express server
- Initialize Swagger documentation

## API Endpoints

### Authentication

- `POST /api/users/signup` - User registration
- `POST /api/users/login` - User login

### User Management

- `GET /api/users/profile` - Get user profile (authenticated)
- `PUT /api/users/profile` - Update user profile (authenticated)
- `GET /api/users` - Get all users (authenticated, paginated)
- `GET /api/users/:userId` - Get user by ID (authenticated)
- `DELETE /api/users/:userId` - Delete user (authenticated)
- `POST /api/users/change-password` - Change password (authenticated)

### System

- `GET /` - Server information
- `GET /api/health` - Health check
- `GET /api/db-test` - Database connection test
- `GET /api-docs` - Swagger API documentation

## API Documentation

Once the server is running, visit `http://localhost:5000/api-docs` to access the interactive Swagger documentation.

## Authentication

The API uses JWT (JSON Web Tokens) for authentication:

1. **Signup/Login**: Get a JWT token
2. **Protected Routes**: Include the token in the Authorization header:
   ```
   Authorization: Bearer <your-jwt-token>
   ```

## Example Usage

### User Registration

```bash
curl -X POST http://localhost:5000/api/users/signup \
  -H "Content-Type: application/json" \
  -d '{
    "UserName": "John Doe",
    "Email": "john@example.com",
    "Password": "password123",
    "Phone": "+1234567890"
  }'
```

### User Login

```bash
curl -X POST http://localhost:5000/api/users/login \
  -H "Content-Type: application/json" \
  -d '{
    "Email": "john@example.com",
    "Password": "password123"
  }'
```

### Get Profile (Authenticated)

```bash
curl -X GET http://localhost:5000/api/users/profile \
  -H "Authorization: Bearer <your-jwt-token>"
```

### Update Profile

```bash
curl -X PUT http://localhost:5000/api/users/profile \
  -H "Authorization: Bearer <your-jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "UserName": "John Smith",
    "Phone": "+1987654321"
  }'
```

## Database Initialization

The server automatically initializes the database on startup. If you need to manually initialize:

```bash
node server/init-db.js
```

## Environment Variables

You can set the following environment variables:

- `JWT_SECRET`: Secret key for JWT tokens (defaults to a development key)
- `PORT`: Server port (defaults to 5000)

## Security Features

- **Password Hashing**: Uses PBKDF2 with salt for secure password storage
- **JWT Tokens**: Secure authentication with configurable expiration
- **Input Validation**: Comprehensive validation for all user inputs
- **SQL Injection Protection**: Uses parameterized queries
- **Rate Limiting**: Built-in protection against abuse

## Error Handling

The API returns consistent error responses:

```json
{
  "status": "error",
  "message": "Error description",
  "error": "Detailed error information"
}
```

## Success Responses

Successful operations return:

```json
{
  "status": "success",
  "message": "Operation description",
  "data": {
    // Response data
  }
}
```

## Development

### Project Structure

```
server/
├── index.js          # Main server file
├── db.js            # Database configuration
├── init-db.js       # Database initialization
├── swagger.js       # Swagger configuration
├── utils/
│   └── auth.js      # Authentication utilities
└── routes/
    └── users.js     # User management routes
```

### Adding New Routes

1. Create a new route file in `server/routes/`
2. Import and use it in `server/index.js`
3. Add Swagger documentation using JSDoc comments

## Troubleshooting

### Common Issues

1. **Database Connection Failed**

   - Check your database credentials in `server/db.js`
   - Ensure your Supabase database is accessible

2. **Port Already in Use**

   - Change the PORT variable in `server/index.js`
   - Or kill the process using port 5000

3. **JWT Token Issues**
   - Check if the token is expired
   - Ensure the Authorization header format is correct

### Logs

The server provides detailed console logging for:

- Database connection status
- Server startup process
- API requests and responses
- Error details

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For support and questions:

- Check the API documentation at `/api-docs`
- Review the server logs for error details
- Ensure all dependencies are properly installed
