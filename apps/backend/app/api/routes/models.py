import os
import sys
import time
import threading
import subprocess
from pathlib import Path
from fastapi import APIRouter, BackgroundTasks

from ml.src.recommendation import personalized_retrieval
from ml.src.ranking import inference

router = APIRouter()

# Global state to keep track of retraining status
training_status = {
    "status": "idle", # "idle", "running", "completed", "failed"
    "last_error": None,
    "current_step": None,
    "completed_at": None,
}
status_lock = threading.Lock()

def run_retraining_pipeline():
    global training_status
    
    workspace_root = Path(__file__).parents[5]
    
    steps = [
        ("Training Two-Tower model", "ml.src.training.train_two_tower"),
        ("Exporting embeddings", "ml.src.training.export_embeddings"),
        ("Building FAISS index", "ml.src.recommendation.faiss_index_two_tower"),
        ("Building ranking dataset", "ml.src.ranking.build_dataset"),
        ("Training Ranker model", "ml.src.ranking.train_ranker")
    ]
    
    try:
        for name, module_path in steps:
            with status_lock:
                training_status["current_step"] = name
            
            print(f"Retraining Pipeline: Starting {name}...")
            
            # Execute python module using the same python executable
            result = subprocess.run(
                [sys.executable, "-m", module_path],
                cwd=workspace_root,
                capture_output=True,
                text=True,
                env={**os.environ, "PYTHONPATH": str(workspace_root)}
            )
            
            if result.returncode != 0:
                error_msg = f"Step '{name}' failed with exit code {result.returncode}.\nStderr: {result.stderr}\nStdout: {result.stdout}"
                print(error_msg)
                with status_lock:
                    training_status["status"] = "failed"
                    training_status["last_error"] = error_msg
                    training_status["current_step"] = None
                return
            
            print(f"Retraining Pipeline: Completed {name}.")
        
        # Reload models in-memory upon successful completion
        print("Retraining Pipeline: Reloading models in-memory...")
        personalized_retrieval.load_models()
        inference.load_models()
        
        with status_lock:
            training_status["status"] = "completed"
            training_status["current_step"] = None
            training_status["completed_at"] = time.strftime("%Y-%m-%d %H:%M:%S")
        print("Retraining Pipeline successfully finished!")
        
    except Exception as e:
        error_msg = f"Retraining Pipeline failed: {str(e)}"
        print(error_msg)
        with status_lock:
            training_status["status"] = "failed"
            training_status["last_error"] = error_msg
            training_status["current_step"] = None

@router.post("/models/retrain")
def trigger_retrain(background_tasks: BackgroundTasks):
    global training_status
    with status_lock:
        if training_status["status"] == "running":
            return {"message": "Model training is already in progress.", "status": training_status}
        
        training_status["status"] = "running"
        training_status["last_error"] = None
        training_status["current_step"] = "Queued"
        training_status["completed_at"] = None

    background_tasks.add_task(run_retraining_pipeline)
    return {"message": "Model training triggered successfully.", "status": training_status}

@router.get("/models/retrain/status")
def get_retrain_status():
    global training_status
    with status_lock:
        return training_status
