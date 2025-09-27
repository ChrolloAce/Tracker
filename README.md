# Instagram Video Submissions Dashboard

A modern, minimalist dashboard for managing Instagram video submissions with a clean UI and functional video data fetching.

## Features

- **Modern UI Design**: Clean, minimalist interface with proper spacing and typography
- **Instagram Integration**: Add videos by pasting Instagram URLs
- **Video Data Fetching**: Automatically retrieves video metadata (views, likes, comments)
- **Status Management**: Track submission status (Pending, Approved, Rejected)
- **Responsive Design**: Works on desktop and mobile devices
- **Real-time Updates**: Dynamic data loading with loading states

## Tech Stack

- **React 18** with TypeScript
- **Vite** for fast development and building
- **Tailwind CSS** for styling
- **Lucide React** for icons
- **Instagram Graph API** integration (mock implementation included)

## Getting Started

### Prerequisites

- Node.js 16+ and npm/yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Open your browser and navigate to `http://localhost:5173`

## Usage

1. **Add Video**: Click the "Add Video" button in the top navigation
2. **Enter Instagram URL**: Paste any Instagram video URL (posts, reels, or TV)
3. **View Data**: The app will fetch and display video metadata including:
   - Video thumbnail
   - Title/caption
   - Username
   - View count
   - Like count
   - Comment count
   - Submission date

## API Integration

The app includes a mock Instagram API service for demonstration. In production, you would:

1. Set up Instagram Graph API credentials
2. Replace the mock service with actual API calls
3. Handle authentication and rate limiting

## Project Structure

```
src/
├── components/
│   ├── layout/
│   │   └── TopNavigation.tsx
│   ├── ui/
│   │   ├── Button.tsx
│   │   ├── Modal.tsx
│   │   └── StatusBadge.tsx
│   ├── VideoSubmissionModal.tsx
│   └── VideoSubmissionsTable.tsx
├── services/
│   └── InstagramApiService.ts
├── types/
│   └── index.ts
├── App.tsx
└── main.tsx
```

## Customization

The design follows a minimalist aesthetic with:
- Clean white backgrounds
- Subtle shadows and rounded corners
- Blue accent color (#4A90E2)
- Inter font family
- Proper spacing and typography hierarchy

All colors and styles can be customized in the `tailwind.config.js` file.

## Building for Production

```bash
npm run build
```

The built files will be in the `dist/` directory.
