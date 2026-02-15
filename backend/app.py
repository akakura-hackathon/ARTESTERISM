import os
import json
from typing import Any, Dict, List, Tuple

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from google.cloud import firestore, bigquery

PROJECT_ID = os.getenv("GOOGLE_CLOUD_PROJECT", "avid-invention-470411-u6")

app = FastAPI()

# CORS設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:3000",
        "https://avid-invention-470411-u6.web.app",
        "https://avid-invention-470411-u6.firebaseapp.com",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ===== BigQuery tables =====
BQ_ARTWORK_TABLE = "avid-invention-470411-u6.fukuoka.artwork_master"
BQ_EXPLANATION_TABLE = "avid-invention-470411-u6.murakami_work.explanation_master"

# 対象10作品
CANDIDATE_IDS: List[str] = [
    "435621",
    "435807",
    "435844",
    "436596",
    "436947",
    "437881",
    "437903",
]

# 推薦クエリ:
# - Firestore preferences を ratings_json で受け取る
# - ユーザープロファイルベクトル(user_emb)を作る
# - 「10作品のみ」を対象にコサイン類似度でスコア
# - 10作品を rank 付け
# - 上位3: level="3" / 中4: level="2" / 下位3: level="1"
# - explanation_master から artwork_id + level 一致の explanation_id を取得
SQL_RECOMMEND_1 = f"""
-- @ratings_json : STRING
-- @candidate_ids : ARRAY<STRING>

WITH ratings AS (
  SELECT
    CAST(JSON_VALUE(x, '$.artwork_id') AS STRING) AS artwork_id,
    CAST(JSON_VALUE(x, '$.score') AS INT64) AS score
  FROM UNNEST(JSON_QUERY_ARRAY(@ratings_json)) AS x
),

rated AS (
  SELECT
    a.artwork_id,
    a.caption_embedding.result AS emb,
    (r.score - 50) / 50.0 AS w
  FROM `{BQ_ARTWORK_TABLE}` a
  JOIN ratings r USING (artwork_id)
  WHERE a.caption_embedding.result IS NOT NULL
),

user_profile AS (
  SELECT
    ARRAY(
      SELECT
        SUM(w * emb[OFFSET(i)]) / NULLIF(SUM(ABS(w)), 0)
      FROM rated,
           UNNEST(GENERATE_ARRAY(0, ARRAY_LENGTH(emb) - 1)) AS i
      GROUP BY i
      ORDER BY i
    ) AS user_emb
),

-- ★ 10件を必ず作る母集団（候補IDを並べる）
candidates AS (
  SELECT artwork_id
  FROM UNNEST(@candidate_ids) AS artwork_id
),

-- 候補10件に作品情報を付与（存在しないIDがあっても10行は維持）
cand_art AS (
  SELECT
    cand.artwork_id,
    a.artwork_name,
    a.caption_embedding.result AS emb
  FROM candidates cand
  LEFT JOIN `{BQ_ARTWORK_TABLE}` a
    ON a.artwork_id = cand.artwork_id
),

scored AS (
  SELECT
    ca.artwork_id,
    ca.artwork_name,

    -- user_emb が作れない or 候補側embが無いなら similarity は NULL のまま
    IF(
      ARRAY_LENGTH(p.user_emb) > 0 AND ca.emb IS NOT NULL,
      (
        (
          SELECT SUM(c_vec * u_vec)
          FROM UNNEST(ca.emb) AS c_vec WITH OFFSET i
          JOIN UNNEST(p.user_emb) AS u_vec WITH OFFSET j
          ON i = j
        )
        /
        NULLIF(
          SQRT((SELECT SUM(c_vec * c_vec) FROM UNNEST(ca.emb) AS c_vec)) *
          SQRT((SELECT SUM(u_vec * u_vec) FROM UNNEST(p.user_emb) AS u_vec)),
          0
        )
      ),
      NULL
    ) AS similarity
  FROM cand_art ca
  CROSS JOIN user_profile p
),

ranked AS (
  SELECT
    ROW_NUMBER() OVER (
      ORDER BY
        similarity IS NULL,      -- NULLは最後に
        similarity DESC,
        artwork_id               -- 同点の安定化
    ) AS rank,
    artwork_id,
    artwork_name,
    similarity
  FROM scored
),

with_level AS (
  SELECT
    rank,
    artwork_id,
    artwork_name,
    similarity,
    CASE
      WHEN rank <= 3 THEN "3"
      WHEN rank >= 8 THEN "1"
      ELSE "2"
    END AS level
  FROM ranked
)

SELECT
  wl.artwork_id,
  wl.artwork_name,
  wl.rank,
  wl.similarity,
  wl.level,
  em.explanation_id
FROM with_level wl
LEFT JOIN `{BQ_EXPLANATION_TABLE}` em
  ON em.artwork_id = wl.artwork_id
 AND em.level = wl.level
ORDER BY (
  SELECT off
  FROM UNNEST(@candidate_ids) AS id WITH OFFSET off
  WHERE id = wl.artwork_id
);
"""


