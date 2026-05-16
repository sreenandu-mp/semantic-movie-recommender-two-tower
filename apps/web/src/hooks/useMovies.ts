import { useQuery } from '@tanstack/react-query'
import { fetchMovies } from '../api/movies'

export const useMovies = () =>
  useQuery({ queryKey: ['movies'], queryFn: fetchMovies })
