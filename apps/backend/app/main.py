import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parents[3]))

from fastapi import FastAPI
from app.api.routes.movies import router as movies_router
from app.api.routes.models import router as models_router

app = FastAPI()

app.include_router(movies_router)
app.include_router(models_router)