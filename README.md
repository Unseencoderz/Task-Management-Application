```mermaid
flowchart TD
    U[User] --> FE[Next.js + TypeScript]
    FE --> AUTH[Supabase Google OAuth]
    FE --> API[Flask REST API]
    API --> DB[(Supabase PostgreSQL)]
    API --> MAIL[Gmail Integration]
    DB --> API
    AUTH --> FE
```