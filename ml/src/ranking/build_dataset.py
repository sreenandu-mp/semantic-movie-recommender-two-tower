import random
import pandas as pd
import numpy as np
from pathlib import Path

from ml.src.ranking.features import ratings, movies, movie_features, user_actitvity, compute_genre_overlap

#positive interaction
positive_df = ratings[ratings["rating"] >= 4.0].copy()
positive_df["label"] = 1

#negarive sampling
all_movie_ids = movies["movieId"].unique()
negative_rows = []
for user_id in positive_df["userId"].unique():
    watched_movies = set(positive_df[positive_df["userId"] == user_id]["movieId"])
    unwatched_movies = list(set(all_movie_ids) - watched_movies)
    sampled_negatives = random.sample(unwatched_movies, min(len(watched_movies), len(unwatched_movies)))

    for movie_id in sampled_negatives:
        negative_rows.append({
            "userId": user_id,
            "movieId": movie_id,
            "label": 0
        })
negative_df = pd.DataFrame(negative_rows)

dataset = pd.concat([positive_df[["userId", "movieId", "label"]], negative_df], ignore_index=True)

# ADD MOVIE FEATURES
dataset = dataset.merge(movie_features[["movieId", "rating_count", "avg_rating", "genres"]], on="movieId", how="left")

# ADD USER ACTIVITY
dataset = dataset.merge(user_actitvity, on="userId", how="left")

# GENRE OVERLAP FEATURE
dataset["genre_overlap"] = dataset.apply(lambda row: compute_genre_overlap(row["userId"], row["genres"]), axis=1)

#CLEAN DATA
dataset["rating_count"] = dataset["rating_count"].fillna(0)
dataset["avg_rating"] = dataset["avg_rating"].fillna(0)
dataset["user_activity"] = dataset["user_activity"].fillna(0)
dataset["genre_overlap"] = dataset["genre_overlap"].fillna(0)

feature_columns = ["rating_count", "avg_rating", "user_activity", "genre_overlap"]

X = dataset[feature_columns]
Y = dataset["label"]

dataset.to_csv(Path(__file__).parents[3] / "ml/data/processed/ranking_dataset.csv", index=False)

print("\nRanking dataset created.")
print(dataset.head())

print("\nDataset Shape:")
print(dataset.shape)