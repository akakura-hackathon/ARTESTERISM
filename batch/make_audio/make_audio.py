import json
from pathlib import Path

from google.cloud import translate_v3 as translate
from google.cloud import texttospeech

PROJECT_ID = "avid-invention-470411-u6"
INPUT_JSON = "c.json"  # BigQueryから保存したJSON

# 作りたい言語: 出力dir名 / 翻訳ターゲット / TTS language_code
TARGETS = {
    "zh": {"translate": "zh-CN", "tts": "cmn-CN"},  # 中国語(簡体) ※TTSは cmn-CN が一般的
    "es": {"translate": "es",    "tts": "es-ES"},   # スペイン語
    "fr": {"translate": "fr",    "tts": "fr-FR"},   # フランス語
    "ko": {"translate": "ko",    "tts": "ko-KR"},   # 韓国語
    "ru": {"translate": "ru",    "tts": "ru-RU"},   # ロシア語
}

OUT_DIRS = {k: Path(k) for k in TARGETS.keys()}
for d in OUT_DIRS.values():
    d.mkdir(exist_ok=True)


def translate_ja_to(text: str, target_language_code: str) -> str:
    client = translate.TranslationServiceClient()
    parent = f"projects/{PROJECT_ID}/locations/global"

    response = client.translate_text(
        request={
            "parent": parent,
            "contents": [text],
            "mime_type": "text/plain",
            "source_language_code": "ja",
            "target_language_code": target_language_code,
        }
    )
    return response.translations[0].translated_text


def text_to_mp3(text: str, language_code: str, outfile: Path):
    client = texttospeech.TextToSpeechClient()

    synthesis_input = texttospeech.SynthesisInput(text=text)

    voice = texttospeech.VoiceSelectionParams(
        language_code=language_code
        # 必要なら name="xx-XX-Standard-A" なども指定可
    )

    audio_config = texttospeech.AudioConfig(
        audio_encoding=texttospeech.AudioEncoding.MP3
    )

    response = client.synthesize_speech(
        input=synthesis_input,
        voice=voice,
        audio_config=audio_config,
    )

    with open(outfile, "wb") as f:
        f.write(response.audio_content)


def main():
    with open(INPUT_JSON, "r", encoding="utf-8") as f:
        data = json.load(f)

    for item in data:
        explanation_id = item["explanation_id"]
        jp_text = item["explanation_content"]

        print(f"processing {explanation_id}")

        for dir_name, cfg in TARGETS.items():
            translated = translate_ja_to(jp_text, cfg["translate"])
            out_file = OUT_DIRS[dir_name] / f"{explanation_id}.mp3"
            text_to_mp3(translated, cfg["tts"], out_file)

    print("done")


if __name__ == "__main__":
    main()

