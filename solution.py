import argparse
import json
from pathlib import Path
from typing import List, Tuple

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.metrics import make_scorer
from sklearn.model_selection import cross_val_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder


def mean_absolute_percentage_error(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    """Return MAPE in percents."""
    y_true = np.asarray(y_true)
    y_pred = np.asarray(y_pred)
    eps = np.finfo(float).eps
    return np.mean(np.abs((y_true - y_pred) / np.maximum(np.abs(y_true), eps))) * 100.0


def build_preprocessor(df: pd.DataFrame) -> Tuple[Pipeline, List[str], List[str]]:
    cat_cols = [c for c in df.columns if df[c].dtype == "object"]
    num_cols = [c for c in df.columns if c not in cat_cols]

    categorical_transformer = OneHotEncoder(handle_unknown="ignore", sparse=False)

    preprocessor = ColumnTransformer(
        transformers=[
            ("categorical", categorical_transformer, cat_cols),
        ],
        remainder="passthrough",
        n_jobs=None,
    )

    return preprocessor, num_cols, cat_cols


def build_model(preprocessor: ColumnTransformer) -> Pipeline:
    model = HistGradientBoostingRegressor(
        max_depth=None,
        learning_rate=0.05,
        max_iter=700,
        l2_regularization=0.1,
        min_samples_leaf=20,
        random_state=17,
    )

    pipeline = Pipeline(
        steps=[
            ("preprocess", preprocessor),
            ("regressor", model),
        ]
    )
    return pipeline


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train price per square meter model")
    parser.add_argument("--train", type=Path, default=Path("train.csv"))
    parser.add_argument("--test", type=Path, default=Path("test.csv"))
    parser.add_argument("--output", type=Path, default=Path("submission.csv"))
    parser.add_argument(
        "--cv", action="store_true", help="Run cross-validation on training data"
    )
    parser.add_argument(
        "--metrics-output",
        type=Path,
        default=None,
        help="Optional path to write CV metrics as JSON",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    train_df = pd.read_csv(args.train)
    test_df = pd.read_csv(args.test)

    if "price_target" not in train_df.columns:
        raise ValueError("Training data must include 'price_target' column")

    y = train_df.pop("price_target").to_numpy()
    feature_df = train_df

    preprocessor, _, _ = build_preprocessor(feature_df)
    pipeline = build_model(preprocessor)

    if args.cv:
        scorer = make_scorer(mean_absolute_percentage_error, greater_is_better=False)
        cv_scores = cross_val_score(
            pipeline,
            feature_df,
            y,
            scoring=scorer,
            cv=5,
            n_jobs=None,
        )
        mean_mape = -np.mean(cv_scores)
        std_mape = np.std(cv_scores)
        print(f"CV MAPE: {mean_mape:.4f} ± {std_mape:.4f}")
        if args.metrics_output is not None:
            args.metrics_output.write_text(
                json.dumps({"mape_mean": mean_mape, "mape_std": std_mape})
            )

    pipeline.fit(feature_df, y)

    test_predictions = pipeline.predict(test_df)
    submission = pd.DataFrame({"target_price": test_predictions})
    submission.to_csv(args.output, index=False, float_format="%.6f")


if __name__ == "__main__":
    main()
