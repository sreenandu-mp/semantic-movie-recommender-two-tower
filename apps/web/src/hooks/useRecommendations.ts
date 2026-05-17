import { useQuery } from '@tanstack/react-query'
import { fetchMovies, fetchPopular, fetchSimilar, fetchSemantic, fetchPersonalized } from '../api/movies'

export const useMovies = () =>
  useQuery({ queryKey: ['movies'], queryFn: fetchMovies })

export const usePopular = () =>
  useQuery({ queryKey: ['popular'], queryFn: fetchPopular })

export const useSimilar = (movieId: number | null) =>
  useQuery({ queryKey: ['similar', movieId], queryFn: () => fetchSimilar(movieId!), enabled: movieId !== null })

export const useSemantic = (movieId: number | null) =>
  useQuery({ queryKey: ['semantic', movieId], queryFn: () => fetchSemantic(movieId!), enabled: movieId !== null })

export const usePersonalized = (userId: number | null) =>
  useQuery({ queryKey: ['personalized', userId], queryFn: () => fetchPersonalized(userId!), enabled: userId !== null })
