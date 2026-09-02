// src/lib/db.ts
import { Pool } from 'pg';
import fs from 'fs';

export const db = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: parseInt(process.env.DB_PORT || '5432', 10),
  ssl: {
    rejectUnauthorized: true,
    ca: fs.readFileSync('certs/prod-ca-2021.crt').toString(),
  }
});

