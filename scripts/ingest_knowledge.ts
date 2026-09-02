

import fs from "fs";
import path from "path";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import OpenAI from "openai";
import { Pinecone } from "@pinecone-database/pinecone";

const CHUNK_SIZE = 1200;
const CHUNK_OVERLAP = 200;

function chunkText(text: string): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + CHUNK_SIZE, text.length);
    const chunk = text.slice(start, end).trim();
    if (chunk.length > 50) chunks.push(chunk);
    start += CHUNK_SIZE - CHUNK_OVERLAP;
    if (start >= text.length) break;
  }
  return chunks;
}

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  const pineconeKey = process.env.PINECONE_API_KEY;
  const indexName = process.env.PINECONE_INDEX_ADMIN ?? "autokita-admin";

  if (!apiKey) { console.error("Missing OPENAI_API_KEY"); process.exit(1); }
  if (!pineconeKey) { console.error("Missing PINECONE_API_KEY"); process.exit(1); }

  const openai = new OpenAI({ apiKey });
  const pinecone = new Pinecone({ apiKey: pineconeKey });
  const index = pinecone.index(indexName);

  const knowledgeDir = path.join(process.cwd(), "src", "data", "automotive_knowledge");
  const files = fs.readdirSync(knowledgeDir).filter((f) => f.endsWith(".md"));
  console.log(`Found ${files.length} knowledge files: ${files.join(", ")}`);

  let totalVectors = 0;

  for (const file of files) {
    const content = fs.readFileSync(path.join(knowledgeDir, file), "utf-8");
    const chunks = chunkText(content);
    console.log(`\n[${file}] ${chunks.length} chunks`);

    for (let i = 0; i < chunks.length; i += 10) {
      const batch = chunks.slice(i, i + 10);
      if (batch.length === 0) continue;

      const embeddings = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: batch,
      });

      const records = batch.map((text, j) => ({
        id: `${file.replace(".md", "")}_chunk_${i + j}`,
        values: embeddings.data[j].embedding,
        metadata: { source: file, chunk_index: i + j, text },
      }));

      
      await index.upsert({ records });
      totalVectors += records.length;
      console.log(`  Upserted chunks ${i + 1}-${i + batch.length}`);
    }
  }

  console.log(`\nDone! ${totalVectors} total vectors upserted into "${indexName}".`);
}

main().catch((err) => { console.error(err); process.exit(1); });
