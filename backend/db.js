import sqlite3 from 'sqlite3'
import { open } from 'sqlite'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const dbPath = path.join(__dirname, 'data.db')

export const db = await open({ filename: dbPath, driver: sqlite3.Database })

await db.exec(`
PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS products(
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  image_url TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS embeddings(
  product_id TEXT PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
  vec BLOB NOT NULL
);
`)

export async function insertProduct(p){
  await db.run(
    'INSERT OR REPLACE INTO products(id,name,category,image_url) VALUES (?,?,?,?)',
    p.id, p.name, p.category, p.image_url
  )
}

export async function insertEmbedding(id, vec){
  const f32 = new Float32Array(vec)              // 2048-length expected
  const buf = Buffer.from(f32.buffer)            // exact bytes of float32 array
  await db.run('INSERT OR REPLACE INTO embeddings(product_id, vec) VALUES (?,?)', id, buf)
}

export async function getAllProducts(){
  return db.all('SELECT * FROM products')
}

export async function getAllEmbeddings(){
  const rows = await db.all('SELECT product_id, vec FROM embeddings')
  return rows.map(r => {
    const buf = r.vec                               // Node Buffer
    const u8 = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)
    const f32 = new Float32Array(u8.buffer, u8.byteOffset, u8.byteLength / 4)
    return { id: r.product_id, vec: f32 }
  })
}
