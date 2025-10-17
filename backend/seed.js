import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { spawn } from 'child_process'
import { insertProduct, insertEmbedding } from './db.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const catalog = [
  { id:'p001', name:'Sample 1', category:'products', image_file: 'i2.jpg' },
  { id:'p002', name:'Sample  2', category:'product', image_file: 'i3.jpg' }
]

// Run the same embed.py as the server
function embedPath(absPath) {
  return new Promise((resolve, reject) => {
    const p = spawn(process.env.PYTHON || 'python', [path.join(__dirname, 'embed.py'), '--path', absPath])
    let out = '', err = ''
    p.stdout.on('data', d => out += d.toString())
    p.stderr.on('data', d => err += d.toString())
    p.on('close', c => {
      if (c !== 0) return reject(new Error(err || `embed.py exit ${c}`))
      try {
        const vec = JSON.parse(out)
        if (!Array.isArray(vec) || vec.length !== 2048) return reject(new Error('bad embedding length'))
        resolve(vec)
      } catch (e) {
        reject(new Error(`parse error: ${e.message}\nstdout:\n${out}\nstderr:\n${err}`))
      }
    })
  })
}

async function main(){
  const imgDir = path.join(__dirname, 'static', 'images')
  if (!fs.existsSync(imgDir)) fs.mkdirSync(imgDir, { recursive: true })

  for (const item of catalog) {
    const abs = path.join(imgDir, item.image_file)
    if (!fs.existsSync(abs)) { console.warn('Missing image file:', abs); continue }

    // Store a browser path for the frontend
    const product = {
      id: item.id,
      name: item.name,
      category: item.category,
      image_url: `/static/images/${item.image_file}`
    }
    await insertProduct(product)

    const vec = await embedPath(abs)
    await insertEmbedding(product.id, vec)
    console.log('Seeded', product.id)
  }
  console.log('Seeding complete.')
}

main().catch(e => { console.error(e); process.exit(1) })
