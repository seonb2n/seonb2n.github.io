---
layout: post
title: "CodeCrafters - Redis 후기"
date: 2025-05-24 13:02:01 +0900
categories: [ 경험, CodeCrafters ]
---

---

# CodeCrafters - Redis 후기

> 3개월에 30달러 내돈 내산
> https://codecrafters.io/

![Desktop View](/assets/img/2025-05-24/complete.png){: width="972" height="589" }

<br/> 언제나 오픈 소스에 관심이 있던 저로서는, OOO 를 직접 만들어보라는 이 문구에 혹하지 않을 수 없었습니다. 마침 Redis 를 사용하면서도 언젠가는 직접 구현해봐야겠다는 생각이 있었기에, 바로 홀린 듯이 결제해서 Redis 만들기에 착수했습니다.

> 결과물은 여기 https://github.com/seonb2n/build-your-own-redis

개발하면서 느낀 점과 CodeCrafters 의 장단점을 정리해보고자 합니다. 누군가 사용을 망설이는 이에게 좋은 후기가 되기를!

## 장점

### 요건에 따라 구현을 잘 됐는지 채점 시스템이 좋다.

매번 코드를 푸시하면 자동으로 테스트가 돌아가면서 내 구현이 올바른지 확인해줍니다. 마치 코딩 테스트를 보는 느낌인데, 실제로는 실무에서 쓰이는 기술을 만들고 있다는 점이 묘하게 중독성이 있습니다. "통과!" 라는 초록불이 뜰 때마다 도파민이 분비되는 건 덤이고요.

### step 별 요건이 명확하다.

각 단계마다 구현해야 할 기능이 매우 명확하게 정의되어 있습니다. "PING 명령어 구현하기", "SET/GET 구현하기" 같은 식으로 말이죠. 막막한 프로젝트가 아니라 게임 퀘스트를 하나씩 클리어하는 느낌입니다. 다만 때로는 너무 친절해서 스스로 생각할 여지가 줄어든다는 생각도 들었습니다.

### 개발에 대한 자유도가 높다.

언어 선택부터 아키텍처 설계까지 자유롭게 할 수 있습니다. 저는 Python 으로 구현했는데, 다른 사람들의 코드를 보니 Python, Rust, Java 등 다양한 언어로 구현한 것을 볼 수 있었습니다. 새로운 언어를 익히는 과정으로 삼아도 좋을 것 같습니다. 다른 OSS 는 평소에 관심 있던 goLang 으로 해볼까 생각중이에요.

## 단점

### 지나간 Step 을 리팩토링 후에 다시 확인할 수 없다

이전 단계를 리팩토링하고 나서 다시 테스트해보고 싶었는데, 그런 기능을 찾을 수 없었습니다. 혹시 제가 못 찾은 건지도 모르겠지만, 이 부분은 아쉬웠습니다. 코드를 개선하고 싶어도 "혹시 이전 기능이 깨졌나?" 하는 불안감이 있었거든요.

### 사람들의 의견 교류가 거의 없다.

커뮤니티 기능이 있긴 하지만, 활발하지 않습니다. 막힌 부분이 있을 때 "이거 어떻게 하셨어요?" 같은 질문을 할 곳이 마땅치 않았습니다. 혼자서 끙끙 앓음면서 AI 와 같이 삽질해야 했습니다. 사람들마다 구현 스타일이 다르다보니 중간 쯤에 이르러서는 다른 사람들의 구현 정답이 제 경우에는 참고할 사항이 아니더라고요.

### 가끔 오류나 버그가 있다.

완벽하지 않은 시스템이다 보니 가끔 테스트 케이스에 버그가 있거나, 설명과 실제 요구사항이 다른 경우가 있었습니다. 이럴 때는 "내가 잘못 이해한 건가?" 하면서 한참을 헤맸는데, 알고 보니 플랫폼 자체의 문제였던 적이 몇 번 있었습니다. 다행히 다음날에 다시 하니까 해결이 되어 있더라고요.

### 현재 지원하는 대부분의 OSS 는 기초적인 단계까지만 구현되어 있다.

Redis를 예로 들면, 실제 Redis의 고급 기능들(Master 사망 시, replica 승격 로직 등)은 다루지 않습니다. 물론 마스터-레플리카 구조 및 커맨드 전파, 트랜잭션과 같은 요건도 추가되어 있긴 합니다. 하지만 이 정도가 제일 고급 기능이고, 다른 OSS 는 step 수준이 훨씬 얕습니다. 물론 입문용으로는 충분하지만, "진짜 Redis를 만들었다!" 라고 하기에는 조금 아쉬운 부분입니다.

## 느낀 점

## 사용하는 OSS 를 만들어보는 일은 매우 재밌다.
평소에 당연하게 사용하던 Redis의 내부 동작을 직접 구현해보니, 정말 새로운 관점에서 이해할 수 있었습니다. "아, Redis가 이런 식으로 동작하는구나!" 하는 깨달음의 순간들이 있었고, 실무에서도 Redis를 더 효율적으로 사용할 수 있게 되었습니다. 마치 자동차를 분해해서 다시 조립해본 느낌이랄까요?

## 요건에도 부합하면서 책임이 잘 분리된 코드를 만드는 것은 어렵다.

단순히 테스트만 통과하는 코드를 만드는 것은 쉬웠지만, 확장 가능하고 유지보수하기 좋은 코드를 만드는 것은 별개의 문제였습니다. 특히 초반에는 "일단 돌아가게만 하자" 는 마음으로 코드를 짰다가, 나중에 기능이 추가되면서 스파게티 코드가 되는 경험을 했습니다. 실무에서도 느끼는 고민이지만, 토이 프로젝트에서도 마찬가지더군요.

## 주니어 개발자에게 딱 좋은 수준
3년차인 저에게는 적당히 도전적이면서도 완주할 수 있는 수준이었던 것 같아요. 매일 퇴근 후에 1~2 시간 정도 해서 6주 만에 55 step 을 클리어했습니다. 초기의 언어를 배우기에도 좋은 제품인 것 같고, 실제로 그 목적으로 사용하는 다른 사람들도 많아보입니다.

## 마무리
30달러가 아깝지 않은 경험이었습니다. 물론 완벽한 서비스는 아니지만, 평소에 "언젠가는 해봐야지" 하고 미뤄두던 일을 실제로 해볼 수 있게 해주는 좋은 도구였습니다.
다음에는 Git 이나 HTTP server 를 만들어볼까 생각 중입니다. 여러분도 평소에 관심 있던 오픈소스가 있다면, CodeCrafters에서 한 번 도전해보시는 것을 추천드립니다.
