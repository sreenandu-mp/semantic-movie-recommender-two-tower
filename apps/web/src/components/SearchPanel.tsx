import { useState } from 'react'
import MovieCard from './MovieCard'
import { usePopular, useSimilar, useSemantic, usePersonalized } from '../hooks/useRecommendations'

type Tab = 'popular' | 'similar' | 'semantic' | 'personalized'

export default function SearchPanel() {
  const [tab, setTab] = useState<Tab>('popular')
  const [movieId, setMovieId] = useState<number | null>(null)
  const [userId, setUserId] = useState<number | null>(null)
  const [inputVal, setInputVal] = useState('')

  const popular = usePopular()
  const similar = useSimilar(tab === 'similar' ? movieId : null)
  const semantic = useSemantic(tab === 'semantic' ? movieId : null)
  const personalized = usePersonalized(tab === 'personalized' ? userId : null)

  const query = { popular, similar, semantic, personalized }[tab]
  const needsMovieId = tab === 'similar' || tab === 'semantic'
  const needsUserId = tab === 'personalized'

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const val = parseInt(inputVal)
    if (isNaN(val)) return
    if (needsMovieId) setMovieId(val)
    if (needsUserId) setUserId(val)
  }

  const tabs: Tab[] = ['popular', 'similar', 'semantic', 'personalized']

  return (
    <div className="max-w-3xl mx-auto p-6 flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-gray-900">🎬 Movie Recommender</h1>

      <div className="flex gap-2 flex-wrap">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setInputVal(''); setMovieId(null); setUserId(null) }}
            className={`px-4 py-1.5 rounded-full text-sm font-medium capitalize transition-colors ${
              tab === t ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {(needsMovieId || needsUserId) && (
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="number"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            placeholder={needsMovieId ? 'Enter Movie ID' : 'Enter User ID'}
            className="border border-gray-300 rounded-lg px-4 py-2 text-sm w-48 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          <button
            type="submit"
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700"
          >
            Search
          </button>
        </form>
      )}

      {query.isLoading && <p className="text-gray-400 text-sm">Loading...</p>}
      {query.isError && <p className="text-red-400 text-sm">Failed to load results.</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {query.data?.map((movie) => (
          <MovieCard key={movie.movieId} movie={movie} />
        ))}
      </div>
    </div>
  )
}
