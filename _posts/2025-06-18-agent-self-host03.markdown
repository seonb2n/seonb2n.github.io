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

##  Self Improvements

AI 가 자신의 출력을 스스로 평가하고 개선하는 능력을 말합니다.

> 기본 프로세스:
> 1. 초기 답변 생성
> 2. 자기 평가 ("이 답변이 좋은가?")
> 3. 문제점 식별
> 4. 개선된 답변 재생성
> 5. 반복...

rok 을 써보면 이 과정을 투명하게 보여줘서, 어떤 흐름을 거쳐서 최종적인 답변이 완성되는지를 알 수 있습니다. 이 개선 과정에 있어서는 크게 3가지 방법론이 적용될 수 있습니다.

### Human-guided 방법론

RLHF (Reinforcement Learning from Human Feedback) 모델의 응답 결과를 사람이 직접 평가해서 응답을 개선하는 방법입니다. 인간이 선호하는 '좋은' 답변을 학습할 수 있지만, 평가자마자 주관적 차이가 있고 대량 학습이 어렵다는 단점이 있습니다.

### AI-guided 방법론

Self-Rewarding 과 같은 방법이 있고, AI 가 스스로 평가하고 개선할 수 있기 때문에 비용이 효율적입니다. 그러나 인간 가치에서 벗어날 위험이 있습니다. 보상 중심의 방법의 경우엔, 실제 목표를 달성하는 것이 아니라 해킹을 통한 보상 점수를 높이려 할 수 있습니다.
<br /> 이를 보완하고자 AI-as-a-Judge 와 같은 방법을 통해서 AI 가 다른 AI 의 답변을 평가하는 방법도 존재하지만, 평가 모델의 품질이 매우 중요하다는 단점이 있습니다.

### 하이브리드 방법론

Human-guided 와 AI-guided 를 모두 사용하는 방법입니다. 실제로 claude, gpt 는 모두 하이브리드 방법을 사용하고 있습니다.

## Self reflection

로컬 머신의 한계로, 간단히 self-reflection 을 통해서 self improvements 를 실행해보겠습니다.

