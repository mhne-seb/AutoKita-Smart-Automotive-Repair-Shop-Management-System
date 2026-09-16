// src/lib/db.ts
import { Pool, types } from 'pg';
import fs from 'fs';
import path from 'path';

// Every timestamp column in the schema is `timestamp without time zone`. The
// shop runs in one timezone, so the convention is: a naive timestamp in the
// DB is Manila wall-clock. The database's own clock is set to match
// (ALTER DATABASE ... SET timezone TO 'Asia/Manila'), so NOW() in the stored
// functions and the dates typed into the schedule modal mean the same thing.
// This parser makes the driver read them that way regardless of where the
// Node process happens to run (your laptop is +08, Vercel is UTC).
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
