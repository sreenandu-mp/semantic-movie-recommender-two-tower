import numpy as np
import pandas as pd
import torch
import faiss
import importlib
from pathlib import Path

from ml.src.training.model import TwoTower
from ml.src.training import dataset as ml_dataset

# Placeholders for global variables
movies = None
index = None
index_to_movie = None
device = None
model = None
movie_embeddings = None
num_users = None
num_movies = None
user_to_index = None
movie_to_index = None

def load_models():
    global movies, index, index_to_movie, device, model, movie_embeddings
    global num_users, num_movies, user_to_index, movie_to_index
    
    root_dir = Path(__file__).parents[3]
    movies = pd.read_csv(root_dir / "ml/data/raw/ml-latest-small/movies.csv")
    
    # Reload dataset module
    importlib.reload(ml_dataset)
    num_users = ml_dataset.num_users
    num_movies = ml_dataset.num_movies
    user_to_index = ml_dataset.user_to_index
    movie_to_index = ml_dataset.movie_to_index
    
    # Reload FAISS index
    index_path = str(root_dir / "ml/data/embeddings/two_tower_movie_faiss.index")
    index = faiss.read_index(index_path)
    
    # Load index to movie mapping
    index_to_movie = np.load(root_dir / "ml/data/embeddings/index_to_movie.npy", allow_pickle=True).item()
    
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    
    # Load Two-Tower weights
    model = TwoTower(num_users=num_users, num_movies=num_movies, embedding_dim=64).to(device)
    model.load_state_dict(torch.load(root_dir / "ml/data/processed/two_tower_model.pth", map_location=device))
    model.eval()
    
    # Load movie embeddings
    movie_embeddings_path = root_dir / "ml/data/embeddings/two_tower_movie_embeddings.npy"
    if movie_embeddings_path.exists():
        movie_embeddings = np.load(movie_embeddings_path).astype("float32")
    else:
        movie_embeddings = None

# Initial load
load_models()

def recommend_movies_for_user(user_id, top_k=10):
    if user_id in user_to_index:
        user_idx = user_to_index[user_id]
        user_tensor = torch.tensor([user_idx], dtype=torch.long).to(device)
        user_vector = (model.user_embedding(user_tensor)).cpu().detach().numpy().astype("float32")
    else:
        # Cold start user: read ratings from CSV dynamically
        ratings_path = Path(__file__).parents[3] / "ml/data/raw/ml-latest-small/ratings.csv"
        liked_movie_ids = []
        
        if ratings_path.exists():
            try:
                ratings_df = pd.read_csv(ratings_path)
                user_ratings = ratings_df[ratings_df["userId"] == user_id]
                liked_ratings = user_ratings[user_ratings["rating"] >= 4.0]
                liked_movie_ids = liked_ratings["movieId"].tolist()
            except Exception as e:
                print(f"Error reading ratings CSV for cold start user {user_id}: {e}")
                
        # Get embeddings for liked movies
        movie_vectors = []
        if movie_embeddings is not None:
            for m_id in liked_movie_ids:
                if m_id in movie_to_index:
                    m_idx = movie_to_index[m_id]
                    movie_vectors.append(movie_embeddings[m_idx])
                    
        if not movie_vectors:
            # Fallback if no positive ratings, retrieve popular movies
            from ml.src.recommendation.popular import get_popular
            popular_movies = get_popular()
            return [{
                "movieId": item["movieId"],
                "title": item["title"],
                "genres": item["genres"]
            } for item in popular_movies[:top_k]]
            
        # Compute the average vector
        user_vector = np.mean(movie_vectors, axis=0, keepdims=True).astype("float32")

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