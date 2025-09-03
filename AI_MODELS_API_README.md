# AI Models API

## 🤖 Overview

The AI Models API provides comprehensive management of AI models (ChatGPT, Gemini, DeepSeek) for prompt/text searching, summarization, and other AI-powered tasks. This API allows users to create, configure, and manage multiple AI models with different capabilities and settings.

## 🚀 Features

- **Multi-Model Support**: ChatGPT, Gemini, DeepSeek
- **CRUD Operations**: Create, Read, Update, Delete models
- **Dynamic Updates**: Update specific fields without affecting others
- **Capability Management**: Define and filter by model capabilities
- **Model Testing**: Test models with sample prompts
- **User Isolation**: Each user manages their own models
- **Comprehensive Validation**: Input validation and error handling

## 📊 Model Capabilities

Supported capabilities for AI models:

- **text_generation**: Generate text content
- **summarization**: Summarize long text
- **search**: Search and retrieve information
- **translation**: Translate between languages
- **analysis**: Analyze and interpret content

## 🗄️ Database Schema

```sql
CREATE TABLE "Models" (
  "ModelId" SERIAL PRIMARY KEY,
  "name" VARCHAR(255) NOT NULL,
  "type" VARCHAR(50) NOT NULL CHECK ("type" IN ('chatgpt', 'gemini', 'deepseek')),
  "apiKey" TEXT NOT NULL,
  "baseUrl" VARCHAR(500) NOT NULL,
  "description" TEXT,
  "isActive" BOOLEAN DEFAULT true,
  "maxTokens" INTEGER,
  "temperature" DECIMAL(3,2) DEFAULT 0.7 CHECK ("temperature" >= 0 AND "temperature" <= 2),
  "capabilities" TEXT[] DEFAULT ARRAY['text_generation'],
  "UserId" INTEGER NOT NULL REFERENCES "Users"("UserId") ON DELETE CASCADE,
  "created_at" TIMESTAMP DEFAULT NOW(),
  "updated_at" TIMESTAMP DEFAULT NOW()
);
```

## 🔧 API Endpoints

### 1. **POST `/api/models`** - Create AI Model

Create a new AI model with specified configuration.

**Request Body:**

```json
{
  "name": "GPT-4 Turbo",
  "type": "chatgpt",
  "apiKey": "your_openai_api_key",
  "baseUrl": "https://api.openai.com/v1",
  "description": "OpenAI's latest GPT-4 model",
  "isActive": true,
  "maxTokens": 4096,
  "temperature": 0.7,
  "capabilities": ["text_generation", "summarization", "analysis"]
}
```

**Response:**

```json
{
  "status": "success",
  "message": "Model created successfully",
  "data": {
    "ModelId": 1,
    "name": "GPT-4 Turbo",
    "type": "chatgpt",
    "baseUrl": "https://api.openai.com/v1",
    "description": "OpenAI's latest GPT-4 model",
    "isActive": true,
    "maxTokens": 4096,
    "temperature": 0.7,
    "capabilities": ["text_generation", "summarization", "analysis"],
    "created_at": "2024-01-15T10:30:00Z",
    "apiKey": "***hidden***"
  }
}
```

### 2. **GET `/api/models`** - List Models

Get all AI models with optional filtering.

**Query Parameters:**

- `type`: Filter by model type (`chatgpt`, `gemini`, `deepseek`)
- `isActive`: Filter by active status (`true`/`false`)
- `capability`: Filter by specific capability

**Examples:**

```bash
# Get all models
GET /api/models

# Get only ChatGPT models
GET /api/models?type=chatgpt

# Get active models with summarization capability
GET /api/models?isActive=true&capability=summarization
```

**Response:**

```json
{
  "status": "success",
  "data": {
    "models": [
      {
        "ModelId": 1,
        "name": "GPT-4 Turbo",
        "type": "chatgpt",
        "baseUrl": "https://api.openai.com/v1",
        "isActive": true,
        "capabilities": ["text_generation", "summarization"]
      }
    ],
    "total": 1,
    "filters": {
      "type": "chatgpt",
      "isActive": "true"
    }
  }
}
```

### 3. **GET `/api/models/{modelId}`** - Get Specific Model

Retrieve details of a specific AI model.

**Response:**

```json
{
  "status": "success",
  "data": {
    "ModelId": 1,
    "name": "GPT-4 Turbo",
    "type": "chatgpt",
    "baseUrl": "https://api.openai.com/v1",
    "description": "OpenAI's latest GPT-4 model",
    "isActive": true,
    "maxTokens": 4096,
    "temperature": 0.7,
    "capabilities": ["text_generation", "summarization", "analysis"],
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T10:30:00Z"
  }
}
```

### 4. **PUT `/api/models/{modelId}`** - Update Model

Update an existing AI model with new configuration.

**Request Body:**

```json
{
  "name": "GPT-4 Turbo Updated",
  "maxTokens": 8192,
  "temperature": 0.5,
  "capabilities": ["text_generation", "summarization", "translation"]
}
```

**Response:**

```json
{
  "status": "success",
  "message": "Model updated successfully",
  "data": {
    "ModelId": 1,
    "name": "GPT-4 Turbo Updated",
    "maxTokens": 8192,
    "temperature": 0.5,
    "capabilities": ["text_generation", "summarization", "translation"],
    "updated_at": "2024-01-15T11:00:00Z"
  }
}
```

### 5. **PATCH `/api/models/{modelId}/dynamic-update`** - Dynamic Update

