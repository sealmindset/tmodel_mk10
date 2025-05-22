# Enhanced Threat Modeling Platform

**Version**: 2.0  
**Author**: sealmindset

## Description
This is an enhanced threat modeling platform that integrates structured project management with vulnerability scanning for comprehensive security analysis. The platform combines threat modeling with real-world vulnerability data from scanning tools like Rapid7, providing a cohesive view of your security posture.

## Key Features
- **Project-Based Architecture**: Organize threat models by project, with structured components and safeguards for better organization and management.
- **Interactive Threat Modeling**: Generate detailed threat scenarios with risk assessment matrices and mitigation strategies.
- **Vulnerability Integration**: Connect with Rapid7 to import real-world vulnerability findings and correlate them with theoretical threats.
- **Security Visualization**: Rich dashboards provide visual representation of risk scores, vulnerability trends, and safeguard effectiveness.
- **Database Persistence**: PostgreSQL backend for robust data integrity and complex relationship management.
- **AI-Powered Analysis**: OpenAI integration for generating detailed threat analyses and remediation recommendations.
- **Component Library**: Reusable component catalog for consistent threat modeling across projects.

## Prerequisites

- PostgreSQL (v12 or higher)
- Redis Server (for caching and session management)
- Node.js (v14 or higher) with Express
- OpenAI API Key (for threat generation)
- Rapid7 API Key (optional, for vulnerability integration)

### Configuration Files

#### `.env` File
The environment configuration can be set up with the provided `setupDotEnv.js` script. Required variables include:

```plaintext
NODE_ENV=development
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=threat_model_dev
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=
PORT=3000

# Optional Rapid7 Integration
RAPID7_API_KEY=your_api_key
RAPID7_API_URL=https://us.api.insight.rapid7.com/vm

# OpenAI Integration
OPENAI_API_KEY=your_openai_key
OPENAI_MODEL=gpt-4
```

## Installation & Setup

1. Clone the repository
2. Set up your environment variables:
   ```bash
   node scripts/setupDotEnv.js
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Initialize the database:
   ```bash
   npm run db:init
   ```
5. Start the application:
   ```bash
   npm start
   ```
   Or use development mode with hot reloading:
   ```bash
   npm run dev
   ```
6. Access the application at http://localhost:3000

## Architecture

### Database Structure
The application uses a PostgreSQL database with the following main tables:
- `projects`: Stores project metadata and business context
- `components`: Reusable system components that can be used across projects
- `safeguards`: Security controls that can be applied to components
- `vulnerabilities`: Real-world vulnerabilities imported from scanning tools
- `threats`: Identified potential threats with risk assessment
- `threat_models`: Structured threat modeling documents

### Integration Points
- **Rapid7**: Imports vulnerability data to correlate with threat models
- **OpenAI**: Generates threat scenarios and mitigation recommendations
- **Redis**: Handles session management and caching

## Available Scripts
- `npm start`: Start the application
- `npm run dev`: Start with nodemon for development
- `npm run db:init`: Initialize the database schema
- `npm run db:migrate`: Run database migrations

## Key Features & Endpoints

### API Endpoints
- `/api/projects`: Project management endpoints
- `/api/threats`: Threat identification and management
- `/api/vulnerabilities`: Vulnerability tracking and correlation
- `/api/safeguards`: Security control management
- `/api/rapid7`: Integration with Rapid7 vulnerability scanner

### Dashboards
- Project Dashboard: Overview of all security projects
- Threat Dashboard: Risk matrix and threat visualization
- Vulnerability Dashboard: Real-time vulnerability tracking

## License
See the LICENSE file for details.
