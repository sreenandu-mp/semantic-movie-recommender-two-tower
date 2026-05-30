import { useMovies } from '../hooks/useMovies'

export default function MovieList() {
  const { data, isLoading, isError } = useMovies()

  if (isLoading) return <p>Loading...</p>
  if (isError) return <p>Failed to load movies.</p>

  return (
    <ul>
      {data?.map((movie) => (
        <li key={movie.movieId}>{movie.title}</li>
      ))}
    </ul>
  )
}
