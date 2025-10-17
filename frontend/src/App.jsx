import React, { useState } from 'react'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000'

function fmtSim(v) {
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n)) return '—'
  return n.toFixed(3)
}

export default function App() {
  const [file, setFile] = useState(null)
  const [imageUrl, setImageUrl] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [topK, setTopK] = useState(8)
  const [minScore, setMinScore] = useState(0.0)
  const [preview, setPreview] = useState('')

  async function pingHealth() {
    try {
      const res = await fetch(`${API_BASE}/api/health`)
      const json = await res.json()
      alert(JSON.stringify(json))
    } catch (e) {
      alert('Health check failed: ' + e)
    }
  }

  async function onMatch() {
    setLoading(true); setError(''); setResults([])
    try {
      let res
      if (file) {
        const form = new FormData()
        form.append('file', file)
        res = await fetch(`${API_BASE}/api/match?top_k=${topK}&min_score=${minScore}`, {
          method: 'POST', body: form
        })
      } else if (imageUrl.trim()) {
        res = await fetch(`${API_BASE}/api/match`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image_url: imageUrl, top_k: topK, min_score: minScore })
        })
      } else {
        setError('Choose a file or enter an image URL'); setLoading(false); return
      }

      if (!res.ok) {
        const text = await res.text()
        throw new Error(`HTTP ${res.status}: ${text}`)
      }

      const data = await res.json()
      const clean = (data.results || [])
        .filter(x => x && Number.isFinite(Number(x.similarity)))
      setResults(clean)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  function onFileChange(e) {
    const f = e.target.files?.[0]
    setFile(f || null)
    setImageUrl('')
    setPreview(f ? URL.createObjectURL(f) : '')
  }

  return (
    <div className="container">
      <h2>Visual Product Matcher</h2>
      <button onClick={pingHealth}>Check API</button>
      <div className="controls">
        <input type="file" accept="image/*" onChange={onFileChange} />
        <input
          type="text"
          placeholder="or paste image URL"
          value={imageUrl}
          onChange={e => { setImageUrl(e.target.value); setFile(null); setPreview(e.target.value) }}
        />
        <input
          type="number"
          min="1"
          value={topK}
          onChange={e => setTopK(parseInt(e.target.value || 1))}
        />
        <input
          type="number"
          step="0.01"
          min="0"
          max="1"
          value={minScore}
          onChange={e => setMinScore(parseFloat(e.target.value || 0))}
        />
        <button className="button" onClick={onMatch} disabled={loading}>Find Matches</button>
      </div>

      {preview ? <div className="row"><img className="thumb" src={preview} alt="preview" /></div> : null}
      {loading ? <p>Loading...</p> : null}
      {error ? <p style={{ color: 'crimson' }}>{error}</p> : null}

      <div className="grid">
        {(results || []).map(r => (
          <div key={r.product_id || `${r.name}-${r.image_url}`} className="card">
            <img className="thumb" src={r.image_url || ''} alt={r.name || ''} />
            <div className="row">
              <span className="badge">{fmtSim(r.similarity)}</span>
              <b>{r.name || 'Unnamed'}</b>
            </div>
            <div>{r.category || ''}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
