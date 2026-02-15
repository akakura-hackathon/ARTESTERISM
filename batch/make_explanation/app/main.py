from google.cloud import secretmanager
from google import genai
from google.genai import types
import base64
from prompts import level_3
from prompts import level_2
from prompts import level_1
from prompts import metadata_text_prompt
import csv
import os
from datetime import datetime
import requests
import time
from google.genai.errors import ServerError
import json
import re
import random
# akakura用
# PROJECT_ID = "408203742614"
# SECRET_ID = "GOOGLE_API_KEY"
# 個人用
PROJECT_ID = "227233346727"
SECRET_ID = "kojinyou"
SECRET_VERSION = "latest"
OUTPUT_DIR = "output"
OUTPUT_FILE = "results.csv"
OUTPUT_METADATA_TEXT_FILE = "metadata_results.csv"
LEVEL_PROMPTS = [
    (1, level_1),
    (2, level_2),
    (3, level_3),
]


def get_api_key() -> str:
    client = secretmanager.SecretManagerServiceClient()
    name = f"projects/{PROJECT_ID}/secrets/{SECRET_ID}/versions/latest"
    response = client.access_secret_version(name=name)
    return response.payload.data.decode("UTF-8")

def save_to_csv(level: str, explanation_content: str, output_file_name: str):
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    file_path = os.path.join(OUTPUT_DIR, output_file_name)

    is_new_file = not os.path.exists(file_path)

    with open(file_path, mode="a", newline="", encoding="utf-8-sig") as f:
        writer = csv.writer(f)

        # ヘッダー（初回のみ）
        if is_new_file:
            writer.writerow([
                "level",
                "explanation_content"
            ])

        writer.writerow([
            level,
            explanation_content
        ])


def clean_response_text(text: str) -> str:
    """
    response.text の先頭・末尾に ASCII ダブルクォート (") が
    存在する場合のみ削除する
    """
    if not text:
        return text

    # 先頭の " を削除
    if text.startswith('"'):
        text = text[1:]

    # 末尾の " を削除
    if text.endswith('"'):
        text = text[:-1]

    return text

def get_artwork_explanation(
    prompt: str,
    imgage_path: str,
    max_retry: int = 10,
    base_wait: float = 60.0,
    max_wait: float = 600.0,
) -> str:
    """
    Gemini API 呼び出しを指数バックオフ + ジッタ付きでリトライする
    （画像説明文生成用）
    """

    api_key = get_api_key()

    client = genai.Client(
        http_options={'api_version': 'v1alpha'},
        api_key=api_key
    )

    with open(imgage_path, "rb") as f:
        image_bytes = f.read()

    for attempt in range(max_retry):
        try:
            response = client.models.generate_content(
                model="gemini-3-flash-preview",
                contents=[
                    types.Content(
                        parts=[
                            types.Part(text=prompt),
                            types.Part(
                                inline_data=types.Blob(
                                    mime_type="image/jpeg",
                                    data=image_bytes,
                                )
                            )
                        ]
                    )
                ]
            )

            result = clean_response_text(response.text)
            print(result)
            return result

        except ServerError as e:
            # Gemini 側のレート制限・過負荷
            wait = min(base_wait * (2 ** attempt), max_wait)
            jitter = random.uniform(0, wait * 0.3)
            sleep_time = wait + jitter

            print(
                f"[Gemini ServerError] retry {attempt + 1}/{max_retry} "
                f"→ {sleep_time:.2f}s 待機"
            )
            time.sleep(sleep_time)

        except requests.exceptions.RequestException as e:
            # ネットワーク系エラー
            wait = min(base_wait * (2 ** attempt), max_wait)
            jitter = random.uniform(0, wait * 0.3)
            sleep_time = wait + jitter

            print(
                f"[Network Error] retry {attempt + 1}/{max_retry} "
                f"→ {sleep_time:.2f}s 待機"
            )
            time.sleep(sleep_time)

        except Exception as e:
            # 想定外だが一時的な可能性あり
            wait = min(base_wait * (2 ** attempt), max_wait)
            jitter = random.uniform(0, wait * 0.3)
            sleep_time = wait + jitter

            print(
                f"[Unexpected Error] {e} | retry {attempt + 1}/{max_retry} "
                f"→ {sleep_time:.2f}s 待機"
            )
            time.sleep(sleep_time)

    print("❌ get_artwork_explanation: 最大リトライ回数に達しました")
    return ""

