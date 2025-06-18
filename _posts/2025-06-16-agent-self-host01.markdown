---
layout: post
title: "LLM Agent 직접 만들어보기 01"
date: 2025-06-16 09:53:01 +0900
categories: [ 프로젝트, LLM-Agent ]
---

---


> 환경
> <br/> window
> <br/> 4070 super
> <br/> 32G 메모리

## ollama 설치

ollama 는 로컬에서 LLM 모델을 실행하기 위한 도구입니다. Docker 처럼 LLM 모델을 쉽게 설치 및 구동할 수 있게 해주는 플랫폼이라고 이해하시면 됩니다.

<br /> 주소 : https://ollama.com/download/windows

![Desktop View](/assets/img/2025-06-16/img01.png){: width="372" height="372" }

> 귀여움 ㅋㅋ

## 모델 선택

로컬에서 구동해야 하기 때문에 VRAM 사용량을 확인해야 합니다.

### 1. DeepSeek Coder V2 Lite 16B

| 항목 | 상세 |
|-----|------|
| **크기** | 16B 파라미터 |
| **VRAM 사용량** | 10-12GB (Q4_K_M 양자화) |
| **특화 분야** | 코드 생성, 디버깅, 코드 설명 |
| **언어 지원** | Python, JavaScript, Java, C++ 등 80+ 언어 |
| **한국어 지원** | ⭐⭐⭐⭐ (양호) |
| **코드 품질** | ⭐⭐⭐⭐⭐ (매우 우수) |
| **추론 속도** | ⭐⭐⭐⭐ (빠름) |
| **장점** | 실제 동작하는 코드 생성, 복잡한 로직 구현 가능, 최신 프레임워크 지원 |
| **단점** | 상대적으로 큰 모델 크기, 범용 대화는 다소 아쉬움 |

---

### 2. Qwen2.5 Coder 14B

| 항목 | 상세 |
|-----|------|
| **크기** | 14B 파라미터 |
| **VRAM 사용량** | 9-11GB (Q4_K_M 양자화) |
| **특화 분야** | 코드 생성, 수학적 추론 |
| **언어 지원** | 다양한 프로그래밍 언어 |
| **한국어 지원** | ⭐⭐⭐⭐⭐ (우수) |
| **코드 품질** | ⭐⭐⭐⭐ (우수) |
| **추론 속도** | ⭐⭐⭐⭐ (빠름) |
| **장점** | 한국어 이해도 뛰어남, 수학적 로직 구현 우수, 최신 모델 |
| **단점** | 복잡한 앱 구조 생성 시 일관성 부족, 상대적으로 새로운 모델 |

---

### 3. CodeLlama 13B Instruct

| 항목 | 상세 |
|-----|------|
| **크기** | 13B 파라미터 |
| **VRAM 사용량** | 8-10GB (Q4_K_M 양자화) |
| **특화 분야** | 코드 생성, 코드 완성 |
| **언어 지원** | Python, C++, Java, JavaScript 등 |
| **한국어 지원** | ⭐⭐⭐ (보통) |
| **코드 품질** | ⭐⭐⭐⭐ (우수) |
| **추론 속도** | ⭐⭐⭐⭐⭐ (매우 빠름) |
| **장점** | 검증된 안정성, 빠른 추론 속도, 코드 완성 기능 우수 |
| **단점** | 한국어 이해도 제한적, 최신 프레임워크 지식 부족 |

---

### 4. Llama 3.1 8B Instruct

| 항목 | 상세 |
|-----|------|
| **크기** | 8B 파라미터 |
| **VRAM 사용량** | 6-8GB (Q4_K_M 양자화) |
| **특화 분야** | 범용 대화, 일반적 코딩 |
| **언어 지원** | 주요 프로그래밍 언어 |
| **한국어 지원** | ⭐⭐⭐⭐ (양호) |
| **코드 품질** | ⭐⭐⭐ (보통) |
| **추론 속도** | ⭐⭐⭐⭐⭐ (매우 빠름) |
| **장점** | 낮은 메모리 사용량, 빠른 응답 속도, 범용성 좋음 |
| **단점** | 복잡한 코드 생성 능력 제한, 코드 전용 모델 대비 품질 떨어짐 |