> 전체 코드는 [여기](https://github.com/seonb2n/local-ollama-agent)를 참고해주세요.

```python


    async def perform_self_reflection(
            self,
            response: str,
            original_request: str,
            language: str,
            framework: Optional[str],
            session_id: Optional[str] = None
    ) -> ReflectionResult:
        """Self-reflection을 통한 응답 평가 (컨텍스트 고려)"""

        # 컨텍스트 정보 수집
        context_guidance = ""
        if session_id:
            context_info = context_manager.get_context_for_llm(session_id)
            if context_info:
                context_guidance = f"""
                            **프로젝트 컨텍스트:**
                            {context_info}
                            **컨텍스트 일관성 평가 포함:**
                            - 기존 코드 스타일과의 일치성
                            - 사용된 라이브러리의 일관성
                            - 아키텍처 패턴의 연속성
                            - 네이밍 컨벤션의 일치성
                            """

        reflection_prompt = f"""
                        다음 코드를 종합적으로 평가해주세요:
                        **원본 요청:** {original_request}
                        **언어:** {language}
                        **프레임워크:** {framework or "없음"}
                        {context_guidance}
                        **생성된 코드:**
                        ```{language}
                        {response}
                        ```
                        다음 기준으로 평가하고 JSON 형식으로 답변해주세요:
                        {{
                            "score": 점수 (0-10, 소수점 1자리),
                            "code_quality": {{
                                "score": 점수 (0-10),
                                "issues": ["문제점1", "문제점2"],
                                "good_points": ["장점1", "장점2"]
                            }},
                            "completeness": {{
                                "score": 점수 (0-10),
                                "missing_features": ["누락된 기능1", "누락된 기능2"],
                                "satisfied_requirements": ["만족된 요구사항1", "만족된 요구사항2"]
                            }},
                            "context_consistency": {{
                                "score": 점수 (0-10),
                                "inconsistencies": ["불일치 사항1", "불일치 사항2"],
                                "good_alignment": ["잘 맞는 부분1", "잘 맞는 부분2"]
                            }},
                            "best_practices": {{
                                "score": 점수 (0-10),
                                "violations": ["위반사항1", "위반사항2"],
                                "good_practices": ["좋은 관례1", "좋은 관례2"]
                            }},
                            "error_handling": {{
                                "score": 점수 (0-10),
                                "missing_error_handling": ["누락된 에러 처리1", "누락된 에러 처리2"],
                                "good_error_handling": ["좋은 에러 처리1", "좋은 에러 처리2"]
                            }},
                            "overall_issues": ["전체적인 문제점1", "전체적인 문제점2", "전체적인 문제점3"],
                            "improvement_suggestions": ["개선 제안1", "개선 제안2", "개선 제안3"],
                            "overall_assessment": "전체적인 평가 및 요약"
                        }}
                        평가 기준:
                        - 9-10: 뛰어남 (production-ready, 컨텍스트 완벽 일치)
                        - 7-8: 좋음 (minor improvements needed)
                        - 5-6: 보통 (moderate improvements needed)
                        - 3-4: 나쁨 (major improvements needed)
                        - 0-2: 매우 나쁨 (complete rewrite needed)
                        """

        try:
            reflection_response = self.llm.invoke(reflection_prompt)

            try:
                reflection_data = json.loads(reflection_response)
            except json.JSONDecodeError:
                reflection_data = self._extract_reflection_from_text(reflection_response)

            issues = reflection_data.get("overall_issues", [])
            suggestions = reflection_data.get("improvement_suggestions", [])

            return ReflectionResult(
                score=float(reflection_data.get("score", 5.0)),
                issues=issues,
                suggestions=suggestions,
                overall_assessment=reflection_data.get("overall_assessment", "평가를 완료했습니다.")
            )

        except Exception as e:
            logger.error(f"Self-reflection 실패: {e}")
            return ReflectionResult(
                score=5.0,
                issues=["평가 중 오류 발생"],
                suggestions=["재평가 필요"],
                overall_assessment="평가를 완료하지 못했습니다."
            )

```

간단히 코드의 품질을 평가해달라고 했습니다. 다만, judge 모델이 생성 모델과 동일하다보니, 대체로 평가가 후한(?)점은 어쩔 수 없는 것 같습니다.
<br/>
실행 결과는 다음과 같습니다.

```shell

🤖 코드 생성 요청 (세션: f837de6d...): 구글맵으로부터 서울의 인기 맛집들을 크롤링해오는 크롤러를 만들어줘...
2025-06-18 22:28:39,500 - app.services.ollama_service - INFO - 🔄 Self-improvement 반복 1/3
2025-06-18 22:28:43,677 - watchfiles.main - INFO - 1 change detected
2025-06-18 22:29:11,099 - app.services.ollama_service - INFO - ✅ 만족스러운 품질 달성 (점수: 7.5)
✅ 코드 생성 완료: python_app_20250618_222911.py (41.1초)

```
질문이 너무 쉬웠을까요? 이번엔 어려운 요청을 던져봤습니다.(본인도 뭔지 모름) 그리고 최소 통과 기준을 7.5 점에서 9점으로 올렸습니다. 이렇게 하면 열일할 수 밖에! 🔥🔥

```shell

🤖 코드 생성 요청 (세션: f0232e0d...): 시계열 데이터에서 실시간 이상값을 탐지하는 시스템을 만들어줘. 통계적 방법, 머신러닝, 딥...
2025-06-18 22:57:10,679 - watchfiles.main - INFO - 1 change detected
2025-06-18 22:57:25,875 - app.services.ollama_service - INFO - 🔄 Self-improvement 반복 1/3
2025-06-18 22:58:23,141 - app.services.ollama_service - INFO - ✅ 현재 품질 (점수: 8.5)
2025-06-18 22:58:39,245 - app.services.ollama_service - INFO - 📈 반복 1 완료 - 점수: 8.5
2025-06-18 22:58:39,245 - app.services.ollama_service - INFO - 🔄 Self-improvement 반복 2/3
2025-06-18 22:59:22,646 - app.services.ollama_service - INFO - ✅ 현재 품질 (점수: 8.5)
2025-06-18 22:59:42,829 - app.services.ollama_service - INFO - 📈 반복 2 완료 - 점수: 8.5
2025-06-18 22:59:42,829 - app.services.ollama_service - INFO - 🔄 Self-improvement 반복 3/3
2025-06-18 23:00:16,384 - app.services.ollama_service - INFO - ✅ 현재 품질 (점수: 8.5)

```

통과하지 못하고 결국 한계로 지정한 3번의 사이클을 모두 완수했습니다. 코드를 살펴보니 머신 러닝을 적용하는 부분을 결국 구현하지 못했습니다. 아무래도 모델의 크기가 작다보니 한계에 도달한 것 같네요.

## 다음

오늘은 self improvements 를 통해서 모델이 스스로의 응답을 한계까지 개선하도록 해봤습니다. 다음번엔 LoRA 를 적용해서 fine tuning 을 해보고 싶지만.. 파인튜닝을 하기엔 제 로컬 머신의 한계가 있습니다. 🥲
그러므로, RAG 를 적용해 외부 소스로부터 응답에 필요한 항목을 조회할 수 있도록 해보겠습니다.
