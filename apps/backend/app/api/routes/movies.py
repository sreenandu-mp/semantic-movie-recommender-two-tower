from fastapi import APIRouter
from app.services.movie_services import get_movies
from ml.src.recommendation.popular import get_popular
from ml.src.recommendation.collabrative import recommend_similar_movies
from ml.src.recommendation.semantic_search import semantic_search
from ml.src.recommendation.personalized_retrieval import recommend_movies_for_user
from ml.src.ranking.inference import ranked_recommendations


router = APIRouter()

@router.get("/movies")
def read_movies():
    return get_movies()[:50]

@router.get("/movies/popular")
def read_popular_movies():
    return get_popular()

@router.get("/movies/{movie_id}/similar")
def read_similar_movies(movie_id: int):
    return recommend_similar_movies(movie_id)

@router.get("/movies/{movie_id}/semantic")
def read_semantic_recommendations(movie_id: int):
    return semantic_search(movie_id)

@router.get("/movies/{user_id}/personalized")
def read_personalized_recommendations(user_id: int):
    return recommend_movies_for_user(user_id)

@router.get("/movies/{user_id}/ranked")
def read_ranked_recommendations(user_id: int):
    return ranked_recommendations(user_id)