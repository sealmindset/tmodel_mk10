import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import session from 'express-session';

import cors from 'cors';

import { Pool } from 'pg';
import { registerRoutes } from './routes/index.js';
import { applyMiddlewares } from './middlewares/index.js';

import ThreatAnalyzer from '../../threatAnalyzer.js';

const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: process.env.POSTGRES_PORT,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB,
});

const app = express();
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(cors({
  origin: 'https://tmodeling.onrender.com',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(session({

  secret: process.env.SESSION_SECRET || 'dev-secret-key-change-in-production',
  resave: true,
  saveUninitialized: true,
  name: 'tmodel.sid',
  cookie: {
    secure: false,
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24,
    sameSite: 'lax',
  },
}));




app.locals.threatAnalyzer = new ThreatAnalyzer();

applyMiddlewares(app);
registerRoutes(app, { pool });

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
