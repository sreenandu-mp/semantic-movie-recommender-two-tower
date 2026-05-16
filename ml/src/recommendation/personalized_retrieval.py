import numpy as np
import pandas as pd
import torch
import faiss
from pathlib import Path

from ml.src.training.model import TwoTower
from ml.src.training.dataset import (
    num_users,
    num_movies,
    user_to_index
)

movies = pd.read_csv(Path(__file__).parents[3] / "ml/data/raw/ml-latest-small/movies.csv")

index = faiss.read_index(str(Path(__file__).parents[3] / "ml/data/embeddings/two_tower_movie_faiss.index"))

index_to_movie = np.load(Path(__file__).parents[3] / "ml/data/embeddings/index_to_movie.npy", allow_pickle=True).item()

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

model = TwoTower(num_users=num_users, num_movies=num_movies, embedding_dim=64).to(device)
model.load_state_dict(torch.load(Path(__file__).parents[3] / "ml/data/processed/two_tower_model.pth", map_location=device))
model.eval()

def recommend_movies_for_user(user_id, top_k=10):
    if user_id not in user_to_index:
        raise ValueError(f"User ID {user_id} not found in training data.")
    
    user_idx = user_to_index[user_id]
    user_tensor = torch.tensor([user_idx], dtype=torch.long).to(device)

    user_vector = (model.user_embedding(user_tensor)).cpu().detach().numpy().astype("float32")

    faiss.normalize_L2(user_vector)

    scores, indices = index.search(user_vector, top_k)

    retrieved_indices = indices[0]

    movies_ids = [index_to_movie[idx] for idx in retrieved_indices]

    recommended_movies = movies[movies["movieId"].isin(movies_ids)][["movieId", "title", "genres"]]


    return recommended_movies.to_dict(orient="records")

if __name__ == "__main__":
    user_id = 1
    recommendations = recommend_movies_for_user(user_id)
    print(f"Recommendations for User ID {user_id}:")
    for rec in recommendations:
        print(f"{rec['title']} (Movie ID: {rec['movieId']}, Genres: {rec['genres']})")