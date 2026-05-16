import faiss
import numpy as np
import pandas as pd

from pathlib import Path

_ROOT = Path(__file__).parents[3]
_CSV = _ROOT / "ml/data/raw/ml-latest-small/movies.csv"
movies_df = pd.read_csv(_CSV)

embeddings = np.load(_ROOT / "ml/data/processed/movie_embeddings.npy").astype("float32")

faiss.normalize_L2(embeddings)

#create faiss index
dimention = embeddings.shape[1]

index = faiss.IndexFlatIP(
    dimention
)

index.add(embeddings)
print(f"Total movies indexed: {index.ntotal}")

faiss.write_index(index, str(_ROOT / "ml/data/embeddings/movie_faiss.index"))
print("\nFAISS index saved successfully.")