---

### 5. Wizard Coder 15B

| 항목 | 상세 |
|-----|------|
| **크기** | 15B 파라미터 |
| **VRAM 사용량** | 10-12GB (Q4_K_M 양자화) |
| **특화 분야** | 코드 생성, 알고리즘 구현 |
| **언어 지원** | Python, JavaScript, C++ 등 |
| **한국어 지원** | ⭐⭐ (제한적) |
| **코드 품질** | ⭐⭐⭐⭐ (우수) |
| **추론 속도** | ⭐⭐⭐ (보통) |
| **장점** | 알고리즘 구현 능력 우수, 코드 최적화 제안 |
| **단점** | 한국어 지원 부족, 상대적으로 느린 추론 |

### 🥇 1순위: DeepSeek Coder V2 Lite 16B
**이유**: 코드 생성 품질, 한국어 지원, 최신성의 최적 조합

### 🥈 2순위: Qwen2.5 Coder 14B
**이유**: 한국어 이해도가 가장 뛰어나고, 메모리 사용량도 적당

### 🥉 3순위: Llama 3.1 8B
**이유**: 메모리 부족하거나 빠른 프로토타이핑이 필요한 경우

위와 같은 이유로 DeepSeek Coder v2 를 선택했습니다. ollama 를 통해서 모델을 다운로드 받고 구동시켰습니다.

```shell

PS C:\Windows\System32> ollama pull deepseek-coder-v2:16b-lite-instruct-q4_K_M

```

### 다운로드 받은 모델 테스트

```shell

PS C:\Users\user> ollama list
NAME                                          ID              SIZE     MODIFIED
deepseek-coder-v2:16b-lite-instruct-q4_K_M    dac6ff6589c9    10 GB    32 seconds ago
PS C:\Users\user> ollama run deepseek-coder-v2:16b-lite-instruct-q4_K_M
>>> 안녕하세요! 파이썬으로 간단한 Hello World 프로그램을 작성해주세요.
 안녕하세요! 반가워요. 파이썬으로 간단한 "Hello World" 프로그램을 작성해드리겠습니다. 아래는 파이썬 코드의 예제입니
다:

print("Hello, World!")

이 코드를 `hello_world.py` 파일로 저장하고, 터미널이나 명령 프롬프트에서 해당 파일을 실행시키면 "Hello, World!"라는
메시지가 콘솔에 출력됩니다.

만약 터미널이나 명령 프롬트에서 작업하고 있는데, `hello_world.py` 파일을 어디에 저장해야 하는지 모르겠다면, 보통 사
용자의 홈 디렉토리(`~`)나 스크립트를 저장할 수 있는 다른 위치에 파일을 저장하시면 됩니다.

예를 들어, 홈 디렉토리에 `Documents`나 `Desktop`과 같은 폴더를 만들고, 그곳에 파일을 저장할 수도 있습니다.

파이썬으로 무언가를 시작하는 것은 매우 쉽고, 강력한 도구입니다! 그동안 파이썬을 배워보세요.

>>> /bye

```

잘 구동하는 것을 확인할 수 있습니다.

### python 에서도 확인해보기

