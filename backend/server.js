import express from 'express'
import multer from 'multer'
import os from 'os'
import path from 'path'
import { fileURLToPath } from 'url'
import { spawn } from 'child_process'
import fs from 'fs'
import cors from 'cors'
import { getAllProducts, getAllEmbeddings } from './db.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()

// Enable CORS for the frontend dev server
app.use(cors({ origin: 'http://localhost:5173' }))
app.use(express.json({ limit: '6mb' }))

// Serve static assets if your DB image_url points to /static/images/...
app.use('/static', express.static(path.join(__dirname, 'static')))

const upload = multer({ dest: path.join(os.tmpdir(), 'vpm_uploads') })

function runEmbed(args) {
  return new Promise((resolve, reject) => {
    const p = spawn(process.env.PYTHON || 'python', [path.join(__dirname, 'embed.py'), ...args])
    let out = '', err = ''
    p.stdout.on('data', d => out += d.toString())
    p.stderr.on('data', d => err += d.toString())
    p.on('close', c => {
      if (c !== 0) return reject(new Error(err || `embed.py exit ${c}`))
      try {
        // Try to extract a JSON array or object from stdout
        const arrStart = out.lastIndexOf('[')
        const arrEnd = out.lastIndexOf(']')
        const objStart = out.lastIndexOf('{')
        const objEnd = out.lastIndexOf('}')
        let jsonText = ''
        if (arrStart !== -1 && arrEnd !== -1 && arrEnd > arrStart) {
          jsonText = out.slice(arrStart, arrEnd + 1).trim()
        } else if (objStart !== -1 && objEnd !== -1 && objEnd > objStart) {
          jsonText = out.slice(objStart, objEnd + 1).trim()
        } else {
          throw new Error('No JSON found in embed.py stdout')
        }
        const parsed = JSON.parse(jsonText)
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && parsed.error) {
          return reject(new Error(`embed.py error: ${parsed.error}: ${parsed.detail || ''}`))
        }
        resolve(parsed)
      } catch (e) {
        reject(new Error(`Failed to parse embed.py output: ${e.message}\nSTDOUT:\n${out}\nSTDERR:\n${err}`))
      }
    })
  })
}

function cosine(q, mat) {
  const sims = new Float32Array(mat.length)
  for (let i = 0; i < mat.length; i++) {
    let s = 0
    const row = mat[i]
    for (let j = 0; j < 2048; j++) s += q[j] * row[j]
    sims[i] = s
  }
  return sims
}

app.get('/', (_req, res) => {
  res.send('Visual Product Matcher API. See GET /api/health and POST /api/match.')
})

app.get('/api/health', async (_req, res) => {
  const products = (await getAllProducts()).length
  const embeddings = (await getAllEmbeddings()).length
  res.json({ status: 'ok', products, embeddings })
})

app.post('/api/match', upload.single('file'), async (req, res) => {
  try {
    const top_k = Math.min(parseInt(req.query.top_k || req.body?.top_k || 12), 100)
    const min_score = parseFloat(req.query.min_score || req.body?.min_score || 0.0)

    let qvec
    if (req.file) {
      qvec = await runEmbed(['--path', req.file.path])
      fs.unlink(req.file.path, () => {})
    } else if (req.is('application/json') && req.body?.image_url) {
      qvec = await runEmbed(['--url', req.body.image_url])
    } else {
      return res.status(400).json({ error: "Provide multipart 'file' or JSON {image_url}" })
    }

    const products = await getAllProducts()
    const embs = await getAllEmbeddings()
    if (embs.length === 0) return res.status(503).json({ error: 'No embeddings. Run seeding.' })

    const idToVec = new Map(embs.map(e => [e.id, e.vec]))
    const mat = []
    const meta = []
    for (const p of products) {
      const v = idToVec.get(p.id)
      if (!v) continue
      mat.push(v)
      meta.push(p)
    }

    const sims = cosine(qvec, mat)
    const order = [...sims.keys()].sort((a, b) => sims[b] - sims[a])

    const results = []
    for (const k of order) {
      if (results.length >= top_k) break
      const score = sims[k]
      if (score < min_score) continue
      const p = meta[k]
      results.push({
        product_id: p.id,
        name: p.name,
        category: p.category,
        image_url: p.image_url,
        similarity: score
      })
    }
    res.json({ count: results.length, results })
  } catch (e) {
    console.error('MATCH_ERROR:', e)
    res.status(500).json({ error: 'match_failed', detail: String(e) })
  }
})

const PORT = process.env.PORT || 5000
app.listen(PORT, () => console.log(`Backend running at http://localhost:${PORT}`))
