import requests
import os
import time
from typing import Optional


def fetch_public_domain_paintings(
    output_dir: str,
    num_images: int,
    sleep_sec: float = 0.2,
):
    """
    パブリックドメインの絵画を取得し、
    primaryImage をローカル保存、その他情報をコンソール出力する

    Args:
        output_dir (str): 画像保存先ディレクトリ
        num_images (int): 取得したい絵画の件数
        sleep_sec (float): API負荷軽減用の待機秒数
    """

    BASE_URL = "https://collectionapi.metmuseum.org/public/collection/v1"
    os.makedirs(output_dir, exist_ok=True)

    # ① 検索（パブリックドメイン + 絵画）
    search_params = {
        "q": "*",
        "classification": "Paintings",
        "isPublicDomain": "true",
    }

    res = requests.get(f"{BASE_URL}/search", params=search_params)
    res.raise_for_status()
    object_ids = res.json().get("objectIDs", [])

    if not object_ids:
        print("対象作品が見つかりませんでした")
        return

    print(f"候補作品数: {len(object_ids)}")

    saved_count = 0

    # ② 個別作品をチェック
    for object_id in object_ids:
        if saved_count >= num_images:
            break

        obj_res = requests.get(f"{BASE_URL}/objects/{object_id}")
        if obj_res.status_code != 200:
            continue

        obj = obj_res.json()

        # 🔒 絵画かつパブリックドメイン
        if obj.get("classification") != "Paintings":
            continue
        if obj.get("objectName") != "Painting":
            continue
        if not obj.get("isPublicDomain"):
            continue

        primary_image = obj.get("primaryImage")
        if not primary_image:
            continue

        # 作品情報
        title = obj.get("title", "Unknown Title")
        artist = "Unknown Artist"
        constituents = obj.get("constituents")
        if constituents and len(constituents) > 0:
            artist = constituents[0].get("name", artist)

        # コンソール出力
        print("-" * 40)
        print(f"Object ID : {object_id}")
        print(f"Title     : {title}")
        print(f"Artist    : {artist}")
        print(f"Image URL : {primary_image}")

        # 画像保存
        try:
            image_path = os.path.join(output_dir, f"{object_id}.jpg")
            _download_image(primary_image, image_path)
            saved_count += 1
        except Exception as e:
            print(f"画像保存失敗: {e}")

        time.sleep(sleep_sec)

    print("=" * 40) 
    print(f"取得完了: {saved_count} 件")


def _download_image(url: str, save_path: str):
    """画像をダウンロードして保存"""
    res = requests.get(url, stream=True, timeout=30)
    res.raise_for_status()

    with open(save_path, "wb") as f:
        for chunk in res.iter_content(chunk_size=8192):
            if chunk:
                f.write(chunk)


fetch_public_domain_paintings(
    output_dir="paintings",
    num_images=10
)