---
layout: post
title: "LLM Agent 직접 만들어보기 03"
date: 2025-06-18 23:07:01 +0900
categories: [ 프로젝트, LLM-Agent ]
---

---


> 환경
> <br/> window
> <br/> 4070 super
> <br/> 32G 메모리
> <br/> 전체 코드는 [여기](https://github.com/seonb2n/local-ollama-agent)를 참고해주세요.

##  웹 검색

LLM 은 학습 시점의 데이터에 따라서, 특정 문제를 해결하기 위해서 필요한 정보가 없을 수도 있습니다. 이 점을 보완하기 위해서, 웹 검색을 해서 필요한 정보를 context 에 넣을 수 있도록 하는 기능을 구현해보겠습니다.

```python

async def _should_perform_web_search(self, description: str, language: str, framework: Optional[str]) -> bool:
    """웹 검색이 필요한지 판단"""
    if not self.enable_web_search:
        return False

    # 웹 검색이 필요한 키워드들
    web_search_keywords = [
        "최신", "latest", "newest", "current", "2024", "2025",
        "업데이트", "update", "버전", "version",
        "새로운", "new", "트렌드", "trend",
        "API", "라이브러리", "library", "패키지", "package",
        "프레임워크", "framework", "도구", "tool",
        "설치", "install", "setup", "configuration",
        "에러", "error", "문제", "issue", "해결", "solution"
    ]

    description_lower = description.lower()

    # 키워드 기반 1차 판단
    keyword_score = sum(1 for keyword in web_search_keywords if keyword in description_lower)

    if keyword_score >= 2:
        return True

    # LLM을 이용한 정교한 판단
    judgment_prompt = f"""
    다음 코드 생성 요청에 대해 웹 검색이 필요한지 판단해주세요:

    요청: {description}
    언어: {language}
    프레임워크: {framework or "없음"}

    웹 검색이 필요한 경우:
    - 최신 기술, 라이브러리, API 정보가 필요한 경우
    - 특정 에러나 문제 해결법이 필요한 경우
    - 설치/설정 방법이 필요한 경우
    - 업데이트된 문법이나 방법론이 필요한 경우

    0.0 (불필요) ~ 1.0 (매우 필요) 사이의 점수만 출력하세요.
    """

    try:
        judgment_response = self.llm.invoke(judgment_prompt)
        score = float(judgment_response.strip())
        return score >= self.web_search_threshold
    except:
        return keyword_score >= 1

```

요청에 특정 커맨드가 들어 있는 경우에 웹 검색 필요 여부를 판단하도록 했습니다. 검색을 수행하고, 검색 결과를 context 에 넣어두면 될 것 같습니다.

자 이제 다음과 같은 커맨드를 입력해서 웹 검색을 해오게 만들어보겠습니다.

```shell

{
  "description": "최신 JDK 인 java 24 에서 새로 등장한 Late Barrier Expansion for G1 를 성능 테스트해보기 위한 테스트 코드를 작성해줘",
  "language": "java",
  "project_type": "web_app",
  "requirements": []
}

```

description 이 너무 장황해서 그런지, 검색 결과가 걸리는게 없습니다.

```shell


2025-06-22 19:07:25,106 - app.services.ollama_service - INFO - 검색된 아이템 수: 0
2025-06-22 19:07:25,106 - app.services.ollama_service - WARNING - 검색 결과가 비어있습니다.

```

딥식이한테 요청에서 키워드를 뽑아달라고 해봅시다.

```python

def get_optimized_query(self, description: str, language: str) -> List[str]:
    """LLM을 이용해 description에서 검색 키워드 추출"""
    try:
        description_optimized_query = f"""
다음 코드 생성 요청에서 웹 검색에 필요한 핵심 키워드만 추출해주세요.

요청: {description}
프로그래밍 언어: {language}

규칙:
1. 기술적 용어와 핵심 개념만 포함
2. 불필요한 조사나 부사 제거
3. 영어 기술 용어 우선 사용
4. 최대 5개의 키워드만 선택
5. 각 키워드는 1-3단어로 구성
6. 반드시 JSON 배열 형태로만 응답: ["키워드1", "키워드2", "키워드3"]

예시:
- 요청: "Spring Boot에서 JWT 토큰 인증을 구현하는 방법을 알려주세요"
- 응답: ["Spring Boot", "JWT", "authentication", "token", "security"]

응답 형식: ["키워드1", "키워드2", ...]
"""

        # LLM 호출
        response = self.llm.invoke(description_optimized_query)
        logger.info(f"LLM 키워드 추출 응답: {response}")

        # 응답에서 JSON 배열 추출
        keywords = self._parse_keywords_from_response(response)

        # 기본 키워드 추가 (언어명)
        if language and language not in keywords:
            keywords.insert(0, language)

        logger.info(f"추출된 키워드: {keywords}")
        return keywords[:5]  # 최대 5개로 제한

    except Exception as e:
        logger.error(f"키워드 추출 실패: {e}")
        # 실패시 기본 키워드 반환
        return self._get_fallback_keywords(description, language)

```

다시 요청을 해보면,

```shell


2025-06-22 19:15:10,544 - app.services.ollama_service - INFO - 추출된 키워드: ['java', 'JDK 24', 'Late Barrier Expansion', 'G1 Garbage Collector', 'Java Performance Testing', 'Test Code']
2025-06-22 19:15:10,544 - app.services.ollama_service - INFO - 최적화된 쿼리: 'java JDK 24 Late Barrier Expansion G1 Garbage Collector Java Performance Testing'

2025-06-22 19:15:11,123 - app.services.ollama_service - INFO - 검색된 아이템 수: 2
2025-06-22 19:15:11,123 - app.services.ollama_service - INFO - 결과 1: 제목='OpenJDKエコシステムと開発中の機能を紹介 2025夏版 - Speaker ......', 링크='https://speakerdeck.com/chiroito/java-future-2025-summer'
2025-06-22 19:15:11,123 - app.services.ollama_service - INFO - 결과 2: 제목='Apache Tez: Accelerating Hadoop Query Processing |...', 링크='https://www.slideshare.net/slideshow/apache-tez-accelerating-hadoop-query-processing/28293743'
2025-06-22 19:15:11,123 - app.services.ollama_service - INFO - 검색 완료 - 총 2개 결과 반환

```

결과를 잘 찾아와서 context 에 추가한 것을 볼 수 있습니다. 하지만 슬프게도 결과물을 확인한 결과 java 24 의 G1 GC 를 테스트하는 코드가 아니고, 일반적인 G1 GC 를 테스트한 것에 불과했습니다. 링크를 타고 확인해본결과, 두 문서 모두 24 의 G1 GC 와는 관련이 없는 문서였습니다. 이 점이 웹 검색의 맹점입니다.

## RAG

'외부 소스'로부터 데이터를 얻기 위해서 사용하는 방법으로 RAG 가 존재합니다. 검색 엔진은 위의 케이스처럼 결과 품질이 낮을 수 있습니다. 그러나 RAG 를 적용하면 미리 수집한 프로그래밍 문서를 벡터 DB 에 저장해두었기에 요청과 유사한 문서 조각을 정확히 검색할 수 있다는 장점이 있습니다.
<br/> RAG 를 적용하기 위해서는 큐레이션된 데이터가 필요합니다. 즉, 방대한 량의 데이터와 그를 정제할 수 있는 기술과 시간이 필요합니다. 주기적으로 데이터를 업데이트해야하는 배치 프로그램도 개발이 필요합니다. 이 모두를 제 로컬에서 단시간에 준비할 수는 없기 때문에 가상의 RAG 데이터베이스를 구축해서 사용해보겠습니다.

```python

          {
                "id": "java_24_late_barrier_expansion",
                "text": "Java 24의 Late Barrier Expansion for G1은 G1 가비지 컬렉터의 성능을 개선하는 기술입니다. 메모리 배리어 삽입을 런타임까지 지연시켜 컴파일 시점의 최적화 기회를 늘립니다. -XX:+UseLateBarrierExpansion 플래그로 활성화할 수 있으며, 고성능 애플리케이션에서 GC 오버헤드를 줄이는 데 효과적입니다.",
                "metadata": {"topic": "java", "level": "advanced", "version": "24"}
            },
            {
                "id": "java_gc_tuning",
                "text": "Java GC 튜닝을 위해서는 힙 사이즈 설정(-Xms, -Xmx), GC 알고리즘 선택(-XX:+UseG1GC, -XX:+UseZGC), GC 로깅(-Xlog:gc), 그리고 애플리케이션별 최적화가 필요합니다. G1GC에서는 -XX:MaxGCPauseMillis로 목표 일시정지 시간을 설정할 수 있습니다.",
                "metadata": {"topic": "java", "level": "advanced", "category": "performance"}
            },

```

이런 형태로 java24 의 Late Barrier Expansion for G1 에 대한 데이터를 넣어뒀습니다.

```shell

2025-06-22 20:17:16,407 - app.services.ollama_service - INFO - 추출된 키워드: ['java', 'JDK 24', 'G1 Garbage Collector', 'Late Barrier Expansion', 'performance testing', 'Java']
2025-06-22 20:17:16,407 - app.services.ollama_service - INFO - 🔍 RAG 시스템을 통한 지식 검색 중...

```

rag 를 활용해서 데이터를 검색하는 것을 볼 수 있습니다. 결과물도 확인해본 결과 이전에 비해서 java 24 를 활용하도록 구현되어 있는 것을 볼 수 있습니다.

## 다음

오늘은 웹검색과 RAG 를 활용해서 agent 가 더 양질의 결과물을 만들 수 있도록 구현했습니다. 다음 작업에는 github, docker, database 등의 외부 tool 과 연동 작업을 진행해보겠습니다.

