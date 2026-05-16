import pandas as pd
from pathlib import Path
from sklearn.metrics.pairwise import cosine_similarity

_ROOT = Path(__file__).parents[3]
ratings_df = pd.read_csv(_ROOT / "ml/data/raw/ml-latest-small/ratings.csv")
movies_df = pd.read_csv(_ROOT / "ml/data/raw/ml-latest-small/movies.csv")

user_movie_matrix = ratings_df.pivot_table(
    index = "userId",
    columns = "movieId",
    values = "rating"
)

user_movie_matrix = user_movie_matrix.fillna(0)

movie_similarity = cosine_similarity(user_movie_matrix.T)

movie_ids = user_movie_matrix.columns

movie_similarity_df = pd.DataFrame(
    movie_similarity,
    index = movie_ids,
    columns = movie_ids
)

def recommend_similar_movies(movie_id, top_n=10):
    if movie_id not in movie_similarity_df.index:
        # return pd.DataFrame(columns=["movieId", "title"])
        return []
    
    similarity_scores = movie_similarity_df[movie_id]
    similar_movies = similarity_scores.sort_values(ascending=False)[1:top_n + 1]
    
    recommentations = movies_df[movies_df["movieId"].isin(similar_movies.index)][["movieId", "title"]]
    
    return recommentations.to_dict(orient="records")
  