Update specific fields of a model without affecting others.

**Request Body:**

```json
{
  "fieldUpdates": {
    "temperature": 0.9,
    "isActive": false,
    "capabilities": ["summarization", "analysis"]
  }
}
```

**Response:**

```json
{
  "status": "success",
  "message": "Model dynamically updated successfully",
  "data": {
    "ModelId": 1,
    "temperature": 0.9,
    "isActive": false,
    "capabilities": ["summarization", "analysis"],
    "updated_at": "2024-01-15T11:15:00Z",
    "updatedFields": ["temperature", "isActive", "capabilities"]
  }
}
```

### 6. **DELETE `/api/models/{modelId}`** - Delete Model

Remove an AI model from the system.

**Response:**

```json
{
  "status": "success",
  "message": "Model deleted successfully",
  "data": {
    "ModelId": 1,
    "name": "GPT-4 Turbo",
    "type": "chatgpt"
  }
}
```

### 7. **POST `/api/models/{modelId}/test`** - Test Model

Test an AI model with a sample prompt.

**Request Body:**

```json
{
  "prompt": "Summarize the key points of artificial intelligence in 3 sentences.",
  "taskType": "summarization"
}
```

**Response:**

```json
{
  "status": "success",
  "message": "Model test completed successfully",
  "data": {
    "modelId": 1,
    "modelName": "GPT-4 Turbo",
    "modelType": "chatgpt",
    "taskType": "summarization",
    "prompt": "Summarize the key points of artificial intelligence in 3 sentences.",
    "response": "This is a simulated response from GPT-4 Turbo for summarization task.",
    "timestamp": "2024-01-15T11:30:00Z",
    "tokensUsed": 75,
    "responseTime": 1200
  }
}
```

## 📱 Usage Examples

### Frontend JavaScript

```javascript
// Create a new model
const createModel = async (modelData, token) => {
  const response = await fetch("/api/models", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(modelData),
  });
  return await response.json();
};

// Get models with filtering
const getModels = async (filters = {}, token) => {
  const queryParams = new URLSearchParams(filters);
  const response = await fetch(`/api/models?${queryParams}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return await response.json();
};

// Dynamic update specific fields
const dynamicUpdate = async (modelId, fieldUpdates, token) => {
  const response = await fetch(`/api/models/${modelId}/dynamic-update`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ fieldUpdates }),
  });
  return await response.json();
};

// Test a model
const testModel = async (modelId, prompt, taskType, token) => {
  const response = await fetch(`/api/models/${modelId}/test`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ prompt, taskType }),
  });
  return await response.json();
};
```

### cURL Examples

```bash
# Create a new model
curl -X POST http://localhost:5000/api/models \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Gemini Pro",
    "type": "gemini",
    "apiKey": "your_gemini_key",
    "baseUrl": "https://generativelanguage.googleapis.com",
    "capabilities": ["text_generation", "summarization"]
  }'

# Get models with filtering
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:5000/api/models?type=chatgpt&capability=summarization"

# Dynamic update
curl -X PATCH http://localhost:5000/api/models/1/dynamic-update \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fieldUpdates": {
      "temperature": 0.9,
      "isActive": false
    }
  }'

# Test model
curl -X POST http://localhost:5000/api/models/1/test \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Explain quantum computing in simple terms",
    "taskType": "text_generation"
  }'
```

## 🔒 Security Features

- **JWT Authentication**: All endpoints require valid authentication token
- **User Isolation**: Users can only access and modify their own models
- **API Key Protection**: API keys are never returned in responses
- **Input Validation**: Comprehensive validation of all input data
- **SQL Injection Protection**: Parameterized queries for all database operations

## 🚀 Performance Features

- **Database Indexes**: Optimized queries with proper indexing
- **Filtering**: Efficient filtering by type, status, and capabilities
- **Pagination**: Support for large model collections (future enhancement)
- **Caching**: Model configurations can be cached (future enhancement)

## 🧪 Testing

### Setup Database

```bash
cd server
node create-models-table.js
```

### Test API

```bash
cd server
node test-models-api.js
```

## 📁 File Structure

```
server/
├── routes/
│   ├── models.js              # AI Models API routes
│   ├── books.js               # Book operations
│   ├── bookDetails.js         # Book details
│   └── users.js               # User management
├── create-models-table.js      # Database setup script
├── test-models-api.js         # API testing script
└── index.js                   # Main server with route registration
```

## 🔄 Integration with Existing System

The AI Models API integrates seamlessly with your existing book management system:

- **Book Summarization**: Use models to automatically summarize uploaded PDFs
- **Content Analysis**: Analyze book content for insights and categorization
- **Search Enhancement**: Improve book search with AI-powered text understanding
- **Multi-Model Support**: Choose the best model for each specific task

## 🎯 Use Cases

1. **Content Summarization**: Automatically summarize long documents
2. **Text Generation**: Generate book descriptions, reviews, or content
3. **Language Translation**: Translate books to different languages
4. **Content Analysis**: Analyze book themes, sentiment, and complexity
5. **Search Enhancement**: Improve text search with semantic understanding
6. **Multi-Model Workflows**: Use different models for different tasks

## 🔮 Future Enhancements

- **Model Performance Tracking**: Monitor response times and success rates
- **Cost Management**: Track API usage and costs
- **Model Comparison**: Compare performance between different models
- **Batch Processing**: Process multiple requests simultaneously
- **Model Chaining**: Chain multiple models for complex workflows
- **Real-time Updates**: WebSocket support for model status updates
