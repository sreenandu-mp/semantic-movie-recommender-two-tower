import pandas as pd
import numpy as np
from pathlib import Path    

rating_csv = Path(__file__).parents[3] / "ml/data/raw/ml-latest-small/ratings.csv"
ratings = pd.read_csv(rating_csv)

movie_csv = Path(__file__).parents[3] / "ml/data/raw/ml-latest-small/movies.csv"
movies = pd.read_csv(movie_csv)

tags_csv = Path(__file__).parents[3] / "ml/data/raw/ml-latest-small/tags.csv"
tags = pd.read_csv(tags_csv)

movie_popularity = (
    ratings.groupby('movieId').size()
    .reset_index(name='rating_count')
)

movie_average_rating = (
    ratings.groupby('movieId')['rating'].mean()
    .reset_index(name='avg_rating')
)

user_activity = (
    ratings.groupby('userId').size()
    .reset_index(name='user_activity')
)

positive_ratings = ratings[ratings['rating'] >= 4.0]

user_genres = positive_ratings.merge(movies, on='movieId')
user_genres['genres'] = user_genres['genres'].fillna('')



#build user genre profile
user_genre_profile = {}
for user_id, group in user_genres.groupby('userId'):
    genres = []
    for genre_string in group['genres']:
        genres.extend(genre_string.split('|'))
    user_genre_profile[user_id] = set(genres)


def compute_genre_overlap(user_id, movie_genres):
    if user_id not in user_genre_profile:
        return 0.0
    
    user_prev_genres = user_genre_profile[user_id]
    movie_genre_set = set(movie_genres.split('|'))

    overlap = (len(user_prev_genres.intersection(movie_genre_set)))
    return overlap

#make table

movie_features = movies.merge(movie_popularity, on='movieId', how='left')
movie_features = movie_features.merge(movie_average_rating, on='movieId', how='left')
movie_features["rating_count"] = movie_features["rating_count"].fillna(0)
movie_features["avg_rating"] = movie_features["avg_rating"].fillna(0)