```python


import requests
import json
import time

# Ollama API 설정
OLLAMA_URL = "http://localhost:11434"
MODEL_NAME = "deepseek-coder-v2:16b-lite-instruct-q4_K_M"


def test_ollama_connection():
    """Ollama 서버 연결 테스트"""
    try:
        response = requests.get(f"{OLLAMA_URL}/api/tags")
        if response.status_code == 200:
            models = response.json()
            print("✅ Ollama 서버 연결 성공!")
            print("📋 사용 가능한 모델:")
            for model in models.get('models', []):
                print(f"  - {model['name']}")
            return True
        else:
            print(f"❌ Ollama 서버 응답 오류: {response.status_code}")
            return False
    except requests.exceptions.ConnectionError:
        print("❌ Ollama 서버에 연결할 수 없습니다. 'ollama serve' 명령으로 서버를 시작해주세요.")
        return False
    except Exception as e:
        print(f"❌ 연결 테스트 실패: {e}")
        return False


def test_model_generation():
    """모델 코드 생성 테스트"""
    print(f"\n🤖 모델 테스트 시작: {MODEL_NAME}")

    # 테스트 프롬프트
    prompt = """
파이썬으로 주식 가격을 조회하는 간단한 함수를 작성해주세요.
함수명은 get_stock_price이고, 종목 코드를 입력받아서 현재가를 반환해야 합니다.
yfinance 라이브러리를 사용해주세요.
"""

    payload = {
        "model": MODEL_NAME,
        "prompt": prompt,
        "stream": False
    }

    try:
        print("⏳ 코드 생성 중... (30초-2분 정도 소요될 수 있습니다)")
        start_time = time.time()

        response = requests.post(
            f"{OLLAMA_URL}/api/generate",
            json=payload,
            timeout=120  # 2분 타임아웃
        )

        end_time = time.time()

        if response.status_code == 200:
            result = response.json()
            generated_code = result.get('response', '')

            print(f"✅ 코드 생성 성공! (소요시간: {end_time - start_time:.1f}초)")
            print("\n" + "=" * 50)
            print("📝 생성된 코드:")
            print("=" * 50)
            print(generated_code)
            print("=" * 50)
            return True
        else:
            print(f"❌ 코드 생성 실패: {response.status_code}")
            print(f"응답: {response.text}")
            return False

    except requests.exceptions.Timeout:
        print("⏰ 요청 시간 초과 (2분). 모델이 너무 오래 걸리고 있습니다.")
        return False
    except Exception as e:
        print(f"❌ 코드 생성 오류: {e}")
        return False


def test_langchain_integration():
    """LangChain 연동 테스트"""
    try:
        from langchain_community.llms import Ollama

        print(f"\n🔗 LangChain 연동 테스트")

        # LangChain Ollama 객체 생성
        llm = Ollama(model=MODEL_NAME)

        # 간단한 테스트
        prompt = "파이썬 리스트를 딕셔너리로 변환하는 함수를 작성해주세요."

        print("⏳ LangChain으로 코드 생성 중...")
        start_time = time.time()

        response = llm.invoke(prompt)

        end_time = time.time()

        print(f"✅ LangChain 연동 성공! (소요시간: {end_time - start_time:.1f}초)")
        print("\n" + "=" * 30)
        print("📝 LangChain 응답:")
        print("=" * 30)
        print(response)
        print("=" * 30)
        return True

    except ImportError:
        print("❌ LangChain 라이브러리가 설치되지 않았습니다.")
        print("설치 명령: pip install langchain langchain-community")
        return False
    except Exception as e:
        print(f"❌ LangChain 연동 실패: {e}")
        return False


def main():
    """모든 테스트 실행"""
    print("🚀 Ollama 모델 테스트 시작")
    print(f"📍 대상 모델: {MODEL_NAME}")
    print(f"🌐 Ollama URL: {OLLAMA_URL}")
    print("-" * 60)

    # 1. 연결 테스트
    if not test_ollama_connection():
        print("\n❌ Ollama 서버 연결에 실패했습니다. 테스트를 중단합니다.")
        return

    # 2. 모델 생성 테스트
    if not test_model_generation():
        print("\n❌ 모델 코드 생성에 실패했습니다.")
        return

    # 3. LangChain 연동 테스트
    if not test_langchain_integration():
        print("\n❌ LangChain 연동에 실패했습니다.")
        return

    print("\n🎉 모든 테스트가 성공적으로 완료되었습니다!")
    print("✅ Ollama 서버 연결됨")
    print("✅ 모델 코드 생성 작동함")
    print("✅ LangChain 연동 성공")
    print("\n다음 단계: FastAPI 에이전트 구현을 진행할 수 있습니다!")


if __name__ == "__main__":
    main()

```

