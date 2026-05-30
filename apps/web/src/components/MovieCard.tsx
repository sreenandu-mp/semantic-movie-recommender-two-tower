import { useState, useEffect } from 'react'
import type { Movie } from '../api/movies'
import { useAddRating } from '../hooks/useRecommendations'

interface MovieCardProps {
  movie: Movie
  activeUserId: number | null
  userRating?: number | null
  onMovieClick?: (movie: Movie, posterUrl: string | null) => void
}

const GRADIENTS = [
  'from-violet-600 via-indigo-950 to-slate-950 border-violet-500/20',
  'from-rose-600 via-pink-950 to-slate-950 border-rose-500/20',
  'from-cyan-500 via-blue-950 to-slate-950 border-cyan-500/20',
  'from-emerald-600 via-teal-950 to-slate-950 border-emerald-500/20',
  'from-amber-600 via-orange-950 to-slate-950 border-amber-500/20',
  'from-fuchsia-600 via-purple-950 to-slate-950 border-fuchsia-500/20',
]

export default function MovieCard({ movie, activeUserId, userRating, onMovieClick }: MovieCardProps) {
  const [posterUrl, setPosterUrl] = useState<string | null>(null)
  const [loadingPoster, setLoadingPoster] = useState(false)
  const [hoverRating, setHoverRating] = useState<number | null>(null)
  const [ratingSuccess, setRatingSuccess] = useState(false)

  const addRatingMutation = useAddRating()

  // Choose a deterministic gradient based on movieId
  const gradientClass = GRADIENTS[movie.movieId % GRADIENTS.length]

  // Get initial character for the fallback poster
  const initialChar = movie.title.trim().charAt(0).toUpperCase()

  // Fetch poster from TMDB API if key is available in localStorage
  useEffect(() => {
    const tmdbKey = localStorage.getItem('tmdb_api_key')
    if (!movie.tmdbId || !tmdbKey) {
      setPosterUrl(null)
      return
    }

    setLoadingPoster(true)
    fetch(`https://api.themoviedb.org/3/movie/${movie.tmdbId}?api_key=${tmdbKey}`)
      .then((res) => {
        if (!res.ok) throw new Error('Poster not found')
        return res.json()
      })
      .then((data) => {
        if (data.poster_path) {
          setPosterUrl(`https://image.tmdb.org/t/p/w300${data.poster_path}`)
        }
      })
      .catch(() => {
        setPosterUrl(null)
      })
      .finally(() => {
        setLoadingPoster(false)
      })
  }, [movie.tmdbId])

  const handleRate = (ratingValue: number) => {
    if (!activeUserId) {
      alert('Please enter or select a User ID in the header before rating.')
      return
    }

    addRatingMutation.mutate(
      { userId: activeUserId, movieId: movie.movieId, rating: ratingValue },
      {
        onSuccess: () => {
          setRatingSuccess(true)
          setTimeout(() => setRatingSuccess(false), 2000)
        },
      }
    )
  }

  return (
    <div className="group relative overflow-hidden rounded-2xl bg-slate-900 border border-slate-800 shadow-xl transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl hover:shadow-indigo-500/10 flex flex-col h-[380px]">

      {/* Poster / Gradient Area */}
      <div
        onClick={() => onMovieClick && onMovieClick(movie, posterUrl)}
        className="relative flex-1 cursor-pointer overflow-hidden bg-slate-950 flex items-center justify-center select-none"
      >
        {posterUrl ? (
          <img
            src={posterUrl}
            alt={movie.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${gradientClass} flex flex-col items-center justify-center p-6 border-b transition-transform duration-500 group-hover:scale-102`}>
            <div className="text-6xl font-black text-slate-100/20 mb-2 select-none group-hover:scale-110 transition-transform duration-300">{initialChar}</div>
            <div className="text-center font-bold text-slate-200 text-sm line-clamp-3 px-2">{movie.title}</div>
          </div>
        )}

        {/* Loading Overlay */}
        {loadingPoster && (
          <div className="absolute inset-0 bg-slate-950/50 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}

        {/* Hover overlay details */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
          <p className="text-xs font-semibold text-indigo-400 mb-1 select-none">Quick Actions</p>
          <p className="text-xs text-slate-300 select-none">Click poster to search similar/semantic</p>
        </div>
      </div>

      {/* Info & Interactive Rating Area */}
      <div className="p-4 bg-slate-900 border-t border-slate-800 flex flex-col justify-between min-h-[110px]">
        <div>
          <h3 className="font-bold text-slate-100 text-sm line-clamp-1 mb-1 group-hover:text-indigo-400 transition-colors" title={movie.title}>
            {movie.title}
          </h3>
          {movie.genres && (
            <p className="text-xs text-slate-400 line-clamp-1 mb-2">
              {movie.genres.replace(/\|/g, ' · ')}
            </p>
          )}
        </div>

        {/* Interactive Star rating */}
        <div className="flex items-center justify-between border-t border-slate-800/50 pt-2 select-none">
          <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(null)}
                onClick={() => handleRate(star)}
                disabled={addRatingMutation.isPending}
                className="focus:outline-none transition-transform hover:scale-125 cursor-pointer"
              >
                <svg
                  className={`w-5 h-5 transition-colors ${
                    hoverRating !== null
                      ? star <= hoverRating
                        ? 'text-indigo-400 fill-indigo-400'
                        : 'text-slate-700'
                      : userRating && star <= userRating
                      ? 'text-amber-400 fill-amber-400'
                      : 'text-slate-700'
                  }`}
                  fill={
                    hoverRating !== null
                      ? star <= hoverRating ? 'currentColor' : 'none'
                      : userRating && star <= userRating ? 'currentColor' : 'none'
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

          {/* Mutation Status */}
          <span className="text-[10px] font-semibold tracking-wider uppercase text-slate-500">
            {addRatingMutation.isPending ? (
              <span className="text-indigo-400 animate-pulse">Saving...</span>
            ) : ratingSuccess ? (
              <span className="text-emerald-400">Rated!</span>
            ) : (
              <span>Rate</span>
            )}
          </span>
        </div>
      </div>

    </div>
  )
}
