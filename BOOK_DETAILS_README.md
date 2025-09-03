# Book Details API Endpoint

## 📚 Overview

The book details functionality has been separated into its own dedicated route file (`server/routes/bookDetails.js`) for better organization and maintainability.

## 🚀 Endpoints

### 1. **GET `/api/books/{bookId}`** - Full Book Details with Pages

Retrieves complete book information including all pages.

**Response:**

```json
{
  "status": "success",
  "data": {
    "book": {
      "BookId": 123,
      "Name": "The Great Gatsby",
      "author": "F. Scott Fitzgerald",
      "created_at": "2024-01-15T10:30:00Z",
      "uploaded_at": "2024-01-15T10:30:00Z",
      "lastopened_at": "2024-01-15T11:00:00Z"
    },
    "pages": [
      {
        "PageId": 1,
        "pageNumber": 1,
        "pageURL": "https://res.cloudinary.com/...",
        "cloudinaryId": "cloudinary_asset_id_1"
      }
    ],
    "totalPages": 1
  }
}
```

### 2. **GET `/api/books/{bookId}/summary`** - Book Summary (Fast)

Retrieves book information without pages for faster response times.

**Response:**

```json
{
  "status": "success",
  "data": {
    "book": {
      "BookId": 123,
      "Name": "The Great Gatsby",
      "author": "F. Scott Fitzgerald",
      "created_at": "2024-01-15T10:30:00Z",
      "uploaded_at": "2024-01-15T10:30:00Z",
      "lastopened_at": "2024-01-15T11:00:00Z",
      "totalPages": 1
    }
  }
}
```

## 🔧 Features

- **Authentication Required**: JWT token validation
- **User Isolation**: Users can only access their own books
- **Automatic Tracking**: Updates `lastopened_at` timestamp
- **Comprehensive Data**: Includes all page information
- **Performance Optimized**: Summary endpoint for quick access

## 📁 File Structure

```
server/
├── routes/
│   ├── books.js          # Main book operations (create, list, delete)
│   ├── bookDetails.js    # Book details and pages retrieval
│   └── users.js          # User management
├── index.js              # Main server with route registration
└── test-book-details.js  # Test script for the endpoint
```

## 🧪 Testing

Run the test script to verify the endpoint works:

```bash
cd server
node test-book-details.js
```

## 📱 Usage Examples

### Frontend JavaScript

```javascript
// Get full book details with pages
const getBookDetails = async (bookId, token) => {
  const response = await fetch(`/api/books/${bookId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return await response.json();
};

// Get book summary (faster)
const getBookSummary = async (bookId, token) => {
  const response = await fetch(`/api/books/${bookId}/summary`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return await response.json();
};
```

### cURL Examples

```bash
# Get full book details
curl -H "Authorization: Bearer YOUR_TOKEN" \
     http://localhost:5000/api/books/123

# Get book summary
curl -H "Authorization: Bearer YOUR_TOKEN" \
     http://localhost:5000/api/books/123/summary
```

## 🔒 Security

- **JWT Authentication**: All requests require valid token
- **User Authorization**: Users can only access their own books
- **Input Validation**: Book ID is parsed and validated
- **SQL Injection Protection**: Uses parameterized queries

## 📊 Database Queries

The endpoint performs these database operations:

1. **Book Lookup**: Verifies book exists and belongs to user
2. **Page Retrieval**: Gets all pages ordered by page number
3. **Timestamp Update**: Updates `lastopened_at` for tracking

## 🚀 Performance Tips

- Use `/summary` endpoint when you only need book metadata
- Use full endpoint when you need page information
- Consider pagination for books with many pages (future enhancement)
- Database indexes on `BookId` and `UserId` improve performance

## 🔄 Migration Notes

- The original book details endpoint has been moved from `books.js` to `bookDetails.js`
- All existing functionality is preserved
- The endpoint URL remains the same: `/api/books/{bookId}`
- Added new `/summary` endpoint for performance optimization
