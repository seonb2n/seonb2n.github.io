---
layout: post
title: "Rest 원칙이 등장한 Roy Fielding 의 논문 리딩 후기"
date: 2024-11-02 15:01:01 +0900
categories: [ 논문, Rest ]
---

---


# Roy Fielding 의 Architecture Styles and the Design of Network-based Software Architectures 후기


## 왜 읽었나요

<br><span> 웹개발자로 개발을 하다보면 내가 만드는 api 가 명쾌한 규약을 가지고 있는지 의문을 갖고는 합니다. 명쾌한 규약이란 해당 api 를 사용하는 사용자에게 설명이 필요 없이
api 의 요건만으로도 그것이 어떤 api 인지 나타낼 수 있어야 한다고 생각합니다.
<br><span> 그런 맥락에서, 적용해볼 수 있는 좋은 규약이 rest 아키텍쳐이고, rest 아키텍쳐 스타일을 이해해보고자 Roy Fielding 의 논문을 2주간 읽었습니다. Roy Fielding 은 REST 원칙 뿐 아니라,
HTTP 1.0 / 1.1 의 주요 설계자이기도 합니다. 따라서 이 분의 논문을 읽음으로서 웹 표준의 좋은 아키텍쳐 스타일이 무엇인지에 대해 전반적인 이해를 높일 수 있을 것이라고 기대했습니다.

## 주요 내용

<br><span> 각 챕터별 핵심 내용은 다음과 같습니다.

### Chapter 1: Software Architecture

- 소프트웨어 아키텍처의 중요성 강조
- 아키텍처 스타일은 재사용 가능한 아키텍처 설계의 추상화
- 웹의 성공 요인을 아키텍처 관점에서 분석할 필요성 제시

### Chapter 2: Network-based Application Architectures

- 네트워크 기반 아키텍처의 특징과 제약사항 설명
- 성능, 신뢰성, 확장성 등 아키텍처 품질 속성 정의
- 네트워크 기반 시스템의 주요 도전

### Chapter 3: Network-based Architectural Styles

- 기존 아키텍처 스타일 분석:
```
- 데이터 흐름 스타일 (파이프-필터)
- 복제 스타일 (캐시)
- 계층화 스타일
- 모바일 코드 스타일
```
- 각 스타일의 장단점과 적용 사례 분석

### Chapter 4: Designing the Web Architecture: Problems and Insights

- 웹의 요구사항 분석:
```
- 낮은 진입 장벽
- 분산 시스템 지원
- 독립적인 컴포넌트 배포
- 레거시 시스템과의 통합
```
- 기존 웹 아키텍처의 문제점 식별

### Chapter 5: Representational State Transfer (REST)

- REST 아키텍처 스타일의 핵심 정의
- 주요 제약조건 설명:
```
- Client-Server
- Stateless
- Cache
- Uniform Interface
- Layered System
- Code-on-Demand (선택사항)
```
- 리소스, 표현, 식별자 개념 설명
- Uniform Interface의 세부 제약조건:
```
- Resource Identification : 모든 자원은 고유한 식별자(URI)를 통해서 식별되어야 함
- Resource Manipulation through Representations : 클라이언트는 자원의 표현(represeantation) 을 통해서 자원을 조작
- Self-descriptive Messages : 메시지에는 자신을 어떻게 처리해야하는지에 대한 정보가 담겨야 함
- HATEOAS (Hypermedia as the Engine of Application State) : 클라이언트는 서버가 제공하는 링크를 통해서 다음 상태로 전이
```

### Chapter 6: Experience and Evaluation

- REST 적용 사례 분석
- HTTP/1.0, HTTP/1.1에서의 REST 원칙 구현
- REST 아키텍처 스타일의 장점:
```
- 확장성
- 인터페이스 일관성
- 컴포넌트 독립성
- 중간 매개체 지원
- 보안 강화
```

## 느낀 점?

<br><span> 논문을 읽기 전에 restFul 원칙에 대해서 공부한 적은 있지만 이렇게 논문을 모두 읽고 나니 로이 필딩이라는 사람이 매우 실전적인 사람이라는 느낌을 받았습니다.
<br><span> 이 논문에서 강조하는 여러 부분 중 하나는, 웹은 사용자에게 느껴지는 latency 를 최소화하고 scalability 를 용이하게 할 수 있는 아키텍쳐를 적용해야 한다는 것이었습니다.
즉, 로이 필딩이 말하고자 하는 바는 막연히 추상화된 좋은 원칙이 아니라, 여러 현실적인 제약 사항을 층층히 쌓아서 만드는 정교한 기계로서의 웹을 말하고자 한다고 느꼈습니다.
단순한 api 의 규약에 적용되는 원칙이 아니라 좋은 웹 아키텍쳐를 만들기 위한 전반적인 설계 원칙을 공유하기 위한 논문이었습니다.

## 아쉬운 점?
<br><span> 영어를 원어로 하지 않다보니 내용상 다소 의역으로 넘긴 부분도 있는 것 같습니다. 또한, 혼자 읽다보니 이해한 내용에 대해서 다른 독자와 토론을 해보면서 더 이해도를 높이면 좋았을텐데 라는 아쉬움이 있습니다.
다음에 다시 한번 사람들을 모아서 함께 읽으면서 토의를 해보는 과정을 거쳐도 좋을 것 같습니다.
