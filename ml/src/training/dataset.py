import pandas as pd
import numpy as np
import torch
from torch.utils.data import Dataset
from pathlib import Path

_ROOT = Path(__file__).parents[3]

Rating_CSV = _ROOT / "ml/data/raw/ml-latest-small/ratings.csv"
rating = pd.read_csv(Rating_CSV)

#keep postive ratings only
rating = rating[rating["rating"] >= 4.0].copy()

#map user ids
unique_user_ids = rating["userId"].unique()
user_to_index = {user_id: idx for idx, user_id in enumerate(unique_user_ids)}

#map movie ids
unique_movie_ids = rating["movieId"].unique()
movie_to_index = {movie_id: idx for idx, movie_id in enumerate(unique_movie_ids)}

#create indices for users and movies
rating["user_index"] = rating["userId"].map(user_to_index)
rating["movie_index"] = rating["movieId"].map(movie_to_index)

#pytorch dataset

class RatingDataset(Dataset):
    def __init__(self, dataframe):
        self.users = torch.tensor(
            dataframe["user_index"].values, dtype=torch.long
        )
        self.movie = torch.tensor(
            dataframe["movie_index"].values, dtype=torch.long
        )
    
    def __len__(self):
        return len(self.users)
    
    def __getitem__(self, idx):
        # return {
        #     "user_index": self.user_indices[idx],
        #     "movie_index": self.movie_indices[idx],
        #     "label": self.labels[idx]
        # }
        return (self.users[idx], self.movie[idx])

dataset = RatingDataset(rating)

num_users = len(unique_user_ids)
num_movies = len(unique_movie_ids)


# just created:
# (user_idx, movie_idx)
# training pairs.
# Example:
# (0, 25)
# (0, 80)
# (1, 13)
# Meaning:
# user interacted positively with movie
# This becomes retrieval training data.