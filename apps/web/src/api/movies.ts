import axios from 'axios'

export interface Movie {
  movieId: number
  title: string
  genres?: string
  imdbId?: number
  tmdbId?: number
}

export const fetchMovies = () =>
  axios.get<Movie[]>('/api/movies').then((r) => r.data)

export const fetchPopular = () =>
  axios.get<Movie[]>('/api/movies/popular').then((r) => r.data)

export const fetchSimilar = (movieId: number) =>
  axios.get<Movie[]>(`/api/movies/${movieId}/similar`).then((r) => r.data)

export const fetchSemantic = (movieId: number) =>
  axios.get<Movie[]>(`/api/movies/${movieId}/semantic`).then((r) => r.data)

export const fetchPersonalized = (userId: number) =>
  axios.get<Movie[]>(`/api/movies/${userId}/personalized`).then((r) => r.data)

export const fetchSearch = (query: string) =>
  axios.get<Movie[]>('/api/movies/search', { params: { query } }).then((r) => r.data)

export const submitRating = (userId: number, movieId: number, rating: number) =>
  axios.post('/api/movies/ratings', { userId, movieId, rating }).then((r) => r.data)

export interface RetrainStatus {
  status: 'idle' | 'running' | 'completed' | 'failed'
  last_error: string | null
  current_step: string | null
  completed_at: string | null
}

export const retrainModel = () =>
  axios.post<{ message: string; status: RetrainStatus }>('/api/models/retrain').then((r) => r.data)

export const fetchRetrainStatus = () =>
  axios.get<RetrainStatus>('/api/models/retrain/status').then((r) => r.data)

export interface UserRating extends Movie {
  rating: number
  timestamp: number
}

export const fetchUserRatings = (userId: number) =>
  axios.get<UserRating[]>(`/api/movies/ratings/${userId}`).then((r) => r.data)

export const deleteRating = (userId: number, movieId: number) =>
  axios.delete<{ message: string; deleted: boolean }>(`/api/movies/ratings/${userId}/${movieId}`).then((r) => r.data)

export const fetchUserHistorySimilar = (userId: number) =>
  axios.get<Movie[]>(`/api/movies/ratings/${userId}/similar`).then((r) => r.data)

export const fetchUserHistorySemantic = (userId: number) =>
  axios.get<Movie[]>(`/api/movies/ratings/${userId}/semantic`).then((r) => r.data)