def get_artwork_metadata_text(
    prompt: str,
    imgage_path: str,
    max_retry: int = 10,
    base_wait: float = 60.0,
    max_wait: float = 600.0,
) -> str:
    """
    Gemini API 呼び出しを指数バックオフ + ジッタ付きでリトライする
    """

    api_key = get_api_key()

    client = genai.Client(
        http_options={'api_version': 'v1alpha'},
        api_key=api_key
    )

    with open(imgage_path, "rb") as f:
        image_bytes = f.read()

    for attempt in range(max_retry):
        try:
            response = client.models.generate_content(
                model="gemini-3-flash-preview",
                contents=[
                    types.Content(
                        parts=[
                            types.Part(text=prompt),
                            types.Part(
                                inline_data=types.Blob(
                                    mime_type="image/jpeg",
                                    data=image_bytes,
                                )
                            )
                        ]
                    )
                ]
            )

            result = clean_response_text(response.text)
            print(result)
            return result

        except ServerError as e:
            # Gemini側の過負荷・レート制限
            wait = min(base_wait * (2 ** attempt), max_wait)
            jitter = random.uniform(0, wait * 0.3)
            sleep_time = wait + jitter

            print(
                f"[Gemini ServerError] retry {attempt + 1}/{max_retry} "
                f"→ {sleep_time:.2f}s 待機"
            )
            time.sleep(sleep_time)

        except requests.exceptions.RequestException as e:
            # ネットワーク系
            wait = min(base_wait * (2 ** attempt), max_wait)
            jitter = random.uniform(0, wait * 0.3)
            sleep_time = wait + jitter

            print(
                f"[Network Error] retry {attempt + 1}/{max_retry} "
                f"→ {sleep_time:.2f}s 待機"
            )
            time.sleep(sleep_time)

        except Exception as e:
            # 想定外だが一時的な可能性あり
            wait = min(base_wait * (2 ** attempt), max_wait)
            jitter = random.uniform(0, wait * 0.3)
            sleep_time = wait + jitter

            print(
                f"[Unexpected Error] {e} | retry {attempt + 1}/{max_retry} "
                f"→ {sleep_time:.2f}s 待機"
            )
            time.sleep(sleep_time)

    print("❌ get_artwork_metadata_text: 最大リトライ回数に達しました")
    return ""


def translate_to_ja(text: str) -> str:
    if not text:
        return ""

    api_key = get_api_key()
    client = genai.Client(api_key=api_key)

    prompt = f"""
        以下のテキストを自然な日本語に翻訳してください。
        固有名詞、特に絵画名は一般的に用いられている日本語表記を使ってください。
        日本語翻訳以外に余計なことをしないでください。

        {text}
        """

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt
    )

    return clean_response_text(response.text)

def select_image_url(obj: dict) -> str | None:
    """
    primaryImage → primaryImageSmall の順で画像URLを返す
    どちらも無ければ None
    """
    if obj.get("primaryImage"):
        return obj["primaryImage"]

    if obj.get("primaryImageSmall"):
        return obj["primaryImageSmall"]

    return None


def _download_image(url: str, save_path: str) -> bool:
    try:
        res = requests.get(url, stream=True, timeout=30)

        if res.status_code == 404:
            print(f"[IMAGE 404 skip] {url}")
            return False

        if res.status_code != 200:
            print(f"[IMAGE WARN] status={res.status_code} url={url}")
            return False

        with open(save_path, "wb") as f:
            for chunk in res.iter_content(8192):
                if chunk:
                    f.write(chunk)

        return True

    except requests.exceptions.RequestException as e:
        print(f"[IMAGE ERROR] {e} url={url}")
        return False

