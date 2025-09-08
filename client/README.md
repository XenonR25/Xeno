# Xeno Client - Next.js Frontend

A modern, responsive frontend for the Xeno book upload platform built with Next.js, TypeScript, and Tailwind CSS.

## Features

- 📚 **Book Upload**: Drag-and-drop PDF upload with progress tracking
- 🔐 **Authentication**: Secure login/register system
- 📖 **Library Management**: View and manage uploaded books
- 🎨 **Modern UI**: Beautiful, responsive design with Tailwind CSS
- 📱 **Mobile Friendly**: Fully responsive across all devices
- ⚡ **Fast**: Built with Next.js for optimal performance

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Running Xeno server (backend)

### Installation

1. Navigate to the client directory:
```bash
cd client
```

2. Install dependencies:
```bash
npm install
```

3. Create environment file:
```bash
cp .env.example .env.local
```

4. Update the API URL in `.env.local` if needed:
```
NEXT_PUBLIC_API_URL=http://localhost:3000
```

5. Start the development server:
```bash
npm run dev
```

6. Open [http://localhost:3001](http://localhost:3001) in your browser

## Project Structure

```
client/
├── app/                    # Next.js 13+ app directory
│   ├── globals.css        # Global styles
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Home page
├── components/            # React components
│   ├── AuthForm.tsx       # Login/Register form
│   ├── BookUpload.tsx     # File upload component
│   ├── BookList.tsx       # Library view
│   └── Header.tsx         # Navigation header
├── lib/                   # Utility libraries
│   ├── api.ts            # API service functions
│   └── auth.ts           # Authentication utilities
├── types/                 # TypeScript type definitions
│   └── index.ts          # Shared types
└── public/               # Static assets
```

## Key Components

### BookUpload
- Drag-and-drop file upload
- Real-time progress tracking
- File validation (PDF only, 50MB max)
- Beautiful upload UI with status indicators

### AuthForm
- Login and registration forms
- Form validation
- Secure token management
- User-friendly error handling

### BookList
- Grid layout for book display
- Pagination support
- Delete functionality
- Responsive design

## API Integration

The frontend connects to the Xeno server API with the following endpoints:

- `POST /api/auth/login` - User authentication
- `POST /api/auth/register` - User registration
- `POST /api/books/create` - Book upload
- `GET /api/books` - Get user's books
- `DELETE /api/books/:id` - Delete book

## Styling

- **Tailwind CSS**: Utility-first CSS framework
- **Custom Components**: Reusable UI components
- **Responsive Design**: Mobile-first approach
- **Dark Mode Ready**: Easy to implement dark theme

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

### Environment Variables

- `NEXT_PUBLIC_API_URL` - Backend API URL (default: http://localhost:3000)

## Deployment

1. Build the application:
```bash
npm run build
```

2. Start the production server:
```bash
npm start
```

Or deploy to platforms like Vercel, Netlify, or any Node.js hosting service.

## Features in Detail

### File Upload
- Supports drag-and-drop and click-to-browse
- Real-time upload progress
- File size and type validation
- Processing status indicators
- Error handling with user feedback

### Authentication
- JWT token-based authentication
- Persistent login sessions
- Secure token storage
- Automatic token refresh handling

### User Experience
- Toast notifications for user feedback
- Loading states for all async operations
- Form validation with helpful error messages
- Responsive design for all screen sizes

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is part of the Xeno platform.
