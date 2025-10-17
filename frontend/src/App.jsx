import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, Link2, Search, AlertCircle, CheckCircle } from 'lucide-react'

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
  const [healthStatus, setHealthStatus] = useState(null)

  async function pingHealth() {
    try {
      const res = await fetch(`${API_BASE}/api/health`)
      const json = await res.json()
      setHealthStatus({ success: true, data: json })
      setTimeout(() => setHealthStatus(null), 3000)
    } catch (e) {
      setHealthStatus({ success: false, error: String(e) })
      setTimeout(() => setHealthStatus(null), 3000)
    }
  }

  async function onMatch() {
    setLoading(true)
    setError('')
    setResults([])
    try {
      let res
      if (file) {
        const form = new FormData()
        form.append('file', file)
        res = await fetch(`${API_BASE}/api/match?top_k=${topK}&min_score=${minScore}`, {
          method: 'POST',
          body: form
        })
      } else if (imageUrl.trim()) {
        res = await fetch(`${API_BASE}/api/match`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image_url: imageUrl, top_k: topK, min_score: minScore })
        })
      } else {
        setError('Choose a file or enter an image URL')
        setLoading(false)
        return
      }

      if (!res.ok) {
        const text = await res.text()
        throw new Error(`HTTP ${res.status}: ${text}`)
      }

      const data = await res.json()
      const clean = (data.results || []).filter(x => x && Number.isFinite(Number(x.similarity)))
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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="border-b border-slate-700 bg-slate-800/50 backdrop-blur"
      >
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                Visual Product Matcher
              </h1>
              <p className="text-slate-400 mt-2">Find similar products using AI-powered image matching</p>
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={pingHealth}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition"
            >
              Check API
            </motion.button>
          </div>
        </div>
      </motion.div>

      {/* Health Status Notification */}
      <AnimatePresence>
        {healthStatus && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`mx-6 mt-4 p-4 rounded-lg flex items-center gap-3 ${
              healthStatus.success
                ? 'bg-green-900/30 border border-green-500/50 text-green-300'
                : 'bg-red-900/30 border border-red-500/50 text-red-300'
            }`}
          >
            {healthStatus.success ? (
              <CheckCircle size={20} />
            ) : (
              <AlertCircle size={20} />
            )}
            <span className="text-sm">
              {healthStatus.success ? 'API is healthy ✓' : `API error: ${healthStatus.error}`}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Controls Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-2xl p-8 mb-12"
        >
          <h2 className="text-lg font-semibold text-white mb-6">Upload or Link an Image</h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* File Upload */}
            <motion.label
              whileHover={{ borderColor: '#60a5fa' }}
              className="relative cursor-pointer"
            >
              <div className="border-2 border-dashed border-slate-600 rounded-xl p-8 text-center hover:border-blue-500 transition">
                <Upload className="mx-auto mb-3 text-slate-400" size={32} />
                <p className="text-white font-medium">Click to upload image</p>
                <p className="text-slate-400 text-sm mt-1">or drag and drop</p>
                <input
                  type="file"
                  accept="image/*"
                  onChange={onFileChange}
                  className="hidden"
                />
              </div>
            </motion.label>

            {/* URL Input */}
            <div className="relative">
              <div className="absolute left-3 top-3 text-slate-400">
                <Link2 size={20} />
              </div>
              <input
                type="text"
                placeholder="or paste image URL"
                value={imageUrl}
                onChange={e => {
                  setImageUrl(e.target.value)
                  setFile(null)
                  setPreview(e.target.value)
                }}
                className="w-full pl-10 pr-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition"
              />
            </div>
          </div>

          {/* Parameters */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-2">Top Results</label>
              <input
                type="number"
                min="1"
                value={topK}
                onChange={e => setTopK(parseInt(e.target.value || 1))}
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500 transition"
              />
            </div>
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-2">Min Score</label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="1"
                value={minScore}
                onChange={e => setMinScore(parseFloat(e.target.value || 0))}
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500 transition"
              />
            </div>
          </div>

          {/* Search Button */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onMatch}
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition flex items-center justify-center gap-2"
          >
            <Search size={20} />
            {loading ? 'Searching...' : 'Find Matches'}
          </motion.button>
        </motion.div>

        {/* Preview Image */}
        <AnimatePresence>
          {preview && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mb-12"
            >
              <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-2xl p-6">
                <h3 className="text-white font-semibold mb-4">Query Image</h3>
                <motion.img
                  layoutId="preview"
                  src={preview}
                  alt="preview"
                  className="max-h-64 mx-auto rounded-xl"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error Message */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-6 p-4 bg-red-900/30 border border-red-500/50 text-red-300 rounded-lg flex items-center gap-3"
            >
              <AlertCircle size={20} />
              <span>{error}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Loading State */}
        <AnimatePresence>
          {loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex justify-center items-center py-12"
            >
              <div className="flex gap-2">
                {[0, 1, 2].map(i => (
                  <motion.div
                    key={i}
                    animate={{ y: [0, -10, 0] }}
                    transition={{ duration: 0.6, delay: i * 0.1, repeat: Infinity }}
                    className="w-3 h-3 bg-blue-400 rounded-full"
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results Grid */}
        <AnimatePresence>
          {results.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <h2 className="text-2xl font-bold text-white mb-8">Matching Products</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {results.map((r, idx) => (
                  <motion.div
                    key={r.product_id || `${r.name}-${r.image_url}`}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    whileHover={{ y: -8 }}
                    className="group bg-slate-800/50 backdrop-blur border border-slate-700 hover:border-blue-500 rounded-xl overflow-hidden transition cursor-pointer"
                  >
                    <div className="relative overflow-hidden bg-slate-700 h-48">
                      <img
                        src={r.image_url || ''}
                        alt={r.name || ''}
                        className="w-full h-full object-cover group-hover:scale-110 transition duration-500"
                      />
                      <motion.div
                        initial={{ opacity: 0 }}
                        whileHover={{ opacity: 1 }}
                        className="absolute inset-0 bg-black/30"
                      />
                    </div>
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold text-white text-sm line-clamp-2 flex-1">
                          {r.name || 'Unnamed'}
                        </h3>
                        <motion.span
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="ml-2 px-3 py-1 bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-xs font-bold rounded-full whitespace-nowrap"
                        >
                          {fmtSim(r.similarity)}
                        </motion.span>
                      </div>
                      {r.category && (
                        <p className="text-slate-400 text-xs">{r.category}</p>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty State */}
        {!loading && results.length === 0 && !error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-20"
          >
            <Search size={48} className="mx-auto text-slate-500 mb-4" />
            <p className="text-slate-400 text-lg">Upload an image to find matching products</p>
          </motion.div>
        )}
      </div>
    </div>
  )
}