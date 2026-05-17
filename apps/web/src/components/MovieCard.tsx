import type { Movie } from '../api/movies'

export default function MovieCard({ movie }: { movie: Movie }) {
  return (
    <div className="bg-white rounded-xl shadow p-4 flex flex-col gap-1">
      <span className="font-semibold text-gray-800">{movie.title}</span>
      {movie.genres && (
        <span className="text-xs text-gray-400">{movie.genres.replace(/\|/g, ' · ')}</span>
      )}
    </div>
  )
}
