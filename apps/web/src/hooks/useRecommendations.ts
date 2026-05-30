import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchMovies, fetchPopular, fetchSimilar, fetchSemantic, fetchPersonalized, fetchSearch, submitRating, retrainModel, fetchRetrainStatus, fetchUserRatings, deleteRating, fetchUserHistorySimilar, fetchUserHistorySemantic } from '../api/movies'

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

export const useSearchMovies = (query: string) =>
  useQuery({ queryKey: ['search', query], queryFn: () => fetchSearch(query), enabled: query.trim().length > 0 })

export const useAddRating = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, movieId, rating }: { userId: number; movieId: number; rating: number }) =>
      submitRating(userId, movieId, rating),
    onSuccess: (_, variables) => {
      // Invalidate personalized cache & user ratings history so both refresh immediately
      queryClient.invalidateQueries({ queryKey: ['personalized', variables.userId] })
      queryClient.invalidateQueries({ queryKey: ['user-ratings'] })
      queryClient.invalidateQueries({ queryKey: ['user-history-similar'] })
      queryClient.invalidateQueries({ queryKey: ['user-history-semantic'] })
    },
  })
}

export const useRetrainStatus = () =>
  useQuery({
    queryKey: ['retrain-status'],
    queryFn: fetchRetrainStatus,
    refetchInterval: (query) => {
      const data = query.state.data
      return data && data.status === 'running' ? 1500 : false
    },
  })

export const useTriggerRetrain = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: retrainModel,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['retrain-status'] })
    },
  })
}

export const useUserRatings = (userId: number | null) =>
  useQuery({ 
    queryKey: ['user-ratings', userId], 
    queryFn: () => fetchUserRatings(userId!), 
    enabled: !!userId 
  })

export const useDeleteRating = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, movieId }: { userId: number; movieId: number }) =>
      deleteRating(userId, movieId),
    onSuccess: (_, variables) => {
      // Invalidate personalized cache & user ratings history so both refresh immediately
      queryClient.invalidateQueries({ queryKey: ['personalized', variables.userId] })
      queryClient.invalidateQueries({ queryKey: ['user-ratings'] })
      queryClient.invalidateQueries({ queryKey: ['user-history-similar'] })
      queryClient.invalidateQueries({ queryKey: ['user-history-semantic'] })
    },
  })
}

export const useUserHistorySimilar = (userId: number | null) =>
  useQuery({
    queryKey: ['user-history-similar', userId],
    queryFn: () => fetchUserHistorySimilar(userId!),
    enabled: !!userId,
  })

export const useUserHistorySemantic = (userId: number | null) =>
  useQuery({
    queryKey: ['user-history-semantic', userId],
    queryFn: () => fetchUserHistorySemantic(userId!),
    enabled: !!userId,
  })

