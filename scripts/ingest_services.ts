

import fs from "fs";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { Pool } from "pg";
import OpenAI from "openai";
import { Pinecone } from "@pinecone-database/pinecone";

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  const pineconeKey = process.env.PINECONE_API_KEY;
  const indexName = process.env.PINECONE_INDEX_CUSTOMER ?? "autokita-customer";

  if (!apiKey) { console.error("Missing OPENAI_API_KEY"); process.exit(1); }
  if (!pineconeKey) { console.error("Missing PINECONE_API_KEY"); process.exit(1); }

  const pool = new Pool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT ?? 5432),
    ssl: {
      rejectUnauthorized: true,
      ca: fs.readFileSync('certs/prod-ca-2021.crt').toString(),
    },
  });

  const openai = new OpenAI({ apiKey });
  const pinecone = new Pinecone({ apiKey: pineconeKey });
  const index = pinecone.index(indexName);

  const result = await pool.query(`
    SELECT service_name, description, base_price, base_duration_hours, is_price_fixed
    FROM services
    WHERE is_active = true
    ORDER BY service_name
  `);

  const services = result.rows;
  console.log(`Found ${services.length} active services`);

  const documents = services.map((s: any) =>
    `Service: ${s.service_name}. ${s.description} ` +
    `Base price: PHP ${parseFloat(s.base_price).toFixed(2)}. ` +
    `Estimated duration: ${s.base_duration_hours} hour(s). ` +
    `Price is ${s.is_price_fixed ? "fixed" : "variable depending on vehicle and condition"}.`
  );

  const embeddings = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: documents,
  });

  const records = documents.map((text: string, i: number) => ({
    id: `service_${services[i].service_name.toLowerCase().replace(/\s+/g, "_")}`,
    values: embeddings.data[i].embedding,
    metadata: {
      source: "services_table",
      service_name: services[i].service_name,
      base_price: String(services[i].base_price),
      text,
    },
  }));

  console.log(records);
  await index.upsert({ records });
  console.log(`Done! ${records.length} service vectors upserted into "${indexName}".`);

  await pool.end();
}

main().catch((err) => { console.error(err); process.exit(1); });