# 推薦クエリ（Firestoreのpreferencesを ratings_json として受け取り、ユーザベクトルを作って類似上位3件）
SQL_RECOMMEND_2 = f"""
-- @ratings_json : STRING
-- @rated_ids : ARRAY<STRING>

WITH ratings AS (
  SELECT
    CAST(JSON_VALUE(x, '$.artwork_id') AS STRING) AS artwork_id,
    CAST(JSON_VALUE(x, '$.score') AS INT64) AS score
  FROM UNNEST(JSON_QUERY_ARRAY(@ratings_json)) AS x
),

rated AS (
  SELECT
    a.artwork_id,
    a.caption_embedding.result AS emb,
    (r.score - 50) / 50.0 AS w
  FROM `{BQ_ARTWORK_TABLE}` a
  JOIN ratings r USING (artwork_id)
  WHERE a.caption_embedding.result IS NOT NULL
),

user_profile AS (
  SELECT
    ARRAY(
      SELECT
        SUM(w * emb[OFFSET(i)]) / NULLIF(SUM(ABS(w)), 0)
      FROM rated,
           UNNEST(GENERATE_ARRAY(0, ARRAY_LENGTH(emb) - 1)) AS i
      GROUP BY i
      ORDER BY i
    ) AS user_emb
),

scored AS (
  SELECT
    c.artwork_id,
    c.artwork_name,
    c.org_museum_name,
    (
      SELECT SUM(c_vec * u_vec)
      FROM UNNEST(c.caption_embedding.result) AS c_vec WITH OFFSET i
      JOIN UNNEST(p.user_emb) AS u_vec WITH OFFSET j
      ON i = j
    )
    /
    NULLIF(
      SQRT((SELECT SUM(c_vec * c_vec) FROM UNNEST(c.caption_embedding.result) AS c_vec)) *
      SQRT((SELECT SUM(u_vec * u_vec) FROM UNNEST(p.user_emb) AS u_vec)),
      0
    ) AS similarity
  FROM `{BQ_ARTWORK_TABLE}` c
  CROSS JOIN user_profile p
  WHERE ARRAY_LENGTH(p.user_emb) > 0
    AND c.caption_embedding.result IS NOT NULL
    AND c.artwork_id NOT IN UNNEST(@rated_ids)
    AND c.org_museum_id != "555555"   -- ← 追加
)

SELECT
  ROW_NUMBER() OVER (ORDER BY similarity DESC) AS rank,
  artwork_id,
  artwork_name,
  org_museum_name,
  similarity
FROM scored
ORDER BY rank
LIMIT 1;
"""




def load_user_ratings(user_id: str) -> Tuple[List[Dict[str, Any]], List[str]]:
    """
    Firestore:
      users/{user_id}/preferences/{artwork_id}
        score: number
    """
    db = firestore.Client(project=PROJECT_ID)
    prefs_ref = db.collection("users").document(user_id).collection("preferences")

    ratings: List[Dict[str, Any]] = []
    rated_ids: List[str] = []

    for snap in prefs_ref.stream():
        artwork_id = str(snap.id)  # docIDは文字列として扱う

        score_raw = (snap.to_dict() or {}).get("score", 0)
        try:
            score = int(score_raw)
        except (ValueError, TypeError):
            score = 0

        ratings.append({"artwork_id": artwork_id, "score": score})
        rated_ids.append(artwork_id)

    return ratings, rated_ids


@app.get("/recommend1")
def recommend1(user_id: str = Query(default="user1")) -> Dict[str, Any]:
    # 1) Firestoreから嗜好取得
    ratings, rated_ids = load_user_ratings(user_id)
    if not ratings:
        return {"user_id": user_id, "recommendations": [], "warning": "no preferences"}

    # 2) BigQueryで「10作品のみ」を対象にランキングし、level付け＋explanation_id取得
    bq = bigquery.Client(project=PROJECT_ID)
    ratings_json = json.dumps(ratings, ensure_ascii=False)

    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("ratings_json", "STRING", ratings_json),
            bigquery.ArrayQueryParameter("rated_ids", "STRING", rated_ids),
            bigquery.ArrayQueryParameter("candidate_ids", "STRING", CANDIDATE_IDS),
        ]
    )

    rows = bq.query(SQL_RECOMMEND_1, job_config=job_config).result()

    recs: List[Dict[str, Any]] = []
    for r in rows:
        recs.append(
            {
                "artwork_id": r["artwork_id"],
                "artwork_name": r["artwork_name"], 
                "similarity": float(r["similarity"]) if r["similarity"] is not None else None, 
                "level": r["level"], # "1" / "2" / "3"
                "explanation_id": r["explanation_id"],  # 見つからない場合は None
            }
        )

    return {
        "user_id": user_id,
        # "candidate_ids": CANDIDATE_IDS,
        "recommendations": recs,
    }


@app.get("/recommend2")
def recommend2(user_id: str = Query(default="user1")) -> Dict[str, Any]:
    # 1) Firestoreから嗜好取得
    ratings, rated_ids = load_user_ratings(user_id)
    if not ratings:
        return {"user_id": user_id, "recommendations": [], "warning": "no preferences"}

    # 2) BigQueryで類似上位3件
    bq = bigquery.Client(project=PROJECT_ID)
    ratings_json = json.dumps(ratings, ensure_ascii=False)

    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("ratings_json", "STRING", ratings_json),
            bigquery.ArrayQueryParameter("rated_ids", "STRING", rated_ids),
        ]
    )

    rows = bq.query(SQL_RECOMMEND_2, job_config=job_config).result()

    recs: List[Dict[str, Any]] = []
    for r in rows:
        recs.append(
            {
                "rank": int(r["rank"]),
                "artwork_id": r["artwork_id"],      # STRING
                "artwork_name": r["artwork_name"],  # STRING
                "museum_name": r["org_museum_name"],      # STRING
                "similarity": float(r["similarity"]) if r["similarity"] is not None else None,
            }
        )

    return {"user_id": user_id, "recommendations": recs}
