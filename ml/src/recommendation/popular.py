import pandas as pd
from pathlib import Path

_ROOT = Path(__file__).parents[3]
ratings_df = pd.read_csv(_ROOT / "ml/data/raw/ml-latest-small/ratings.csv")
movies_df = pd.read_csv(_ROOT / "ml/data/raw/ml-latest-small/movies.csv")

movie_stats = ratings_df.groupby("movieId").agg({"rating": ["mean", "count"]})
movie_stats.columns = ["mean_rating", "rating_count"]
popular = movie_stats.sort_values(by=["mean_rating", "rating_count"], ascending=False)
popular = popular.merge(movies_df,on="movieId")

def get_popular():
    return popular.head(10).to_dict(orient="records")