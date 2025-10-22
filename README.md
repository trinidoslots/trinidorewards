# Bonus Hunt Tracker

A full-stack bonus hunt tracking application built with Next.js, Supabase, and Tailwind CSS.

## Features

- **Public Display Page**: View all bonus hunts with real-time statistics
- **Admin Panel**: Manage bonus hunts with full CRUD operations
- **Opening Mode**: Sequential bonus opening interface
- **OBS Widget**: Real-time overlay for streaming
- **Statistics Tracking**: Starting balance, ending balance, break even calculations
- **Real-time Updates**: Supabase subscriptions for live data

## Running on Localhost

### Prerequisites

- Node.js 18+ installed
- A Supabase account and project

### Setup Instructions

1. **Download the project**
   - Click the three dots in the top right of v0
   - Select "Download ZIP"
   - Extract the ZIP file to your desired location

2. **Install dependencies**
   \`\`\`bash
   cd bonus-hunt-tracker
   npm install
   \`\`\`

3. **Set up environment variables**
   
   Create a `.env.local` file in the root directory with your Supabase credentials:
   
   \`\`\`env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   POSTGRES_URL=your_postgres_url
   \`\`\`
   
   You can find these values in your Supabase project settings.

4. **Run the database migrations**
   
   Execute the SQL scripts in order from the `scripts/` folder in your Supabase SQL editor:
   - `001_create_bonus_hunts_table.sql`
   - `002_update_bonus_hunts_schema.sql`
   - `010_final_slots_table_fix.sql`
   - `011_insert_all_slots.sql`

5. **Start the development server**
   \`\`\`bash
   npm run dev
   \`\`\`

6. **Access the application**
   - Main page: http://localhost:3000
   - Admin panel: http://localhost:3000/admin
   - OBS widget: http://localhost:3000/obs

### OBS Setup

To use the OBS widget:

1. Open OBS Studio
2. Add a new Browser Source
3. Set the URL to: `http://localhost:3000/obs`
4. Set width to 400px and height to 800px (adjust as needed)
5. The widget will update in real-time as you manage bonuses

### Building for Production

\`\`\`bash
npm run build
npm start
\`\`\`

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Database**: Supabase (PostgreSQL)
- **Styling**: Tailwind CSS v4
- **UI Components**: shadcn/ui
- **Real-time**: Supabase Subscriptions
- **Authentication**: Supabase Auth

## Project Structure

\`\`\`
├── app/
│   ├── page.tsx          # Main display page
│   ├── admin/            # Admin panel
│   ├── obs/              # OBS widget
│   └── auth/             # Authentication pages
├── components/           # React components
├── lib/                  # Utilities and Supabase clients
├── scripts/              # Database migration scripts
└── public/               # Static assets
\`\`\`

## Support

For issues or questions, please refer to the v0 documentation or Supabase documentation.
