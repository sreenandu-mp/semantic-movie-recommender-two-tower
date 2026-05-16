import numpy as np
import pandas as pd
from pathlib import Path
import faiss

_ROOT = Path(__file__).parents[3]
_CSV = _ROOT / "ml/data/raw/ml-latest-small/movies.csv"
movies_df = pd.read_csv(_CSV)

embeddings = np.load(_ROOT / "ml/data/processed/movie_embeddings.npy").astype("float32")

faiss.normalize_L2(embeddings)

index = faiss.read_index(str(_ROOT / "ml/data/embeddings/movie_faiss.index"))

def semantic_search(movie_id:int, top_n: int=10):
    movie_indeces = movies_df.index[movies_df["movieId"] == movie_id].tolist()
    if not movie_indeces:
        return []
    query_vector = embeddings[movie_indeces[0]].reshape(1, -1)

    scores, indices = index.search(query_vector, top_n + 1)

    similar_indices = indices[0][1:].tolist()  # Exclude the first one which is the movie itself
    scores = scores[0][1:]  # Exclude the score of the movie itself

    recommendations = movies_df.iloc[similar_indices][["movieId", "title"]]
    print(f"Recommended Movies:\n{recommendations}")
    return recommendations.to_dict(orient="records")
if __name__ == "__main__":

    recommendations = semantic_search(
        movie_id=1
    )

    print("\nSemantic Recommendations:\n")
    print(recommendations)