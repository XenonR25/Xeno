# PDF Processor Integration Guide

This document explains how the functions from `test.js` have been integrated into the `books.js` API to provide comprehensive PDF processing capabilities.

## 🚀 What's Been Integrated

All the following functions from `test.js` are now available in the `books.js` API through `pdfProcessor.js`:

### Core OCR Functions
- `extractTextFromImageUrl()` - Extract text from images using OCR
- `extractBookInfo()` - Extract book name and author using Gemini AI
- `generateGenericBookInfo()` - Generate generic book info when specific info can't be extracted

### PDF Processing Functions
- `processPdfAndExtractInfo()` - Process PDF and extract book information
- `processPdfAndUploadPages()` - Process PDF and upload individual pages to Cloudinary
- `uploadPageToCloudinary()` - Upload individual page images with unique IDs
- `generatePageId()` - Generate unique page identifiers

### Utility Functions
- `downloadFile()` - Download files from URLs
- `buildPageImageUrl()` - Build Cloudinary URLs for specific pages
- `tryGeminiModels()` - Try multiple Gemini AI models with fallback

### Test Functions
- `testFirstPageOCR()` - Test OCR on first page of PDF
- `testOCRFromImageUrl()` - Test OCR from image URL
- `testOCROnLocalImage()` - Test OCR on local image files
- `testCloudinaryPageUpload()` - Test complete Cloudinary upload workflow
- `runAllTests()` - Run all test functions

## 📚 Enhanced Book Creation API

The main book creation endpoint (`POST /api/books/create`) now includes:

1. **Automatic OCR Processing** - Extracts text from the first page (cover)
2. **AI-Powered Book Info Extraction** - Uses Gemini AI to identify book name and author
3. **Fallback to Generic Names** - If specific info can't be extracted, generates meaningful names
4. **Individual Page Uploads** - Each page gets a unique ID and Cloudinary URL
5. **Local Image Storage** - Keeps local copies in `local_books` folder for user access
6. **Comprehensive Database Records** - Creates book and page records with all metadata

## 🧪 New Test Endpoints

### Test OCR Functionality
```http
POST /api/books/test/ocr
Content-Type: multipart/form-data

pdfFile: [PDF file]
```

**Response:**
```json
{
  "status": "success",
  "message": "OCR test completed successfully",
  "data": {
    "extractedText": "The Great Gatsby by F. Scott Fitzgerald...",
    "totalPages": 25,
    "imageUrl": "https://res.cloudinary.com/...",
    "cloudinaryInfo": {
      "publicId": "test_ocr/sample",
      "version": "1234567890",
      "folder": "test_ocr"
    }
  }
}
```

### Test Cloudinary Page Upload
```http
POST /api/books/test/cloudinary-upload
Content-Type: multipart/form-data

pdfFile: [PDF file]
```

**Response:**
```json
{
  "status": "success",
  "message": "Cloudinary upload test completed successfully",
  "data": {
    "bookInfo": {
      "bookName": "The Great Gatsby",
      "authorName": "F. Scott Fitzgerald"
    },
    "totalPages": 25,
    "localImagesPath": "local_books/1234567890",
    "originalPdfPublicId": "books/1234567890/sample",
    "originalPdfVersion": "1234567890",
    "pages": [
      {
        "pageNumber": 1,
        "pageId": "page_123_1_1234567890_abc123",
        "pageURL": "https://res.cloudinary.com/...",
        "cloudinaryId": "1234567890"
      }
    ]
  }
}
```

## 🔧 How to Use

### 1. Basic Book Creation
```javascript
// The existing API endpoint now has enhanced functionality
const response = await fetch('/api/books/create', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'multipart/form-data'
  },
  body: formData // Contains PDF file
});
```

### 2. Test Individual Functions
```javascript
// Import functions directly from pdfProcessor
const { 
  extractTextFromImageUrl, 
  extractBookInfo,
  testFirstPageOCR 
} = require('./utils/pdfProcessor.js');

// Test OCR on a PDF
const ocrResult = await testFirstPageOCR('./path/to/sample.pdf');

// Extract book info from text
const bookInfo = await extractBookInfo("The Great Gatsby by F. Scott Fitzgerald");
```

### 3. Run Integration Tests
```bash
# Test all integrated functionality
node server/test-integration.js

# Run the original test suite
node server/test.js
```

## 🗄️ Database Schema

The integration works with the existing database schema:

### Books Table
- `BookId` - Primary key
- `Name` - Book name (extracted or generated)
- `author` - Author name (extracted or generated)
- `UserId` - User who owns the book
- `created_at` - Creation timestamp
- `uploaded_at` - Upload timestamp
- `lastopened_at` - Last opened timestamp

### Pages Table
- `PageId` - Primary key
- `pageNumber` - Page number in the book
- `pageURL` - Cloudinary URL for the page image
- `uniquePageId` - Unique identifier for the page
- `cloudinaryId` - Cloudinary asset ID
- `BookId` - Foreign key to Books table

## 🔒 Security Features

- **Authentication Required** - All endpoints require valid JWT tokens
- **File Type Validation** - Only PDF files are accepted
- **File Size Limits** - 50MB maximum file size
- **User Isolation** - Users can only access their own books
- **Secure File Handling** - Temporary files are cleaned up after processing

## 🚨 Error Handling

The integration includes comprehensive error handling:

- **OCR Failures** - Falls back to generic book names
- **AI Processing Errors** - Graceful degradation with fallback methods
- **Cloudinary Upload Issues** - Detailed error reporting
- **Database Errors** - Transaction rollback and cleanup
- **File Processing Errors** - Automatic cleanup of temporary files

## 📁 File Structure

```
server/
├── utils/
│   └── pdfProcessor.js     # All integrated functions
├── routes/
│   └── books.js           # Enhanced API with all functions
├── test-integration.js    # Integration test suite
└── test.js               # Original test file (still functional)
```

## 🎯 Benefits of Integration

1. **Unified API** - All functionality accessible through one endpoint
2. **Better User Experience** - Automatic book info extraction
3. **Robust Fallbacks** - Multiple strategies for book identification
4. **Comprehensive Testing** - Built-in test endpoints for debugging
5. **Maintainable Code** - Centralized PDF processing logic
6. **Scalable Architecture** - Easy to add new features

## 🔄 Migration Notes

- **No Breaking Changes** - Existing API endpoints work as before
- **Enhanced Functionality** - New features are additive
- **Backward Compatible** - All existing client code continues to work
- **Optional Features** - New capabilities can be used incrementally

## 🚀 Next Steps

1. **Test the Integration** - Use the new test endpoints
2. **Update Client Code** - Take advantage of new features
3. **Monitor Performance** - Watch for any processing bottlenecks
4. **Add Custom Features** - Extend the processor with domain-specific logic

## 📞 Support

If you encounter any issues with the integration:

1. Check the console logs for detailed error messages
2. Use the test endpoints to isolate problems
3. Verify your API keys (Cloudinary, Gemini AI)
4. Check database connectivity and permissions
5. Review the file paths and permissions for local storage
