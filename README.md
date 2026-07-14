# AutoKita: A Smart Automotive Repair Shop Management System

AutoKita is a capstone project focused on developing a smart automotive repair shop management system designed to streamline business operations through efficient management of services, customer communication, and digital record keeping. The system replaces traditional paper-based processes with a centralized and structured platform to improve efficiency and service quality.

## Developers

**Capstone Project — AutoKita Development Team**

- ACEITUNAS, Leo Miguel B.
- CAMORONGAN, Christine Lei R.
- FABABIER, Jarell Vincent N.
- SEBIDO, Mhaine M.

**Program:** Bachelor of Science in Information Technology

**School:** Polytechnic University of the Philippines – Manila

## Tech Stack

- **Next.js 15** (App Router)
- **React 19**
- **TypeScript**
- **Tailwind CSS v4**
- **shadcn/ui (Radix UI)**
- **Recharts**
- **ExcelJS**
- **jsPDF**
- **Lucide React**

Install the project dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Open the application in your browser:

```
http://localhost:3000
```

## Demo Accounts

| Role | Email | Password |
|------|-------|----------|
| Customer | customer@autocare.com | password |
| Admin | admin@autokita.com | autokita2026 | 

## Project Structure

```text
app/
├── (customer)/         Customer pages
├── (admin)/            Admin pages
├── login/
├── services/
├── layout.tsx
├── error.tsx
└── not-found.tsx

src/
├── components/         Shared UI components
├── controllers/        Mock API layer
├── data/               Mock data
├── hooks/
├── layouts/
├── lib/
└── pages/

public/
├── assets/
└── autokita-logo.png
```


## System Preview

### Home Page

![Home Page](homepage(1).png)

### About Page

![About Page](aboutpage(1).png)

### Services Page

![Services Page](servicepage(1).png)

### Contact Page

![Contact Page](contactpage(1).png)

### Booking Page

![Booking Page](bookpage(1).png)