def fetch_and_save_met_paintings_to_csv(
    num_images: int,
    csv_path: str,
    image_dir: str = "image",
    sleep_sec: float = 0.2,
):
    BASE_URL = "https://collectionapi.metmuseum.org/public/collection/v1"

    os.makedirs(os.path.dirname(csv_path), exist_ok=True)
    os.makedirs(image_dir, exist_ok=True)

    is_new = not os.path.exists(csv_path)

    # 🔁 CSVから最後の objectID を取得
    last_object_id = get_last_object_id_from_csv(csv_path)

    with open(csv_path, "a", newline="", encoding="utf-8-sig") as csv_file:
        writer = csv.writer(csv_file)

        if is_new:
            writer.writerow([
                "artwork_id",
                "title_ja",
                "artist_ja",
                "image_description",
                "col5",
                "col6",
                "museum"
            ])

        # 🔍 検索条件
        search_params = {
            "q": "*",
            "classification": "Paintings",
            "isPublicDomain": "true",
        }

        res = requests.get(f"{BASE_URL}/search", params=search_params)
        res.raise_for_status()
        data = res.json()

        object_ids = data.get("objectIDs", [])
        total = data.get("total", 0)

        # ✅ 抽出対象件数を表示
        print(f"抽出対象（Paintings / Public Domain）の総数: {total}")

        if not object_ids:
            print("対象作品がありません")
            return

        # 🔁 再開位置を決定
        if last_object_id:
            try:
                start_index = object_ids.index(last_object_id) + 1
                print(f"CSV再開: objectID={last_object_id} の次（index={start_index}）から")
            except ValueError:
                start_index = 0
                print("CSVのobjectIDが検索結果に見つからないため先頭から開始")
        else:
            start_index = 0
            print("新規取得（先頭から開始）")

        object_ids = object_ids[start_index:]

        saved = 0

        for object_id in object_ids:
            if saved >= num_images:
                break

            obj_res = requests.get(f"{BASE_URL}/objects/{object_id}")
            
            if obj_res.status_code == 404:
                # ❌ 存在しない objectID（Met API ではよくある）
                print(f"[404 skip] objectID={object_id}")
                continue
            
            if obj_res.status_code != 200:
                continue

            obj = obj_res.json()

            # 🖼 絵画限定チェック
            if obj.get("classification") != "Paintings":
                continue
            if obj.get("objectName") != "Painting":
                continue
            if not obj.get("isPublicDomain"):
                continue

            # 🆔 artwork_id は最初に確定させる
            artwork_id = str(object_id)

            # 🖼 画像URL選択（primary → small）
            image_url = select_image_url(obj)
            if not image_url:
                print(f"[NO IMAGE] objectID={artwork_id}")
                continue

            image_path = os.path.join(image_dir, f"{artwork_id}.jpg")

            # 📥 画像保存
            success = _download_image(image_url, image_path)
            if not success:
                continue


            title_en = obj.get("title", "")
            artist_en = "Unknown Artist"
            if obj.get("constituents"):
                artist_en = obj["constituents"][0].get("name", artist_en)

            artwork_id = str(object_id)
            image_path = os.path.join(image_dir, f"{artwork_id}.jpg")

            # 📥 画像保存
            _download_image(image_url, image_path)

            # 🌐 翻訳
            title_ja, artist_ja = translate_title_and_artist(title_en, artist_en)
            time.sleep(0.5)

            # 🧠 画像説明
            description = get_artwork_metadata_text(
                metadata_text_prompt,
                image_path
            )

            writer.writerow([
                artwork_id,
                title_ja,
                artist_ja,
                description,
                "555555",
                "555555",
                "メトロポリタン美術館"
            ])

            print(f"保存完了: objectID={artwork_id}")

            saved += 1
            time.sleep(sleep_sec)


def translate_title_and_artist(
    title_en: str,
    artist_en: str,
    max_retry: int = 10
) -> tuple[str, str]:

    api_key = get_api_key()
    client = genai.Client(api_key=api_key)

    prompt = f"""
        以下を日本語に翻訳し、JSON形式のみで返してください。
        余計な文章は一切出力しないでください。

        title: {title_en}
        artist: {artist_en}

        {{"title_ja":"...","artist_ja":"..."}}
        """

    for i in range(max_retry):
        try:
            response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt
            )

            text = clean_response_text(response.text)

            # 🔑 JSON 部分だけ抜き出す
            match = re.search(r'\{.*\}', text, re.DOTALL)
            if not match:
                raise ValueError("JSON not found")

            data = json.loads(match.group())

            return (
                data.get("title_ja", ""),
                data.get("artist_ja", "")
            )

        except ServerError:
            wait = 2 ** i
            print(f"Gemini過負荷 → {wait}s 待機")
            time.sleep(wait)

        except Exception as e:
            print("翻訳パース失敗:", e)
            time.sleep(1)

    return "", ""

