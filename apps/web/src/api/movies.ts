import axios from 'axios'

export interface Movie {
  movieId: number
  title: string
  genres?: string
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
