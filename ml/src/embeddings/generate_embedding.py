import numpy as np
import pandas as pd
from sentence_transformers import SentenceTransformer
from pathlib import Path

_ROOT = Path(__file__).parents[3]
_CSV = _ROOT / "ml/data/raw/ml-latest-small/movies.csv"
movies_df = pd.read_csv(_CSV)

movies_text = movies_df["title"].fillna("") + " " + movies_df["genres"].fillna("")
print("\nSample Text:\n")
print(movies_text.head())

model = SentenceTransformer("all-MiniLM-L6-v2")
embeddings = model.encode(movies_text.tolist(), show_progress_bar=True)
print("\nEmbeddings Shape:")
print(embeddings.shape)

np.save(_ROOT / "ml/data/processed/movie_embeddings.npy", embeddings)
np.save(_ROOT / "ml/data/processed/movie_ids.npy", movies_df["movieId"].values)
print("\nEmbeddings saved successfully.")