# 📚 Books API - PDF Processing & Management

This API allows users to upload PDF documents, automatically extract book information using AI, and manage their digital book collection.

## 🚀 Features

- **PDF Upload & Processing**: Convert PDFs to high-quality images
- **AI-Powered Book Detection**: Extract book name and author using Gemini AI
- **OCR Text Extraction**: Read text from book cover pages
- **Cloud Storage**: Store all images in Cloudinary
- **Automatic Page Management**: Create individual page records with URLs
- **User Authentication**: Secure access to user's personal book collection

## 🔧 Technical Stack

- **PDF Processing**: pdf-poppler for PDF to image conversion
- **OCR**: Tesseract.js for text extraction
- **AI Analysis**: Google Gemini AI for book information extraction
- **Cloud Storage**: Cloudinary for image hosting
- **Database**: PostgreSQL with automatic table creation
- **Authentication**: JWT-based user authentication

## 📋 API Endpoints

### 1. Create Book from PDF

```
POST /api/books/create
```

**Description**: Upload a PDF file to create a new book with automatic processing

**Authentication**: Required (Bearer token)

**Request Body**: `multipart/form-data`

- `pdfFile`: PDF file (max 50MB)

**Response**:

```json
{
  "status": "success",
  "message": "Book created successfully",
  "data": {
    "book": {
      "BookId": 1,
      "Name": "The Great Gatsby",
      "author": "F. Scott Fitzgerald",
      "created_at": "2024-01-01T00:00:00Z",
      "uploaded_at": "2024-01-01T00:00:00Z",
      "totalPages": 180
    },
    "pages": [
      {
        "PageId": 1,
        "pageNumber": 1,
        "pageURL": "https://res.cloudinary.com/.../page-1.jpg"
      }
    ],
    "processingInfo": {
      "extractedText": {
        "bookName": "The Great Gatsby",
        "authorName": "F. Scott Fitzgerald"
      },
      "imagesGenerated": 180
    }
  }
}
```

### 2. Get User's Books

```
GET /api/books?page=1&limit=10
```

**Description**: Retrieve all books for the authenticated user

**Authentication**: Required (Bearer token)

**Query Parameters**:

- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10)

### 3. Get Book Details

```
GET /api/books/{bookId}
```

**Description**: Get detailed information about a specific book with all pages

**Authentication**: Required (Bearer token)

### 4. Get Book Pages

```
GET /api/books/{bookId}/pages
```

**Description**: Get all pages for a specific book

**Authentication**: Required (Bearer token)

### 5. Delete Book

```
DELETE /api/books/{bookId}
```

**Description**: Delete a book and all its associated pages

**Authentication**: Required (Bearer token)

## 🔄 PDF Processing Workflow

1. **PDF Upload**: User uploads PDF file via multipart form
2. **Image Conversion**: PDF converted to high-quality JPG images (300 DPI)
3. **OCR Processing**: Extract text from first page (cover) using Tesseract
4. **AI Analysis**: Use Gemini AI to analyze text and extract book information
5. **Cloud Storage**: Upload all images to Cloudinary with organized folder structure
6. **Database Creation**: Create book record and individual page records
7. **Cleanup**: Remove temporary files and uploaded PDF

## 📁 File Structure

```
server/
├── utils/
│   └── pdfProcessor.js    # PDF processing utilities
├── routes/
│   └── books.js          # Book management routes
├── uploads/              # Temporary PDF uploads
└── temp/                 # Temporary processing files
```

## 🛠️ Setup Requirements

### 1. Install Dependencies

```bash
npm install multer pdf-poppler tesseract.js @google/generative-ai cloudinary
```

### 2. System Requirements

- **pdf-poppler**: Requires system installation of poppler-utils
- **Tesseract**: Requires system installation of Tesseract OCR

### 3. Environment Configuration

Ensure these are set in `server/db.js`:

- `CLOUDINARY_URL`: Cloudinary connection string
- `GEMINI_API_KEY`: Google Gemini AI API key

## 🔐 Authentication

All book endpoints require JWT authentication:

