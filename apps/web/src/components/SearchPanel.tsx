import React, { useState, useEffect } from 'react'
import MovieCard from './MovieCard'
import { usePopular, useSimilar, usePersonalized, useSearchMovies, useAddRating, useRetrainStatus, useTriggerRetrain, useUserRatings, useDeleteRating, useUserHistorySimilar, useUserHistorySemantic } from '../hooks/useRecommendations'
import type { Movie } from '../api/movies'

type Tab = 'popular' | 'similar' | 'semantic' | 'personalized' | 'history'

const GRADIENTS = [
  'from-violet-600 via-indigo-950 to-slate-950 border-violet-500/20',
  'from-rose-600 via-pink-950 to-slate-950 border-rose-500/20',
  'from-cyan-500 via-blue-950 to-slate-950 border-cyan-500/20',
  'from-emerald-600 via-teal-950 to-slate-950 border-emerald-500/20',
  'from-amber-600 via-orange-950 to-slate-950 border-amber-500/20',
  'from-fuchsia-600 via-purple-950 to-slate-950 border-fuchsia-500/20',
]

export default function SearchPanel() {
  const [tab, setTab] = useState<Tab>('popular')
  const [activeUserId, setActiveUserId] = useState<number>(9999)

  
  // Search query states
  const [searchVal, setSearchVal] = useState('')
  const [debouncedSearchVal, setDebouncedSearchVal] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [activeSearchQuery, setActiveSearchQuery] = useState('')
  
  // TMDB API key state
  const [tmdbKey, setTmdbKey] = useState('')
  const [showSettings, setShowSettings] = useState(false)

  // Details Modal state
  const [detailsMovie, setDetailsMovie] = useState<{ movie: Movie; posterUrl: string | null } | null>(null)

  // Rating in modal state
  const [hoverRating, setHoverRating] = useState<number | null>(null)
  const [ratingSuccess, setRatingSuccess] = useState(false)
  const addRatingMutation = useAddRating()
  const { data: retrainStatus } = useRetrainStatus()
  const triggerRetrainMutation = useTriggerRetrain()
  const userRatingsQuery = useUserRatings(activeUserId)
  const deleteRatingMutation = useDeleteRating()

  const userRatingsMap = React.useMemo(() => {
    const map = new Map<number, number>()
    if (userRatingsQuery.data) {
      userRatingsQuery.data.forEach((r) => {
        map.set(r.movieId, r.rating)
      })
    }
    return map
  }, [userRatingsQuery.data])

  // Load TMDB key from localStorage on mount
  useEffect(() => {
    const savedKey = localStorage.getItem('tmdb_api_key') || ''
    setTmdbKey(savedKey)
  }, [])

  const saveTmdbKey = (key: string) => {
    localStorage.setItem('tmdb_api_key', key)
    setTmdbKey(key)
    setShowSettings(false)
    window.location.reload()
  }

  // Debounce search query
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchVal(searchVal)
    }, 250)
    return () => clearTimeout(handler)
  }, [searchVal])

  // Fetch TMDB poster for movie details modal if not already present
  useEffect(() => {
    if (detailsMovie && !detailsMovie.posterUrl && detailsMovie.movie.tmdbId) {
      const tmdbKey = localStorage.getItem('tmdb_api_key')
      if (tmdbKey) {
        fetch(`https://api.themoviedb.org/3/movie/${detailsMovie.movie.tmdbId}?api_key=${tmdbKey}`)
          .then((res) => {
            if (!res.ok) throw new Error('Poster not found')
            return res.json()
          })
          .then((data) => {
            if (data.poster_path) {
              setDetailsMovie((prev) => 
                prev && prev.movie.movieId === detailsMovie.movie.movieId 
                  ? { ...prev, posterUrl: `https://image.tmdb.org/t/p/w500${data.poster_path}` }
                  : prev
              )
            }
          })
          .catch(() => {})
      }
    }
  }, [detailsMovie])

  // Recommendation query hooks
  const popularQuery = usePopular()
  const userHistorySimilarQuery = useUserHistorySimilar(tab === 'similar' ? activeUserId : null)
  const userHistorySemanticQuery = useUserHistorySemantic(tab === 'semantic' ? activeUserId : null)
  const personalizedQuery = usePersonalized(tab === 'personalized' ? activeUserId : null)
  const searchQuery = useSearchMovies(activeSearchQuery)
  const suggestionsQuery = useSearchMovies(debouncedSearchVal)
  const modalSimilarQuery = useSimilar(detailsMovie ? detailsMovie.movie.movieId : null)

  const activeQuery = {
    popular: popularQuery,
    similar: userHistorySimilarQuery,
    semantic: userHistorySemanticQuery,
    personalized: personalizedQuery,
    history: userRatingsQuery,
  }[tab]

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setActiveSearchQuery(searchVal)
    setShowSuggestions(false)
  }

  const handleMovieSelect = (movie: Movie, posterUrl: string | null) => {
    setDetailsMovie({ movie, posterUrl })
  }

  const handleTabChange = (newTab: Tab) => {
    setTab(newTab)
    if (newTab === 'history') {
      userRatingsQuery.refetch()
    } else if (newTab === 'similar') {
      userHistorySimilarQuery.refetch()
    } else if (newTab === 'semantic') {
      userHistorySemanticQuery.refetch()
    }
  }

  const handleDeleteInModal = (movieId: number) => {
    deleteRatingMutation.mutate(
      { userId: activeUserId, movieId },
      {
        onSuccess: () => {
          // Invalidation refreshes list
        },
      }
    )
  }

  const handleRateInModal = (movieId: number, ratingValue: number) => {
    addRatingMutation.mutate(
      { userId: activeUserId, movieId, rating: ratingValue },
      {
        onSuccess: () => {
          setRatingSuccess(true)
          setTimeout(() => setRatingSuccess(false), 2000)
        },
      }
    )
  }

  // Helper to generate IMDb link
  const getImdbUrl = (imdbId?: number) => {
    if (!imdbId) return null
    const padded = imdbId.toString().padStart(7, '0')
    return `https://www.imdb.com/title/tt${padded}`
  }

  // Helper to choose gradient based on movieId
  const getGradientClass = (movieId: number) => GRADIENTS[movieId % GRADIENTS.length]

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      
      {/* Sleek Header */}
      <header className="sticky top-0 z-40 bg-slate-950/85 backdrop-blur-md border-b border-slate-900/60 px-8 py-3.5 shadow-md">
        <div className="max-w-[90rem] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {/* Sleek SVG Clapper Icon */}
            <div className="bg-indigo-500/10 p-2 rounded-xl border border-indigo-500/20 text-indigo-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125h-7.5a1.125 1.125 0 01-1.125-1.125m0 0v-1.5c0-.621.504-1.125 1.125-1.125m0 3.75h-7.5A1.125 1.125 0 013.375 16.5m0 0v-1.5c0-.621.504-1.125 1.125-1.125m9.75 0h7.5c.621 0 1.125.504 1.125 1.125m-18.375 0v-7.5A1.125 1.125 0 014.5 7.5h15a1.125 1.125 0 011.125 1.125v7.5m-17.25-9h17.25M6.75 20.25v-1.5" />
              </svg>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-black tracking-tight text-white font-heading">CineMind</span>
              <div className="h-4 w-px bg-slate-800 mx-1"></div>
              <span className="px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/20 rounded-md text-indigo-400 text-[9px] font-bold tracking-wider uppercase select-none">
                Two-Tower AI
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Active User ID Input */}
            <div className="flex items-center gap-1.5 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800 text-xs">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">User ID:</span>
              <input
                type="number"
                value={activeUserId}
                onChange={(e) => setActiveUserId(parseInt(e.target.value) || 0)}
                className="bg-transparent text-slate-100 font-extrabold w-12 text-center focus:outline-none"
                min={1}
              />
            </div>

            {/* Settings Button */}
            <button
              onClick={() => setShowSettings(true)}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 transition-colors text-slate-400 hover:text-slate-200 cursor-pointer"
              title="Configure TMDb API Key"
            >
              <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.43l-1.003.828c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.552 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.43l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Hero Welcome Banner */}
      <section className="bg-gradient-to-b from-slate-900 to-slate-950 px-8 py-14 flex flex-col items-center text-center border-b border-slate-900/60 select-none">
        <div className="max-w-[90rem] mx-auto w-full flex flex-col items-center">
          <div className="max-w-2xl flex flex-col gap-3">
            <span className="px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-indigo-400 text-xs font-semibold tracking-wider uppercase self-center">Powered by Neural Embeddings</span>
            <h2 className="text-4xl font-extrabold text-slate-100 tracking-tight sm:text-5xl font-heading">
              Discover Movies <br />
              <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-fuchsia-500 bg-clip-text text-transparent">Semantically & Personally</span>
            </h2>
            <p className="text-slate-400 text-sm leading-relaxed mt-2">
              Rate movies to dynamically build your interest profile. The system uses a Two-Tower neural network model for candidate retrieval and a LightGBM classification ranker to deliver top recommendations.
            </p>
          </div>

          {/* Global Movie Catalog Search */}
          <div 
            className="mt-8 relative w-full max-w-lg select-none"
            onMouseLeave={() => setShowSuggestions(false)}
          >
            <form onSubmit={handleSearchSubmit} className="flex gap-2.5 w-full">
              <div className="relative flex-1">
                <svg className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={searchVal}
                  onFocus={() => setShowSuggestions(true)}
                  onChange={(e) => {
                    setSearchVal(e.target.value)
                    setShowSuggestions(true)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setShowSuggestions(false)
                    }
                  }}
                  placeholder="Search movie catalog to rate..."
                  className="bg-slate-900 border border-slate-800 rounded-2xl pl-10 pr-4 py-3.5 text-sm w-full text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all shadow-inner"
                />
              </div>
              <button
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-6 py-3.5 rounded-2xl text-sm transition-all hover:shadow-lg hover:shadow-indigo-500/20 active:scale-95 cursor-pointer"
              >
                Search
              </button>
            </form>

            {/* Suggestions Dropdown */}
            {showSuggestions && searchVal.trim().length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-2 z-50 bg-slate-900/95 backdrop-blur-md border border-slate-800/80 rounded-2xl overflow-hidden shadow-2xl max-h-72 overflow-y-auto divide-y divide-slate-800/40">
                {suggestionsQuery.isLoading && (
                  <div className="px-4 py-3 text-xs text-slate-500 flex items-center gap-2">
                    <div className="w-3.5 h-3.5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                    <span>Finding matching titles...</span>
                  </div>
                )}
                {suggestionsQuery.isError && (
                  <div className="px-4 py-3 text-xs text-rose-400">
                    Failed to fetch suggestions
                  </div>
                )}
                {suggestionsQuery.data && suggestionsQuery.data.length === 0 && (
                  <div className="px-4 py-3 text-xs text-slate-500 italic">
                    No suggestions found
                  </div>
                )}
                {suggestionsQuery.data && suggestionsQuery.data.length > 0 && (
                  suggestionsQuery.data.slice(0, 8).map((movie) => (
                    <button
                      key={movie.movieId}
                      onClick={() => {
                        setSearchVal(movie.title)
                        setShowSuggestions(false)
                        handleMovieSelect(movie, null)
                      }}
                      className="w-full px-4 py-3 hover:bg-slate-800/70 transition-colors cursor-pointer flex items-center justify-between text-left group border-none bg-transparent outline-none focus:bg-slate-800/70"
                    >
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-bold text-slate-200 group-hover:text-indigo-400 transition-colors">
                          {movie.title}
                        </span>
                        {movie.genres && (
                          <span className="text-[11px] text-slate-500">
                            {movie.genres.replace(/\|/g, ' · ')}
                          </span>
                        )}
                      </div>
                      <div className="text-slate-600 group-hover:text-indigo-400 transition-colors flex-shrink-0 ml-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
                        </svg>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Main content grid - ALIGNED TO 90rem */}
      <main className="flex-1 px-8 py-8 max-w-[90rem] mx-auto w-full flex flex-col gap-6">
        
        {/* Search Results Panel */}
        {activeSearchQuery && (
          <section className="bg-slate-900/40 border border-slate-900/80 rounded-3xl p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2 font-heading">
                🔍 Search Results for: <span className="text-indigo-400">"{activeSearchQuery}"</span>
              </h3>
              <button
                onClick={() => { setSearchVal(''); setActiveSearchQuery('') }}
                className="text-xs text-slate-500 hover:text-slate-300 font-semibold cursor-pointer"
              >
                Clear Results
              </button>
            </div>
            
            {searchQuery.isLoading && <p className="text-slate-500 text-sm animate-pulse">Searching catalog...</p>}
            {searchQuery.isError && <p className="text-rose-400 text-sm">Failed to search movies.</p>}
            
            {searchQuery.data && searchQuery.data.length === 0 ? (
              <p className="text-slate-500 text-sm">No movies found matching your query.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                {searchQuery.data?.map((movie) => (
                  <MovieCard 
                    key={movie.movieId} 
                    movie={movie} 
                    activeUserId={activeUserId}
                    userRating={userRatingsMap.get(movie.movieId) || null}
                    onMovieClick={handleMovieSelect}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {/* Tab Controls */}
        <div className="flex items-center justify-between border-b border-slate-900 pb-3 mt-4">
          <div className="flex gap-2 overflow-x-auto pb-1 select-none">
            {([
              { key: 'popular', label: '🍿 Popular', desc: 'Highest rated and most reviewed classics' },
              { key: 'personalized', label: '👤 Personalized', desc: 'Neural recommendations scaled for your User ID' },
              { key: 'history', label: '🎬 History', desc: 'Your watch history and saved ratings' },
              { key: 'similar', label: '🔄 Similar Movies', desc: 'Find titles related to a seed film' },
              { key: 'semantic', label: '🧠 Semantic', desc: 'Textual metadata search matching plots & genres' }
            ] as const).map((t) => (
              <button
                key={t.key}
                onClick={() => handleTabChange(t.key)}
                className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-300 cursor-pointer whitespace-nowrap ${
                  tab === t.key 
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20' 
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
                }`}
                title={t.desc}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Context Display (Seed movie info) */}
          {(tab === 'similar' || tab === 'semantic') && (
            <div className="text-[11px] text-slate-400 font-semibold bg-slate-900/60 border border-slate-900 px-3 py-1.5 rounded-xl flex items-center gap-2">
              <span>Feeds:</span>
              <strong className="text-indigo-400 font-bold">
                History-Personalized
              </strong>
            </div>
          )}
        </div>

        {/* Tab description */}
        <p className="text-xs text-slate-500">
          {tab === 'popular' && 'Showing top public titles. Click a poster to view details, ratings, and similar titles.'}
          {tab === 'personalized' && `Showing recommendations tailored to User #${activeUserId}. Add ratings in real time to shift the calculations.`}
          {tab === 'history' && 'Displays your watched and rated movies. You can update ratings or remove movies from your history.'}
          {tab === 'similar' && 'Collaborative similar recommendations generated dynamically from your top rated history.'}
          {tab === 'semantic' && 'Semantic plot similarity matches generated dynamically from your top rated history.'}
        </p>

        {/* Recommendations list */}
        {activeQuery.isLoading && (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-slate-500 text-sm">Fetching movies...</p>
          </div>
        )}
        
        {activeQuery.isError && (
          <p className="text-rose-400 text-sm text-center py-20 bg-slate-900/20 border border-slate-900 rounded-3xl">
            Failed to load recommendations. Please verify the backend is running.
          </p>
        )}

        {activeQuery.data && activeQuery.data.length === 0 && (
          <div className="text-slate-500 text-center py-20 bg-slate-900/10 border border-slate-900 rounded-3xl text-sm flex flex-col items-center justify-center gap-3 select-none">
            {tab === 'similar' || tab === 'semantic' ? (
              <>
                <svg className="w-10 h-10 text-slate-700" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499c-.107-.19-.3-.309-.517-.309s-.41.119-.517.309L7.818 8.427l-5.69.827c-.216.03-.393.18-.466.383-.073.203-.024.428.125.578l4.117 4.01-.973 5.667c-.037.216.046.43.22.56.173.13.413.14.596.036L11 17.25l5.068 2.66c.183.104.423.094.596-.036.174-.13.257-.344.22-.56l-.973-5.667 4.117-4.01c.149-.15.198-.375.125-.578-.073-.203-.25-.353-.466-.383l-5.69-.827-2.646-4.928z" />
                </svg>
                <div className="max-w-md">
                  <p className="font-bold text-slate-300 mb-1">No Rated Movies Found</p>
                  <p className="text-xs text-slate-500 leading-normal text-center">
                    Add a rating of 3+ stars to movies in the <strong>Popular</strong> feed or search catalog above to unlock history-based Similar & Semantic recommendations!
                  </p>
                </div>
              </>
            ) : (
              <span>No recommendations found.</span>
            )}
          </div>
        )}

        {activeQuery.data && activeQuery.data.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
            {activeQuery.data.map((movie) => (
              <MovieCard
                key={movie.movieId}
                movie={movie}
                activeUserId={activeUserId}
                userRating={userRatingsMap.get(movie.movieId) || null}
                onMovieClick={handleMovieSelect}
              />
            ))}
          </div>
        )}
      </main>

      {/* TMDb Settings Modal */}
      {showSettings && (
        <div 
          onClick={() => setShowSettings(false)}
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 select-none"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl relative"
          >
            {/* Close button */}
            <button
              onClick={() => setShowSettings(false)}
              className="absolute top-4 right-4 z-10 p-2 rounded-full bg-slate-950/50 hover:bg-slate-800 text-slate-400 hover:text-slate-100 transition-colors cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <h3 className="text-lg font-black text-slate-100 mb-2 font-heading">Settings</h3>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              Input a TMDb API Key to display movie posters. API keys are stored locally in your browser's local storage.
            </p>
            <input
              type="text"
              value={tmdbKey}
              onChange={(e) => setTmdbKey(e.target.value)}
              placeholder="Enter TMDb API Key..."
              className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm w-full text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 mb-6"
            />
            <div className="flex justify-end gap-2 text-sm mb-6">
              <button
                onClick={() => setShowSettings(false)}
                className="px-4 py-2 rounded-xl text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => saveTmdbKey(tmdbKey)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold cursor-pointer transition-colors"
              >
                Save & Reload
              </button>
            </div>

            {/* Divider */}
            <div className="h-px bg-slate-800/80 my-5" />

            <h3 className="text-sm font-bold text-slate-200 mb-1.5 uppercase tracking-wider font-heading">Model Optimization</h3>
            <p className="text-xs text-slate-400 mb-3 leading-relaxed">
              Re-train the Two-Tower embedding network and LightGBM classifier with new rating logs to update recommendations.
            </p>

            {/* Retrain status view */}
            <div className="bg-slate-950 border border-slate-800/60 rounded-xl p-4 mb-6 flex flex-col gap-3 text-xs select-none">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-semibold uppercase tracking-wider text-[10px]">Status:</span>
                <span className={`font-bold px-2 py-0.5 rounded text-[10px] uppercase tracking-wider ${
                  retrainStatus?.status === 'running' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 animate-pulse' :
                  retrainStatus?.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                  retrainStatus?.status === 'failed' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                  'bg-slate-800 text-slate-400'
                }`}>
                  {retrainStatus?.status || 'idle'}
                </span>
              </div>

              {retrainStatus?.status === 'running' && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-indigo-400">
                    <div className="w-3.5 h-3.5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
                    <span className="font-medium animate-pulse">{retrainStatus.current_step}</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden relative">
                    <div className="absolute top-0 bottom-0 left-0 bg-indigo-500 rounded-full animate-progress-glow w-1/2"></div>
                  </div>
                </div>
              )}

              {retrainStatus?.completed_at && retrainStatus.status === 'completed' && (
                <div className="text-[11px] text-emerald-400 font-medium">
                  ✓ Successfully optimized at {retrainStatus.completed_at}
                </div>
              )}

              {retrainStatus?.status === 'failed' && retrainStatus.last_error && (
                <div className="text-[11px] text-rose-400 leading-normal max-h-24 overflow-y-auto font-mono bg-slate-900 p-2 rounded-lg border border-rose-500/10">
                  {retrainStatus.last_error}
                </div>
              )}
            </div>

            <button
              onClick={() => triggerRetrainMutation.mutate()}
              disabled={retrainStatus?.status === 'running' || triggerRetrainMutation.isPending}
              className={`w-full font-bold py-2.5 px-4 rounded-xl text-xs transition-all active:scale-98 cursor-pointer flex items-center justify-center gap-2 ${
                retrainStatus?.status === 'running'
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white hover:shadow-lg hover:shadow-indigo-500/15'
              }`}
            >
              {retrainStatus?.status === 'running' ? 'Optimization in Progress...' : 'Start Retraining Pipeline'}
            </button>
          </div>
        </div>
      )}

      {/* Movie Details Fullscreen Modal */}
      {detailsMovie && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden w-full max-w-3xl shadow-2xl relative flex flex-col md:flex-row h-auto max-h-[90vh]">
            
            {/* Close button */}
            <button
              onClick={() => { setDetailsMovie(null); setHoverRating(null) }}
              className="absolute top-4 right-4 z-10 p-2 rounded-full bg-slate-950/50 hover:bg-slate-800 text-slate-400 hover:text-slate-100 transition-colors cursor-pointer"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Left Column: Image/Poster */}
            <div className="w-full md:w-2/5 bg-slate-950 flex items-center justify-center min-h-[320px] md:min-h-0 relative select-none">
              {detailsMovie.posterUrl ? (
                <img 
                  src={detailsMovie.posterUrl} 
                  alt={detailsMovie.movie.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className={`w-full h-full bg-gradient-to-br ${getGradientClass(detailsMovie.movie.movieId)} flex flex-col items-center justify-center p-6 min-h-[320px] md:absolute md:inset-0`}>
                  <div className="text-8xl font-black text-slate-100/10 mb-2 font-heading">
                    {detailsMovie.movie.title.trim().charAt(0).toUpperCase()}
                  </div>
                  <div className="text-center font-bold text-slate-300 px-4 text-sm">
                    {detailsMovie.movie.title}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Metadata details & Ratings */}
            <div className="p-8 flex-1 flex flex-col justify-between overflow-y-auto">
              <div className="flex flex-col gap-2">
                <span className="px-2.5 py-0.5 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-indigo-400 text-[10px] font-bold tracking-wider uppercase self-start select-none">
                  Movie Profile
                </span>
                <h2 className="text-2xl font-black text-slate-100 tracking-tight leading-tight mt-1 font-heading">
                  {detailsMovie.movie.title}
                </h2>
                {detailsMovie.movie.genres && (
                  <p className="text-sm text-indigo-400/90 font-medium mb-4 select-none">
                    {detailsMovie.movie.genres.replace(/\|/g, ' · ')}
                  </p>
                )}

                {/* Database Info Grid */}
                <div className="grid grid-cols-3 gap-3 border-t border-b border-slate-800/80 py-4 mb-4 text-xs select-none">
                  <div>
                    <span className="block text-slate-500 font-semibold uppercase tracking-wider text-[9px] mb-1">Movie ID</span>
                    <strong className="text-slate-300 font-bold">{detailsMovie.movie.movieId}</strong>
                  </div>
                  <div>
                    <span className="block text-slate-500 font-semibold uppercase tracking-wider text-[9px] mb-1">IMDb ID</span>
                    <strong className="text-slate-300 font-bold">{detailsMovie.movie.imdbId || 'N/A'}</strong>
                  </div>
                  <div>
                    <span className="block text-slate-500 font-semibold uppercase tracking-wider text-[9px] mb-1">TMDb ID</span>
                    <strong className="text-slate-300 font-bold">{detailsMovie.movie.tmdbId || 'N/A'}</strong>
                  </div>
                </div>

                {/* External links */}
                <div className="flex gap-3 mb-6 select-none">
                  {detailsMovie.movie.imdbId && getImdbUrl(detailsMovie.movie.imdbId) && (
                    <a
                      href={getImdbUrl(detailsMovie.movie.imdbId)!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl text-xs font-black tracking-wide flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <span>IMDb</span>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  )}
                  {detailsMovie.movie.tmdbId && (
                    <a
                      href={`https://www.themoviedb.org/movie/${detailsMovie.movie.tmdbId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-slate-100 rounded-xl text-xs font-black tracking-wide flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <span>TMDb</span>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  )}
                </div>
              </div>

              {/* Rate & Recommender actions */}
              <div className="flex flex-col gap-4 mt-4 border-t border-slate-800/50 pt-4">
                {/* Rate this movie */}
                <div className="flex items-center justify-between select-none">
                  <div className="flex items-center gap-3">
                    <div>
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Your Rating</h4>
                      <p className="text-[10px] text-slate-500">Influence recommendation vector</p>
                    </div>
                    {userRatingsMap.get(detailsMovie.movie.movieId) !== undefined && (
                      <button
                        onClick={() => handleDeleteInModal(detailsMovie.movie.movieId)}
                        disabled={deleteRatingMutation.isPending}
                        className="text-[9px] text-rose-400 hover:text-rose-300 font-bold uppercase tracking-wider border border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/10 px-2 py-0.5 rounded transition-colors cursor-pointer"
                      >
                        {deleteRatingMutation.isPending ? 'Removing...' : 'Remove'}
                      </button>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onMouseEnter={() => setHoverRating(star)}
                          onMouseLeave={() => setHoverRating(null)}
                          onClick={() => handleRateInModal(detailsMovie.movie.movieId, star)}
                          disabled={addRatingMutation.isPending}
                          className="focus:outline-none transition-transform hover:scale-125 cursor-pointer"
                        >
                          <svg
                            className={`w-6 h-6 transition-colors ${
                              hoverRating !== null
                                ? star <= hoverRating
                                  ? 'text-indigo-400 fill-indigo-400'
                                  : 'text-slate-700'
                                : userRatingsMap.get(detailsMovie.movie.movieId) && star <= userRatingsMap.get(detailsMovie.movie.movieId)!
                                ? 'text-amber-400 fill-amber-400'
                                : 'text-slate-700'
                            }`}
                            fill={
                              hoverRating !== null
                                ? star <= hoverRating ? 'currentColor' : 'none'
                                : userRatingsMap.get(detailsMovie.movie.movieId) && star <= userRatingsMap.get(detailsMovie.movie.movieId)! ? 'currentColor' : 'none'
                            }
                            stroke="currentColor"
                            strokeWidth="2"
                            viewBox="0 0 24 24"
                          >
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                          </svg>
                        </button>
                      ))}
                    </div>
                    
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider min-w-[50px] text-right">
                      {addRatingMutation.isPending ? (
                        <span className="text-indigo-400 animate-pulse">...</span>
                      ) : ratingSuccess ? (
                        <span className="text-emerald-400">Done!</span>
                      ) : (
                        <span>Rate</span>
                      )}
                    </span>
                  </div>
                </div>

                {/* More Like This Panel */}
                <div className="mt-6 border-t border-slate-800/80 pt-6">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">More Like This</h4>
                  {modalSimilarQuery.isLoading && (
                    <div className="flex items-center justify-center py-6 gap-2">
                      <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-xs text-slate-500">Loading similarities...</span>
                    </div>
                  )}
                  {modalSimilarQuery.isError && (
                    <p className="text-xs text-rose-400">Failed to load similar movies.</p>
                  )}
                  {modalSimilarQuery.data && modalSimilarQuery.data.length === 0 && (
                    <p className="text-xs text-slate-500 italic">No similar movies found.</p>
                  )}
                  {modalSimilarQuery.data && modalSimilarQuery.data.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {modalSimilarQuery.data.slice(0, 6).map((simMovie) => {
                        return (
                          <div
                            key={simMovie.movieId}
                            onClick={() => handleMovieSelect(simMovie, null)}
                            className="bg-slate-950/40 border border-slate-800 hover:border-indigo-500/50 hover:bg-slate-900/60 rounded-xl p-2.5 transition-all cursor-pointer flex flex-col justify-between h-28 group/mini"
                          >
                            <div className="flex flex-col gap-1">
                              <span className="text-xs font-bold text-slate-200 line-clamp-2 group-hover/mini:text-indigo-400 transition-colors leading-tight" title={simMovie.title}>
                                {simMovie.title}
                              </span>
                              {simMovie.genres && (
                                <span className="text-[10px] text-slate-500 line-clamp-1">
                                  {simMovie.genres.replace(/\|/g, ' · ')}
                                </span>
                              )}
                            </div>
                            <div className="text-[9px] font-bold text-indigo-400/80 group-hover/mini:text-indigo-400 flex items-center gap-0.5 mt-1 select-none">
                              <span>Details</span>
                              <svg className="w-2.5 h-2.5 transition-transform group-hover/mini:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                              </svg>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-6 text-center text-xs text-slate-600">
        <p>© 2026 CineMind Recommendations. Built with Two-Tower Retrieval + LGBM Ranker.</p>
      </footer>

    </div>
  )
}
