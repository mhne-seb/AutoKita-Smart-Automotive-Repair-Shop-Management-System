// src/lib/db.ts
import { Pool, types } from 'pg';
import fs from 'fs';
import path from 'path';

const MANILA_OFFSET = '+08:00';
types.setTypeParser(types.builtins.TIMESTAMP, (value: string) =>
  new Date(value.replace(' ', 'T') + MANILA_OFFSET),
);

const isLocal =
  process.env.DB_SSL === 'false' ||
  !process.env.DB_HOST ||
  process.env.DB_HOST === 'localhost' ||
  process.env.DB_HOST === '127.0.0.1';

const sslConfig = isLocal
  ? false
  : {
      rejectUnauthorized: true,
      ca: fs.readFileSync(path.join(process.cwd(), 'certs', 'prod-ca-2021.crt')).toString(),
    };

export const db = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: parseInt(process.env.DB_PORT || '5432', 10),
  ssl: sslConfig,
});
