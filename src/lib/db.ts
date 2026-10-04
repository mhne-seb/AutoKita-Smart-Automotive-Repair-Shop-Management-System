// src/lib/db.ts
import { Pool, types } from 'pg';
import fs from 'fs';
import path from 'path';

const MANILA_OFFSET = '+08:00';
types.setTypeParser(types.builtins.TIMESTAMP, (value: string) =>
  new Date(value.replace(' ', 'T') + MANILA_OFFSET),
);

export const db = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: parseInt(process.env.DB_PORT || '5432', 10),
  ssl: {
    rejectUnauthorized: true,
    ca: fs.readFileSync(path.join(process.cwd(), 'certs', 'prod-ca-2021.crt')).toString(),
  }
});
