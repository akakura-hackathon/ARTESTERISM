import os
import random
import firebase_admin
from firebase_admin import credentials, firestore

# -------------------------
# Firebase 初期化（ADC）
# -------------------------
cred = credentials.ApplicationDefault()
firebase_admin.initialize_app(cred)
db = firestore.client()

# -------------------------
# image ディレクトリ
# -------------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
IMAGE_DIR = os.path.abspath(os.path.join(BASE_DIR, "..", "image"))

# -------------------------
# 画像一覧から絵画ID取得
# -------------------------
artwork_ids = []

for filename in os.listdir(IMAGE_DIR):
    artwork_id, _ = os.path.splitext(filename)

    if artwork_id.isdigit() and len(artwork_id) == 6:
        artwork_ids.append(artwork_id)

print(f"Total artworks found: {len(artwork_ids)}")

# -------------------------
# 年代の重み付き設定
# -------------------------
age_groups = [
    "10s", "20s", "30s", "40s", "50s",
    "60s", "70s", "80s", "90+"
]

weights = [
    5,   # 10s
    20,  # 20s
    20,  # 30s
    8,   # 40s
    7,   # 50s
    15,  # 60s
    15,  # 70s
    15,  # 80s
    5    # 90+
]

# -------------------------
# ユーザー生成
# -------------------------
for i in range(1, 101):
    user_id = f"user{i}"

    user_info = {
        "name": user_id,
        "gender": random.choice(["male", "female", "other"]),
        "age_group": random.choices(age_groups, weights=weights, k=1)[0],
    }

    # users/{user_id}
    user_ref = db.collection("users").document(user_id)
    user_ref.set({"user_info": user_info})

    # preferences サブコレクション
    pref_ref = user_ref.collection("preferences")

    batch = db.batch()
    batch_count = 0

    for artwork_id in artwork_ids:
        doc_ref = pref_ref.document(artwork_id)
        batch.set(doc_ref, {
            "score": random.randint(1, 100)
        })

        batch_count += 1

        # Firestore batch は最大 500
        if batch_count == 500:
            batch.commit()
            batch = db.batch()
            batch_count = 0

    # 残りを commit
    if batch_count > 0:
        batch.commit()

    print(f"{user_id} uploaded")

print("All users uploaded successfully 🎉")
