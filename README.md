# MIRAI Services — Frontend

Next.js 14 (App Router) + Tailwind CSS + Redux.

## Architecture

```
view/
├── app/                        # Next.js App Router
│   ├── layout.tsx              # Root layout (providers, theme)
│   ├── (auth)/                 # Auth pages (login, register)
│   ├── (defaults)/             # Main app pages
│   │   ├── dashboard/          # Dashboard views
│   │   ├── apps/               # Chat, customers, invoice, calendar
│   │   └── users/profile/      # Client profile view
│   └── management/             # Admin management pages
│
├── components/
│   ├── apps/
│   │   ├── chat/               # Chat UI (channels, messages, WA)
│   │   ├── customers/          # Customer table, forms, WhatsApp dialog
│   │   └── invoice/            # Invoice PDF generator
│   ├── dashboard/              # Dashboard widgets & charts
│   ├── layouts/                # Sidebar, header, footer
│   ├── auth/                   # Login/register forms
│   └── common/                 # Shared UI components
│
├── lib/
│   ├── api.ts                  # Axios client (interceptors, auth)
│   └── api/                    # API functions by domain
│
├── hooks/
│   ├── useAuth.ts              # Auth state hook
│   └── useChatSocket.ts        # WebSocket chat hook
│
├── store/                      # Redux state management
├── public/                     # Static assets, locales
├── styles/                     # CSS (Tailwind + vendor)
└── types/                      # TypeScript declarations
```

## Key Pages

| Route                   | Description                |
|-------------------------|----------------------------|
| `/`                     | Login                      |
| `/dashboard`            | Vue d'ensemble             |
| `/dashboard/commercial` | Gestion commerciale        |
| `/dashboard/finance`    | Gestion financière         |
| `/dashboard/operations` | Tableau de bord opérations |
| `/apps/customers`       | Gestion des clients        |
| `/apps/chat`            | Chat interne + WhatsApp    |
| `/apps/invoice/preview` | Aperçu facture             |
| `/users/profile?id=`    | Profil client              |
| `/management/users`     | Gestion des utilisateurs   |

## Features

- **Dark mode** — Full dark theme support
- **i18n** — French (default) + English
- **Real-time chat** — Socket.IO with typing indicators, reactions, unread badges
- **WhatsApp** — Send messages to clients via Infobip
- **PDF invoices** — Generate invoices for subscriptions and à la carte orders
- **Dashboard** — 4 dashboard views with charts (ApexCharts)
- **Responsive** — Mobile-friendly sidebar + tables

