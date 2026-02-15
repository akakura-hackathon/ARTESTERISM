import csv
from pathlib import Path

input_path = Path("output/explanations.csv")
output_path = Path("output/explanations_no_newline.csv")

with input_path.open("r", encoding="utf-8", newline="") as f_in, \
    output_path.open("w", encoding="utf-8", newline="") as f_out:

    reader = csv.reader(f_in)
    writer = csv.writer(f_out)

    for row in reader:
        # 各セル内の改行を除去
        cleaned_row = [
            cell.replace("\r", "").replace("\n", " ")
            for cell in row
        ]
        writer.writerow(cleaned_row)

print("完了: 余計な改行を削除しました")
