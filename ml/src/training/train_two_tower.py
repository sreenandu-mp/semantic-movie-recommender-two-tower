import torch
import torch.nn.functional as F
from torch.utils.data import DataLoader
from torch.optim import Adam

from ml.src.training.dataset import dataset, num_users, num_movies
from ml.src.training.model import TwoTower

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"Using device: {device}")

loader = DataLoader(dataset, batch_size=1024, shuffle=True)

model = TwoTower(num_users=num_users, num_movies=num_movies, embedding_dim=64).to(device)

optimizer = Adam(model.parameters(), lr=0.001)

epochs = 10

for epoch in range(epochs):
    total_loss = 0

    for user_indices, movie_indices in loader:
        user_indices = user_indices.to(device)
        movie_indices = movie_indices.to(device)

        optimizer.zero_grad()

        user_vec, movie_vec = model(user_indices, movie_indices)

        #dot product similarity
        scores = (user_vec * movie_vec).sum(dim=1)

        targets = torch.ones_like(scores)

        loss = F.mse_loss(scores, targets)

        loss.backward()
        optimizer.step()

        total_loss += loss.item()

        print(f"Epoch {epoch + 1}/{epochs}, Loss: {total_loss / len(loader)}")

from pathlib import Path
torch.save(
    model.state_dict(),
    Path(__file__).parents[3] / "ml/data/processed/two_tower_model.pth"
)

print("\nModel saved successfully.")