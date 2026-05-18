import joblib
import pandas as pd
import numpy as np
import lightgbm as lgb

from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, roc_auc_score

from pathlib import Path

_ROOT = Path(__file__).parents[3]

dataset = pd.read_csv(_ROOT / "ml/data/processed/ranking_dataset.csv")

print("\nDataset Loaded:")
print(dataset.shape)

feature_columns = ["retrieval_score", "rating_count", "avg_rating", "user_activity", "genre_overlap"]
X = dataset[feature_columns]
Y = dataset["label"]

X_train, X_test, Y_train, Y_test = train_test_split(X, Y, test_size=0.2, random_state=42)

model = lgb.LGBMClassifier(
    objective="binary",
    n_estimators=200,
    learning_rate=0.05,
    num_leaves=31,
    random_state=42
)

print("\nTraining the model...")
model.fit(X_train, Y_train)
print("Model training completed.")

#predictions
Y_pred = model.predict(X_test)
y_prob = model.predict_proba(X_test)[:, 1]

#evaluation
accuracy = accuracy_score(Y_test, Y_pred)
auc_score = roc_auc_score(Y_test, y_prob)
print(f"\nModel Accuracy: {accuracy:.4f}")
print(f"Model AUC-ROC: {auc_score:.4f}")

#feature importance
importance_df = pd.DataFrame({
    "feature": feature_columns,
    "importance": model.feature_importances_
})
importance_df = importance_df.sort_values(by="importance", ascending=False)

print("\nFeature Importance:")
print(importance_df)

#save model
joblib.dump(model, _ROOT / "ml/data/processed/ranker_model.joblib")
print("\nModel saved to ml/data/processed/ranker_model.joblib")

