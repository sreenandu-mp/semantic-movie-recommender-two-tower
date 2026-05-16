import axios from 'axios'

export interface Movie {
  id: number
  title: string
}

export const fetchMovies = () =>
  axios.get<Movie[]>('/api/movies').then((r) => r.data)