def get_last_object_id_from_csv(csv_path: str) -> int | None:
    """
    CSVの最後の行から artwork_id を取得
    なければ None を返す
    """
    if not os.path.exists(csv_path):
        return None

    with open(csv_path, newline="", encoding="utf-8-sig") as f:
        rows = list(csv.reader(f))

    if len(rows) <= 1:
        return None

    last_row = rows[-1]
    try:
        return int(last_row[0])  # artwork_id
    except Exception:
        return None

def get_next_explanation_id(csv_path: str, start_id: int = 300000) -> int:
    if not os.path.exists(csv_path):
        return start_id

    with open(csv_path, newline="", encoding="utf-8-sig") as f:
        rows = list(csv.reader(f))

    if len(rows) <= 1:
        return start_id

    last_row = rows[-1]
    try:
        return int(last_row[0]) + 1
    except Exception:
        return start_id

def run_explanations_for_image_id_range_multi_level(
    image_dir: str,
    start_image_id: int,
    end_image_id: int,
    output_csv: str,
):
    os.makedirs(os.path.dirname(output_csv), exist_ok=True)

    is_new = not os.path.exists(output_csv)
    next_explanation_id = get_next_explanation_id(output_csv)

    with open(output_csv, "a", newline="", encoding="utf-8-sig") as f:
        writer = csv.writer(f)

        # ヘッダー
        if is_new:
            writer.writerow([
                "explanation_id",
                "artwork_id",
                "artwork_name",
                "artist_name",
                "explanation_level",
                "language",
                "explanation_content",
            ])

        # image 配下の jpg を列挙
        for filename in sorted(os.listdir(image_dir)):
            if not filename.lower().endswith(".jpg"):
                continue

            artwork_id = filename.replace(".jpg", "")
            if not artwork_id.isdigit():
                continue

            artwork_id_int = int(artwork_id)

            # ID 範囲指定
            if not (start_image_id <= artwork_id_int <= end_image_id):
                continue

            image_path = os.path.join(image_dir, filename)

            print(f"\n=== Processing artwork_id={artwork_id} ===")

            # 🔁 level1 / level2 / level3 をまとめて処理
            for level, prompt in LEVEL_PROMPTS:
                print(f"[LEVEL {level}] generating...")

                explanation = get_artwork_explanation(
                    prompt=prompt,
                    imgage_path=image_path,
                )

                if not explanation:
                    print(f"[SKIP] level={level} explanation empty")
                    continue

                writer.writerow([
                    f"{next_explanation_id:06d}",  # explanation_id
                    f"{artwork_id_int:06d}",       # artwork_id
                    "",                            # artwork_name
                    "",                            # artist_name
                    level,                         # explanation_level
                    "jp",                          # language
                    explanation,                  # explanation_content
                ])

                print(
                    f"[SAVED] artwork_id={artwork_id} "
                    f"level={level} explanation_id={next_explanation_id}"
                )

                next_explanation_id += 1



def main():

    # image_path = "image/Vermeer_milkmeid.jpg"

    # save_to_csv("1", get_artwork_explanation(level_1, image_path), OUTPUT_FILE)
    # save_to_csv("2", get_artwork_explanation(level_2, image_path), OUTPUT_FILE)
    # save_to_csv("3", get_artwork_explanation(level_3, image_path), OUTPUT_FILE)

    # start_num = 222222

    # for i in range(15):
    #     artwork_id = str(start_num + i)

    #     image_path = "image/" + artwork_id + ".jpg"

    #     save_to_csv(artwork_id, get_artwork_metadata_text(metadata_text_prompt, image_path), OUTPUT_METADATA_TEXT_FILE)


    
    start = time.perf_counter() #計測開始
    
    # fetch_and_save_met_paintings_to_csv(
    #     num_images=25,
    #     csv_path="output/met_paintings.csv"
    # )
    run_explanations_for_image_id_range_multi_level(
        image_dir="image",
        start_image_id=436000,
        end_image_id=630000,
        output_csv="output/explanations.csv",
    )
    

    end = time.perf_counter() #計測終了
    
    # (秒→分に直し、小数点以下の桁数を指定して出力)
    print('{:.2f}'.format((end-start)/60))


if __name__ == "__main__":
    main()
