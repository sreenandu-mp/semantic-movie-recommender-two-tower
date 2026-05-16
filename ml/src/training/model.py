import torch
import torch.nn as nn

class TwoTower(nn.Module):
    def __init__(self, num_users, num_movies, embedding_dim=64):
        super(TwoTower, self).__init__()
        self.user_embedding = nn.Embedding(num_users, embedding_dim)
        self.movie_embedding = nn.Embedding(num_movies, embedding_dim)
        
    
    def forward(self, user_indices, movie_indices):
        user_vec = self.user_embedding(user_indices)
        movie_vec = self.movie_embedding(movie_indices)
        return user_vec, movie_vec