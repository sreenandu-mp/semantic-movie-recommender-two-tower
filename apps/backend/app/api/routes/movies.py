from fastapi import APIRouter
from app.services.movie_services import get_movies
from ml.src.recommendation.popular import get_popular
from ml.src.recommendation.collabrative import recommend_similar_movies
from ml.src.recommendation.semantic_search import semantic_search
from ml.src.recommendation.personalized_retrieval import recommend_movies_for_user
from ml.src.ranking.inference import ranked_recommendations
import pandas as pd
from pathlib import Path

router = APIRouter()

# Load links.csv for metadata enrichment
links_path = Path(__file__).parents[5] / "ml/data/raw/ml-latest-small/links.csv"
links_df = pd.read_csv(links_path) if links_path.exists() else None

def enrich_movies(movie_list):
    if links_df is None or not movie_list:
        return movie_list
    df = pd.DataFrame(movie_list)
    if "movieId" in df.columns:
        df = df.merge(links_df, on="movieId", how="left")
        df["imdbId"] = df["imdbId"].fillna(0).astype(int)
        df["tmdbId"] = df["tmdbId"].fillna(0).astype(int)
        return df.to_dict(orient="records")
    return movie_list

@router.get("/movies")
def read_movies():
    return enrich_movies(get_movies()[:50])

@router.get("/movies/popular")
def read_popular_movies():
    return enrich_movies(get_popular())

@router.get("/movies/{movie_id}/similar")
def read_similar_movies(movie_id: int):
    return enrich_movies(recommend_similar_movies(movie_id))

@router.get("/movies/{movie_id}/semantic")
def read_semantic_recommendations(movie_id: int):
    return enrich_movies(semantic_search(movie_id))

@router.get("/movies/{user_id}/personalized")
def read_personalized_recommendations(user_id: int):
    return enrich_movies(recommend_movies_for_user(user_id))

@router.get("/movies/{user_id}/ranked")
def read_ranked_recommendations(user_id: int):
    return enrich_movies(ranked_recommendations(user_id))

@router.get("/movies/search")
def search_movies(query: str):
    movies_path = Path(__file__).parents[5] / "ml/data/raw/ml-latest-small/movies.csv"
    if not movies_path.exists():
        return []
    df = pd.read_csv(movies_path)
    results = df[df["title"].str.contains(query, case=False, na=False)]
    return enrich_movies(results.head(50).to_dict(orient="records"))


import time
from pathlib import Path
from pydantic import BaseModel, Field

class RatingPayload(BaseModel):
    userId: int
    movieId: int
    rating: float = Field(..., ge=0.5, le=5.0)

@router.post("/movies/ratings")
def add_movie_rating(payload: RatingPayload):
    ratings_path = Path(__file__).parents[5] / "ml/data/raw/ml-latest-small/ratings.csv"
    
    if not ratings_path.exists():
        with open(ratings_path, "w") as f:
            f.write("userId,movieId,rating,timestamp\n")
            
    df = pd.read_csv(ratings_path)
    df["userId"] = df["userId"].astype(int)
    df["movieId"] = df["movieId"].astype(int)
    df["rating"] = df["rating"].astype(float)
    df["timestamp"] = df["timestamp"].astype(int)

    mask = (df["userId"] == payload.userId) & (df["movieId"] == payload.movieId)
    if mask.any():
        df.loc[mask, "rating"] = payload.rating
        df.loc[mask, "timestamp"] = int(time.time())
    else:
        new_row = pd.DataFrame([{
            "userId": int(payload.userId),
            "movieId": int(payload.movieId),
            "rating": float(payload.rating),
            "timestamp": int(time.time())
        }])
        df = pd.concat([df, new_row], ignore_index=True)
        
    df.to_csv(ratings_path, index=False)
    return {"message": "Rating saved successfully", "rating": payload.dict()}

@router.get("/movies/ratings/{user_id}")
def get_user_ratings(user_id: int):
    ratings_path = Path(__file__).parents[5] / "ml/data/raw/ml-latest-small/ratings.csv"
    movies_path = Path(__file__).parents[5] / "ml/data/raw/ml-latest-small/movies.csv"
    
    if not ratings_path.exists():
        return []
        
    ratings_df = pd.read_csv(ratings_path)
    user_ratings = ratings_df[ratings_df["userId"] == user_id]
    
    if len(user_ratings) == 0:
        return []
        
    if movies_path.exists():
        movies_df = pd.read_csv(movies_path)
        merged = user_ratings.merge(movies_df, on="movieId", how="left")
        return enrich_movies(merged.to_dict(orient="records"))
        
    return user_ratings.to_dict(orient="records")

