import joblib
import faiss
import numpy as np
import pandas as pd
import torch
import importlib
from pathlib import Path

from ml.src.training.model import TwoTower
from ml.src.training import dataset as ml_dataset
from ml.src.ranking import features as ml_features

# Placeholders for global variables
movies = None
ranker_model = None
index = None
index_to_movie = None
device = None
model = None
movie_embeddings = None
num_users = None
num_movies = None
user_to_index = None
movie_to_index = None
movie_features = None
user_activity = None
compute_genre_overlap = None

def load_models():
    global movies, ranker_model, index, index_to_movie, device, model, movie_embeddings
    global num_users, num_movies, user_to_index, movie_to_index
    global movie_features, user_activity, compute_genre_overlap
    
    root_dir = Path(__file__).parents[3]
    movies = pd.read_csv(root_dir / "ml/data/raw/ml-latest-small/movies.csv")
    
    # Reload dataset module
    importlib.reload(ml_dataset)
    num_users = ml_dataset.num_users
    num_movies = ml_dataset.num_movies
    user_to_index = ml_dataset.user_to_index
    movie_to_index = ml_dataset.movie_to_index
    
    # Reload features module
    importlib.reload(ml_features)
    movie_features = ml_features.movie_features
    user_activity = ml_features.user_activity
    compute_genre_overlap = ml_features.compute_genre_overlap
    
    # Load ranker model
    ranker_model = joblib.load(root_dir / "ml/data/processed/ranker_model.joblib")
    print("inference: Ranker model loaded successfully.")
    
    # Load FAISS index
    index = faiss.read_index(str(root_dir / "ml/data/embeddings/two_tower_movie_faiss.index"))
    print("inference: FAISS index loaded successfully.")
    
    # Load index to movie mapping
    index_to_movie = np.load(root_dir / "ml/data/embeddings/index_to_movie.npy", allow_pickle=True).item()
    
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    
    # Load Two-Tower weights
    model = TwoTower(num_users=num_users, num_movies=num_movies, embedding_dim=64).to(device)
    model.load_state_dict(torch.load(root_dir / "ml/data/processed/two_tower_model.pth", map_location=device))
    model.eval()
    print("inference: Two-Tower model loaded successfully.")
    
    # Load movie embeddings
    movie_embeddings_path = root_dir / "ml/data/embeddings/two_tower_movie_embeddings.npy"
    if movie_embeddings_path.exists():
        movie_embeddings = np.load(movie_embeddings_path).astype("float32")
    else:
        movie_embeddings = None

# Initial load
load_models()

#Recommendation function
def ranked_recommendations(user_id:int, top_k_candidates=100, top_k=10):
    if user_id in user_to_index:
        # USER EMBEDDING
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

    #NORMALIZE
    faiss.normalize_L2(user_vector)

    # FAISS RETRIEVAL
    scores, indices = index.search(user_vector, top_k_candidates)
    retrieved_indices = indices[0]
    retrieved_scores = scores[0]
    candidate_movie_ids = [index_to_movie[idx] for idx in retrieved_indices]

    # BUILD FEATURE TABLE
    candidate_df = movies[movies["movieId"].isin(candidate_movie_ids)].copy()
    candidate_df = candidate_df.merge(
        movie_features[["movieId", "rating_count", "avg_rating"]],
        on="movieId",
        how="left"
    )

    # USER ACTIVITY
    user_activity_value = user_activity[user_activity["userId"] == user_id]["user_activity"]

    if len(user_activity_value) > 0:
        activity_score = user_activity_value.values[0]
    else:
        # Dynamically compute user activity count for cold-start user
        try:
            ratings_path = Path(__file__).parents[3] / "ml/data/raw/ml-latest-small/ratings.csv"
            if ratings_path.exists():
                ratings_df = pd.read_csv(ratings_path)
                activity_score = len(ratings_df[ratings_df["userId"] == user_id])
            else:
                activity_score = 0
        except Exception:
            activity_score = 0
    
    candidate_df["user_activity"] = (activity_score)

    # GENRE OVERLAP
    user_genre_profile = ml_features.user_genre_profile
    if user_id not in user_genre_profile:
        try:
            ratings_path = Path(__file__).parents[3] / "ml/data/raw/ml-latest-small/ratings.csv"
            if ratings_path.exists():
                ratings_df = pd.read_csv(ratings_path)
                user_ratings = ratings_df[(ratings_df["userId"] == user_id) & (ratings_df["rating"] >= 4.0)]
                if len(user_ratings) > 0:
                    liked_movie_ids_local = user_ratings["movieId"].tolist()
                    liked_genres = movies[movies["movieId"].isin(liked_movie_ids_local)]["genres"].fillna("").tolist()
                    genres = []
                    for genre_string in liked_genres:
                        genres.extend(genre_string.split('|'))
                    user_genre_profile[user_id] = set(genres)
        except Exception as e:
            print(f"Error dynamically building genre profile for user {user_id}: {e}")

    candidate_df["genre_overlap"] = candidate_df["genres"].apply(
        lambda genres: compute_genre_overlap(user_id, genres)
    )

    # RETRIEVAL SCORES
    retrieval_score_map = {
        movie_id: score
        for movie_id, score in zip(candidate_movie_ids, retrieved_scores)
    }
    candidate_df["retrieval_score"] = candidate_df["movieId"].map(retrieval_score_map)

    # FEATURE MATRIX
    feature_columns = ["retrieval_score", "rating_count", "avg_rating", "user_activity", "genre_overlap"]

    X = candidate_df[feature_columns].fillna(0)

    # RANKING SCORES
    candidate_df["ranking_score"] = ranker_model.predict_proba(X)[:, 1]

    # FINAL SORT
    candidate_df = candidate_df.sort_values(by="ranking_score", ascending=False)

    # RETURN RESULTS
    return candidate_df[["movieId", "title", "genres"]].head(top_k).to_dict(orient="records")


if __name__ == "__main__":
    user_id = 1
    recommendations = ranked_recommendations(user_id)
    print(f"Ranked Recommendations for User ID {user_id}:")
    for rec in recommendations:
        print(f"{rec['title']} (Movie ID: {rec['movieId']}, Genres: {rec['genres']})")