**결과**

```shell

==============================

🎉 모든 테스트가 성공적으로 완료되었습니다!
✅ Ollama 서버 연결됨
✅ 모델 코드 생성 작동함
✅ LangChain 연동 성공


```


## Fast API 세팅

코딩 agent 를 만들 예정이니, 요청을 받아줄 서버가 있어야 합니다. 간단하게 FastAPI 를 사용하기로 하고, 다음과 같이 프로젝트를 구성했습니다.
<br />
레포지토리의 경로는 다음과 같습니다. [경로](https://github.com/seonb2n/local-ollama-agent)
<br /> 각 파일별 코드는 위 repository 를 참고 부탁드립니다.

```
code-agent/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI 메인 앱
│   ├── models.py            # Pydantic 모델들
│   ├── config.py            # 설정 관리
│   ├── agents/
│   │   ├── __init__.py
│   │   └── code_agent.py    # LangChain 에이전트
│   ├── services/
│   │   ├── __init__.py
│   │   ├── ollama_service.py
│   │   └── file_service.py
│   └── api/
│       ├── __init__.py
│       └── routes.py        # API 엔드포인트
├── generated_code/          # 생성된 코드 저장소
├── requirements.txt
├── .env                     # 환경변수
├── .gitignore
└── README.md

```

이제, 준비된 fastapi 를 구동시키고 명령어를 입력하면 다음과 같이 응답이 내려옵니다.

```shell

{
  "success": true,
  "message": "코드가 성공적으로 생성되었습니다.",
  "code": " ```python\n# Import necessary libraries\nfrom fastapi import FastAPI, HTTPException\nfrom pydantic import BaseModel\nimport requests\nfrom bs4 import BeautifulSoup\n\n# Create a FastAPI app instance\napp = FastAPI()\n\n# Define the data model for stock news (in this case, we'll use a simple string)\nclass StockNews(BaseModel):\n    news: str\n\n# Endpoint to get stock news\n@app.get(\"/stock-news/{company_symbol}\", response_model=StockNews)\ndef get_stock_news(company_symbol: str):\n    try:\n        # Construct the URL for the company's financial news page (example format)\n        url = f\"https://finance.yahoo.com/quote/{company_symbol}/news\"\n        \n        # Send a GET request to fetch the webpage content\n        response = requests.get(url)\n        response.raise_for_status()  # Raise an HTTPError for bad responses (4xx and 5xx)\n        \n        # Parse the HTML content of the page using BeautifulSoup\n        soup = BeautifulSoup(response.content, 'html.parser')\n        \n        # Extract news headlines or snippets from the parsed HTML (example selector)\n        # This will vary depending on the website's structure\n        news_element = soup.select_one('.news-list .Mb\\(4px\\)')  # Example CSS selector\n        \n        if not news_element:\n            raise HTTPException(status_code=404, detail=\"News not found\")\n        \n        # Extract the text from the HTML element\n        news = news_element.get_text()\n        \n        # Return the extracted news as a response\n        return StockNews(news=news)\n    \n    except requests.RequestException as e:\n        raise HTTPException(status_code=500, detail=f\"Error fetching news: {e}\")\n\n# Entry point for running the FastAPI app directly\nif __name__ == \"__main__\":\n    import uvicorn\n    uvicorn.run(app, host=\"127.0.0.1\", port=8000)\n```",
  "filename": "python_app_20250616_231051.py",
  "file_path": "./generated_code\\python_app_20250616_231051.py",
  "dependencies": [
    "fastapi",
    "pydantic",
    "requests",
    "uvicorn",
    "bs4"
  ],
  "execution_time": 20.35269522666931
}

```


![Desktop View](/assets/img/2025-06-16/img02.png){: width="972" height="589" }

원하는대로 코드도 잘 생성이 됐습니다.

## 다음
<br /> 다음 스텝으로는 Context 를 적용해서 Agent 에게 작업 지시를 순차적으로 시키겠습니다.