@router.delete("/movies/ratings/{user_id}/{movie_id}")
def delete_movie_rating(user_id: int, movie_id: int):
    ratings_path = Path(__file__).parents[5] / "ml/data/raw/ml-latest-small/ratings.csv"
    
    if not ratings_path.exists():
        return {"message": "Rating not found", "deleted": False}
        
    df = pd.read_csv(ratings_path)
    df["userId"] = df["userId"].astype(int)
    df["movieId"] = df["movieId"].astype(int)
    
    mask = (df["userId"] == user_id) & (df["movieId"] == movie_id)
    if mask.any():
        df = df[~mask]
        df.to_csv(ratings_path, index=False)
        return {"message": "Rating deleted successfully", "deleted": True}
        
    return {"message": "Rating not found", "deleted": False}

@router.get("/movies/ratings/{user_id}/similar")
def read_user_history_similar(user_id: int):
    ratings_path = Path(__file__).parents[5] / "ml/data/raw/ml-latest-small/ratings.csv"
    if not ratings_path.exists():
        return []
    df = pd.read_csv(ratings_path)
    user_ratings = df[(df["userId"] == user_id) & (df["rating"] >= 3.0)]
    if len(user_ratings) == 0:
        return []
    
    recent_ratings = user_ratings.sort_values(by="timestamp", ascending=False).head(5)
    movie_ids = recent_ratings["movieId"].tolist()
    
    from ml.src.recommendation.collabrative import movie_similarity_df, movies_df
    
    valid_movie_ids = [mid for mid in movie_ids if mid in movie_similarity_df.index]
    if not valid_movie_ids:
        return []
        
    mean_similarity = movie_similarity_df[valid_movie_ids].mean(axis=1)
    
    rated_all = df[df["userId"] == user_id]["movieId"].tolist()
    mean_similarity = mean_similarity.drop(index=rated_all, errors="ignore")
    
    similar_indices = mean_similarity.sort_values(ascending=False).head(50).index
    cols = [col for col in ["movieId", "title", "genres"] if col in movies_df.columns]
    recs = movies_df[movies_df["movieId"].isin(similar_indices)][cols]
    
    recs_dict = recs.set_index("movieId").loc[similar_indices].reset_index().to_dict(orient="records")
    return enrich_movies(recs_dict)

@router.get("/movies/ratings/{user_id}/semantic")
def read_user_history_semantic(user_id: int):
    ratings_path = Path(__file__).parents[5] / "ml/data/raw/ml-latest-small/ratings.csv"
    if not ratings_path.exists():
        return []
    df = pd.read_csv(ratings_path)
    user_ratings = df[(df["userId"] == user_id) & (df["rating"] >= 3.0)]
    if len(user_ratings) == 0:
        return []
    
    recent_ratings = user_ratings.sort_values(by="timestamp", ascending=False).head(5)
    movie_ids = recent_ratings["movieId"].tolist()
    
    import numpy as np
    from ml.src.recommendation.semantic_search import movies_df, embeddings, index
    
    indices_list = []
    for mid in movie_ids:
        idx_list = movies_df.index[movies_df["movieId"] == mid].tolist()
        if idx_list:
            indices_list.append(idx_list[0])
            
    if not indices_list:
        return []
        
    query_vector = np.mean(embeddings[indices_list], axis=0, keepdims=True)
    
    scores, indices = index.search(query_vector, 60)
    similar_indices = indices[0].tolist()
    
    rated_all = set(df[df["userId"] == user_id]["movieId"].tolist())
    
    recs_list = []
    for s_idx in similar_indices:
        row = movies_df.iloc[s_idx]
        mid = int(row["movieId"])
        if mid not in rated_all:
            recs_item = {"movieId": mid, "title": row["title"]}
            if "genres" in row:
                recs_item["genres"] = row["genres"]
            recs_list.append(recs_item)
            if len(recs_list) >= 50:
                break
                
    return enrich_movies(recs_list)