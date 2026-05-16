import faiss
import numpy as np

embeddings = np.load("ml/data/embeddings/two_tower_movie_embeddings.npy").astype("float32")

dimention = embeddings.shape[1]

index = faiss.IndexFlatIP(
    dimention
)
index.add(embeddings)

print(f"Total movies indexed: {index.ntotal}")

faiss.write_index(index, "ml/data/embeddings/two_tower_movie_faiss.index")