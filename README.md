# MedSpa Growth Engine - Dashboard

AI-powered growth automation dashboard for medical spas. Track calls, appointments, follow-ups, campaigns, and client engagement in one beautiful interface.

## Features

### 📊 **10 Comprehensive Pages**

1. **Overview** - 8 key metrics with real-time updates
2. **Calls** - Call log with AI transcript modal
3. **Appointments** - Appointment tracking with expandable follow-up sequences
4. **Follow-Ups** - Pipeline view with card-style progress tracking
5. **Messages** - Full message log with conversation slide-out panel
6. **Reviews** - Review tracking with conversion funnel chart
7. **Campaigns** - Campaign management with AI message preview
8. **Clients** - Client database with detailed profile panel
9. **Webhooks** - Webhook configuration and testing
10. **Settings** - 5-tab configuration (Business, Templates, CRM, Notifications, Integrations)

### ✨ **Key Capabilities**

- **Real-time Updates** - Live data from Supabase
- **AI Transcripts** - Chat-style call transcripts with AI summaries
- **Sentiment Analysis** - Automatic sentiment detection on client replies
- **Campaign Builder** - Create reactivation and seasonal campaigns with AI preview
- **Client Segmentation** - Active, At Risk, and Lapsed client tracking
- **Follow-Up Automation** - Visual progress tracking for automated sequences
- **White-Labeling** - Custom logo and brand colors per business

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **Icons**: Lucide React
- **Date Handling**: date-fns
- **Deployment**: Vercel

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Supabase account
- Backend API running

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/medspa-dashboard.git
cd medspa-dashboard

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
```

### Environment Variables

Create `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/api
```

### Development

```bash
# Run development server
npm run dev

# Open http://localhost:3001
```

### Build

```bash
# Create production build
npm run build

# Start production server
npm start
```

## Deployment

See [deployment_guide.md](./deployment_guide.md) for detailed deployment instructions.

### Quick Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/yourusername/medspa-dashboard)

1. Click the button above
2. Add environment variables
3. Deploy!

## White-Labeling

The dashboard supports white-labeling:

- **Logo**: Set `logo_url` in businesses table
- **Brand Color**: Set `brand_color` in businesses table
- **Business Name**: Pulled from businesses table
- **Powered By Footer**: Always visible (small, bottom-right)

## Project Structure

```
medspa-dashboard/
├── app/
│   ├── appointments/      # Appointments page
│   ├── calls/            # Calls page
│   ├── campaigns/        # Campaigns page
│   ├── clients/          # Clients page
│   ├── followups/        # Follow-ups page
│   ├── messages/         # Messages page
│   ├── reviews/          # Reviews page
│   ├── settings/         # Settings page
│   ├── webhooks/         # Webhooks page
│   ├── layout.tsx        # Root layout with meta tags
│   └── page.tsx          # Overview dashboard
├── components/
│   └── Navigation.tsx    # Main navigation component
├── lib/
│   ├── api.ts           # API client
│   └── supabase.ts      # Supabase client
├── public/              # Static assets
├── vercel.json          # Vercel configuration
└── package.json
```

## API Integration

All pages use the API client (`lib/api.ts`) to fetch data from the backend:

```typescript
import { api } from '@/lib/api';

// Get stats
const stats = await api.getStats(businessId);

// Get appointments
const appointments = await api.getAppointments(businessId, { status: 'confirmed' });
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

Proprietary - Scale with JAK

## Support

For support, email <support@scalewithjak.com>

---

**Powered by [Scale with JAK](https://scalewithjak.com)** 🚀
