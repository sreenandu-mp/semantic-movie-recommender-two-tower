import random
import pandas as pd
import numpy as np
from pathlib import Path
import torch
import faiss

from ml.src.training.model import TwoTower

from ml.src.training.dataset import (
    num_users,
    num_movies,
    user_to_index,
    movie_to_index
)

from ml.src.ranking.features import ratings, movies, movie_features, user_activity, compute_genre_overlap


#LOAD MODEL
device = torch.device(
    "cuda" if torch.cuda.is_available()
    else "cpu"
)

model = TwoTower(
    num_users=num_users,
    num_movies=num_movies,
    embedding_dim=64
).to(device)

model.load_state_dict(
    torch.load(
        "ml/data/processed/two_tower_model.pth",
        map_location=device
    )
)

model.eval()
# RETRIEVAL SCORE
def compute_retrieval_score(
    user_id,
    movie_id
):

    if (
        user_id not in user_to_index
        or movie_id not in movie_to_index
    ):
        return 0

    user_idx = user_to_index[user_id]
    movie_idx = movie_to_index[movie_id]

    user_tensor = torch.tensor(
        [user_idx],
        dtype=torch.long
    ).to(device)

    movie_tensor = torch.tensor(
        [movie_idx],
        dtype=torch.long
    ).to(device)

    with torch.no_grad():

        user_vec = model.user_embedding(
            user_tensor
        )

        movie_vec = model.movie_embedding(
            movie_tensor
        )

        score = (
            user_vec * movie_vec
        ).sum().item()

    return score


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
dataset = dataset.merge(user_activity, on="userId", how="left")

# GENRE OVERLAP FEATURE
dataset["genre_overlap"] = dataset.apply(lambda row: compute_genre_overlap(row["userId"], row["genres"]), axis=1)

# RETRIEVAL SCORE
dataset["retrieval_score"] = dataset.apply(
    lambda row:
    compute_retrieval_score(
        row["userId"],
        row["movieId"]
    ),
    axis=1
)

#CLEAN DATA
dataset["rating_count"] = dataset["rating_count"].fillna(0)
dataset["avg_rating"] = dataset["avg_rating"].fillna(0)
dataset["user_activity"] = dataset["user_activity"].fillna(0)
dataset["genre_overlap"] = dataset["genre_overlap"].fillna(0)

feature_columns = ["retrieval_score", "rating_count", "avg_rating", "user_activity", "genre_overlap"]

X = dataset[feature_columns]
Y = dataset["label"]

dataset.to_csv(Path(__file__).parents[3] / "ml/data/processed/ranking_dataset.csv", index=False)

print("\nRanking dataset created.")
print(dataset.head())

print("\nDataset Shape:")
print(dataset.shape)