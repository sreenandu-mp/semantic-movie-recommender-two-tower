from fastapi import APIRouter
from app.services.movie_services import get_movies
from ml.src.recommentation.popular import get_popular

router = APIRouter()

@router.get("/movies")
def read_movies():
    return get_movies()[:50]

@router.get("/movies/popular")
def read_popular_movies():
    return get_popular()