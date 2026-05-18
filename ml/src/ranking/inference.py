import joblib
import faiss
import numpy as np
import pandas as pd
import torch
from pathlib import Path

from ml.src.training.model import TwoTower
from ml.src.training.dataset import (
    num_users,
    num_movies,
    user_to_index
)
from ml.src.ranking.features import (
    movie_features,
    user_activity,
    compute_genre_overlap
)

movies = pd.read_csv(Path(__file__).parents[3] / "ml/data/raw/ml-latest-small/movies.csv")

ranker_model = joblib.load(Path(__file__).parents[3] / "ml/data/processed/ranker_model.joblib")
print("Ranker model loaded successfully.")

index = faiss.read_index(str(Path(__file__).parents[3] / "ml/data/embeddings/two_tower_movie_faiss.index"))
print("FAISS index loaded successfully.")

index_to_movie = np.load(Path(__file__).parents[3] / "ml/data/embeddings/index_to_movie.npy", allow_pickle=True).item()

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")


model = TwoTower(num_users=num_users, num_movies=num_movies, embedding_dim=64).to(device)
model.load_state_dict(torch.load(Path(__file__).parents[3] / "ml/data/processed/two_tower_model.pth", map_location=device))
model.eval()
print("Two-Tower model loaded successfully.")

#Recommendation function
def ranked_recommendations(user_id:int, top_k_candidates=100, top_k=10):
    if user_id not in user_to_index:
        # raise ValueError(f"User ID {user_id} not found in training data.")
        return pd.DataFrame(columns = ["movieId", "title", "genres"]).to_dict(orient="records")
    
    # USER EMBEDDING
    user_idx = user_to_index[user_id]
    user_tensor = torch.tensor([user_idx], dtype=torch.long).to(device)
    user_vector = (model.user_embedding(user_tensor)).cpu().detach().numpy().astype("float32")

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
        activity_score = 0
    
    candidate_df["user_activity"] = (activity_score)

    # GENRE OVERLAP
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