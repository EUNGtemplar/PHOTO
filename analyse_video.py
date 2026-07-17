# .env의 GEMINI_API_KEY로 동영상을 Gemini 3.5 Flash에 업로드해 내용을 설명받는 스크립트
import os
import shutil
import sys
import tempfile
import time
from pathlib import Path

from dotenv import load_dotenv
from google import genai

# Windows 콘솔 코드페이지(cp949)로 한글 출력이 깨지는 것을 방지
sys.stdout.reconfigure(encoding="utf-8")

load_dotenv()

api_key = os.environ.get("GEMINI_API_KEY")
if not api_key or api_key == "your_key_here":
    sys.exit(".env 파일에 실제 GEMINI_API_KEY를 넣어주세요.")

if len(sys.argv) < 2:
    sys.exit("사용법: python analyse_video.py <동영상_경로> [질문]")

video_path = Path(sys.argv[1])
if not video_path.exists():
    sys.exit(f"파일을 찾을 수 없습니다: {video_path}")

# 무료 티어는 File API 업로드 용량이 2GB로 제한됩니다(유료 티어는 20GB).
prompt = sys.argv[2] if len(sys.argv) > 2 else "이 동영상에서 무슨 일이 일어나는지 한국어로 설명해줘."

client = genai.Client(api_key=api_key)

# 업로드 라이브러리(httpx)가 파일명을 ASCII로만 HTTP 헤더에 넣을 수 있어
# 한글 등 비ASCII 파일명은 그대로 두면 UnicodeEncodeError가 납니다.
upload_path = video_path
if not video_path.name.isascii():
    upload_path = Path(tempfile.gettempdir()) / ("upload_video" + video_path.suffix)
    shutil.copyfile(video_path, upload_path)

print(f"업로드 중: {video_path}")
video_file = client.files.upload(file=upload_path)

while video_file.state.name == "PROCESSING":
    print("처리 중...")
    time.sleep(5)
    video_file = client.files.get(name=video_file.name)

if video_file.state.name == "FAILED":
    sys.exit(f"업로드 실패: {video_file.state}")

# 무료 티어는 gemini-3.5-flash 기준 분당/일일 요청 수가 낮게 제한되어 있어
# 짧은 시간에 여러 번 실행하면 429(RESOURCE_EXHAUSTED) 오류가 날 수 있습니다.
response = client.models.generate_content(
    model="gemini-3.5-flash",
    contents=[video_file, prompt]
)

print(response.text)
