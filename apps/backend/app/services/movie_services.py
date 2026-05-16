import pandas as pd
from pathlib import Path

_CSV = Path(__file__).parents[4] / "ml/data/raw/ml-latest-small/movies.csv"
movies_df = pd.read_csv(_CSV)

def get_movies():
    return movies_df.to_dict(orient="records")