```bash
# Get token from login/signup
curl -X POST /api/users/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "password"}'

# Use token for book operations
curl -X POST /api/books/create \
  -H "Authorization: Bearer <your-jwt-token>" \
  -F "pdfFile=@book.pdf"
```

## 📊 Database Schema

### Books Table

```sql
CREATE TABLE "Books" (
  "BookId" BIGSERIAL PRIMARY KEY,
  "created_at" TIMESTAMPTZ DEFAULT NOW(),
  "Name" VARCHAR(255) NOT NULL,
  "author" VARCHAR(255),
  "uploaded_at" TIMESTAMP DEFAULT NOW(),
  "lastopened_at" TIMESTAMP DEFAULT NOW(),
  "UserId" BIGINT REFERENCES "User"("UserId") ON DELETE CASCADE
);
```

### Pages Table

```sql
CREATE TABLE "Pages" (
  "PageId" BIGSERIAL PRIMARY KEY,
  "pageNumber" BIGINT NOT NULL,
  "pageURL" VARCHAR(500),
  "BookId" BIGINT REFERENCES "Books"("BookId") ON DELETE CASCADE
);
```

## 🧪 Testing

### 1. Test PDF Processing

```bash
node test-pdf.js
```

### 2. Test API Endpoints

Use the Swagger documentation at `/api-docs` to test all endpoints interactively.

### 3. Sample API Calls

```bash
# Create book
curl -X POST http://localhost:5000/api/books/create \
  -H "Authorization: Bearer <token>" \
  -F "pdfFile=@sample.pdf"

# Get books
curl -X GET http://localhost:5000/api/books \
  -H "Authorization: Bearer <token>"

# Get book details
curl -X GET http://localhost:5000/api/books/1 \
  -H "Authorization: Bearer <token>"
```

## ⚠️ Important Notes

1. **File Size Limit**: PDFs are limited to 50MB
2. **Processing Time**: Large PDFs may take several minutes to process
3. **Internet Required**: Gemini AI and Cloudinary require internet connection
4. **Temporary Storage**: Files are temporarily stored during processing
5. **Cleanup**: Temporary files are automatically cleaned up after processing

## 🚨 Error Handling

The API provides comprehensive error handling:

- **File Validation**: Checks file type and size
- **Processing Errors**: Handles PDF conversion failures
- **AI Errors**: Manages Gemini AI API failures
- **Upload Errors**: Handles Cloudinary upload issues
- **Database Errors**: Manages transaction failures with rollback

## 🔒 Security Features

- **File Type Validation**: Only PDF files allowed
- **User Isolation**: Users can only access their own books
- **Authentication Required**: All endpoints protected
- **File Size Limits**: Prevents abuse
- **Automatic Cleanup**: Removes temporary files

## 📈 Performance Considerations

- **Image Quality**: 300 DPI for optimal OCR results
- **Parallel Processing**: Multiple images uploaded simultaneously
- **Database Transactions**: Ensures data consistency
- **Memory Management**: Automatic cleanup of temporary files
- **Connection Pooling**: Efficient database connections

## 🆘 Troubleshooting

### Common Issues

1. **PDF Conversion Fails**

   - Ensure poppler-utils is installed
   - Check PDF file integrity
   - Verify file permissions

2. **OCR Text Extraction Fails**

   - Ensure Tesseract is installed
   - Check image quality
   - Verify language support

3. **Gemini AI Fails**

   - Check API key validity
   - Verify internet connection
   - Check API quota limits

4. **Cloudinary Upload Fails**
   - Verify Cloudinary credentials
   - Check internet connection
   - Verify account limits

### Debug Mode

Enable detailed logging by setting environment variables:

```bash
DEBUG=pdf-processor npm start
```

## 🔮 Future Enhancements

- **Batch Processing**: Upload multiple PDFs simultaneously
- **Progress Tracking**: Real-time processing status updates
- **Image Optimization**: Automatic image compression
- **Text Search**: Full-text search across book content
- **Book Metadata**: Enhanced book information extraction
- **Export Options**: Download processed books in various formats
