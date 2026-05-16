import os
import torch
import numpy as np
import faiss
from pathlib import Path

from ml.src.training.model import TwoTower
from ml.src.training.dataset import num_users, num_movies, movie_to_index
_ROOT = Path(__file__).parents[3]

os.makedirs(_ROOT / "ml/data/embeddings", exist_ok=True)

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

#load model
model = TwoTower(num_users=num_users, num_movies=num_movies, embedding_dim=64).to(device)
model.load_state_dict(torch.load(_ROOT / "ml/data/processed/two_tower_model.pth", map_location=device))

model.eval()

print("model loaded successfully.")

movie_embeddings = model.movie_embedding.weight.data.cpu().numpy().astype("float32")

faiss.normalize_L2(movie_embeddings)

np.save(_ROOT / "ml/data/embeddings/two_tower_movie_embeddings.npy", movie_embeddings)

#save movie index mapping
index_to_movie = {
    idx: movie_id
    for movie_id, idx in movie_to_index.items()
}
np.save(_ROOT / "ml/data/embeddings/index_to_movie.npy", index_to_movie)

print("\nMovie embeddings exported successfully.")
print(movie_embeddings.shape)