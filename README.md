# ExamMaster

ExamMaster is a comprehensive web-based examination platform designed to allow administrators to create and manage exams while providing students with a secure environment to take tests. With features such as role-based access, real-time exam monitoring, and automated grading, ExamMaster ensures a seamless and effective testing experience.

## Overview

ExamMaster is structured into two primary components: the frontend and the backend.

### Architecture and Technologies

- **Frontend**: 
  - Built with ReactJS and Vite in the `client/` folder.
  - Uses Shadcn UI component library with Tailwind CSS framework.
  - Implements client-side routing with `react-router-dom`.
  - Requests to the backend are prefixed with `/api/`.

- **Backend**: 
  - Built using Express.js in the `server/` folder.
  - Implements REST API endpoints.
  - Integrates MongoDB with Mongoose for database operations.
  - Uses token-based authentication for security.

### Project Structure

- **Frontend (`client/`)**:
  - Entry point: `client/src/main.tsx`
  - Pages: `client/src/pages/`
  - UI Components: `client/src/components/`
  - API: `client/src/api/`

- **Backend (`server/`)**:
  - Main server file: `server/server.js`
  - Routes: `server/routes/`
  - Models: `server/models/`
  - Services: `server/services/`

## Features

**User Roles & Authentication**
- Unified login system with role detection and secure session management.
- Password recovery via email.

**Admin Features**
- Full access to exam creation, management, and analytics.
- User and system management capabilities.

**Student Features**
- Access to assigned exams, personal results, and profile management.

**Admin Dashboard**
- Overview of system statistics, recent activities, and quick actions for exam management.
- Detailed interfaces for creating and managing exams, as well as organizing questions.

**Student Dashboard**
- Displays upcoming, available, and completed exams with performance summaries.
- Clean and secure exam attempt interface with real-time monitoring features.

**Examination Engine**
- Question and option randomization to prevent cheating.
- Automated grading with support for manual review of subjective questions.

**Reporting & Analytics**
- Detailed performance analytics for both admins and students.
- Exportable reports in PDF and CSV formats.

**Security & Proctoring**
- Browser monitoring and full-screen enforcement during exams.
- Prevent multiple submissions and ensure data integrity with encryption.

## Getting Started

### Requirements

To run ExamMaster, ensure you have the following installed on your computer:
- Node.js (>= 14.x)
- npm (>= 6.x)
- MongoDB

### Quickstart

Follow these steps to set up and run the project:

1. **Clone the repository**
    ```shell
    git clone https://github.com/your-repo/exam-master.git
    cd exam-master
    ```

2. **Install dependencies**
    ```shell
    npm install
    ```

3. **Configure the environment**
    - Create a `.env` file in the `server` directory with the necessary environment variables:
        ```
        PORT=3000
        MONGODB_URI=mongodb://localhost:27017/exam-master-db
        SESSION_SECRET=your_secret_key
        ```

4. **Start the application**
    ```shell
    npm run start
    ```

    This command will start both the frontend and backend concurrently.

5. **Access the application**
    - Frontend: Open your browser and navigate to `http://localhost:5173`.
    - Backend: The server will run on `http://localhost:3000`.

### License

The project is proprietary (not open source).

```
Copyright (c) 2024.
```

This README provides a comprehensive overview of ExamMaster, ensuring that anyone who reads it understands the purpose, features, and setup of the project.