

import { Pinecone, type Index } from "@pinecone-database/pinecone";

let _client: Pinecone | null = null;

function getPineconeClient(): Pinecone | null {
  if (_client) return _client;
  const apiKey = process.env.PINECONE_API_KEY;
  if (!apiKey) return null;
  _client = new Pinecone({ apiKey });
  return _client;
}


let _adminIndex: Index | null = null;
let _customerIndex: Index | null = null;

export function getAdminIndex(): Index | null {
  if (_adminIndex) return _adminIndex;
  const client = getPineconeClient();
  if (!client) return null;
  const name = process.env.PINECONE_INDEX_ADMIN ?? "autokita-admin";
  _adminIndex = client.index(name);
  return _adminIndex;
}

export function getCustomerIndex(): Index | null {
  if (_customerIndex) return _customerIndex;
  const client = getPineconeClient();
  if (!client) return null;
  const name = process.env.PINECONE_INDEX_CUSTOMER ?? "autokita-customer";
  _customerIndex = client.index(name);
  return _customerIndex;
}
