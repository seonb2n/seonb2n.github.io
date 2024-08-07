---
layout: post
title: "Release 의 모든 것 (9장)"
date: 2024-01-29 22:24:01 +0900
categories: [ 독서, Release의 모든 것 ]
---

> Release 의 모든 것 (9장) 의 내용 중, 인상적이었던 부분을 발췌 및 요약합니다.

## 상호 연결

인스턴스들은 함꼐 연결되어 하나의 시스템이 되어야 한다. 상호 연결 계층은 다수의 인스턴스를 하나의 응집된 시스템으로 엮는 모든 메커니즘을 포함한다.

### 규모에 맞는 해법

회사와 조직의 규모에 따라 운영과 서비스의 차이가 발생한다. 도구가 강력해지기에, 작은 팀도 어마어마한 능력으로 오픈 소스를 활용할 수 있다.
<br><span>
아주 작은 팀이라도 적절한 모니터링을 해야 한다.

## DNS

### DNS 를 사용한 서비스 발견

다른 서비스를 호출하는 데 DNS 를 사용하여 호출하게 되면, 물리 호스트명이 아닌 논리 서비스 이름을 사용하는 것이다.
<br><span>
따라서 별칭을 가리키는 호스트가 변경되더라도 모든 호출 어플리케이션이 아니라 DNS 서버의 데이터 베이스만 변경하면 된다.
<br><span>
부하 분산은 이제 호출 당하는 쪽에서 해결할 문제다.

### DNS 를 사용한 부하 분산

DNS 라운드 로빈 부하 분산은 오래된 기술이다. 서비스 이름에 여러 IP 주소를 연결하고, 클라이언트가 여러 IP 주소 중 하나를 얻는 형태이다.
그러나 이 경우에 서비스용 IP 주소를 개별적으로 노출한다는 위험이 있다.
<br><span>
또한, 클라이언트가 서버 중 한 대에 직접 연결되기에 해당 인스턴스에 문제가 생길 경우 그 트래픽을 다른 곳으로 돌릴 수 없다.
이는 부하가 공평하게 나눠지도록 보장하지 않기에 인스턴스에 문제가 발생하는 경우, 대응하기에 곤란한 방식이다.

### DNS 를 사용한 글로벌 서버 부하 분산

글로벌 서버 부하 분산(GSLB) 에서는 DNS 의 가치가 제대로 발휘된다.
GSLB 는 여러 지리적 위치에 걸쳐 있는 클라이언트의 경로를 설정한다. 이 때 클라이언트는 네트워크 관점에서 가장 빠른 경로를 사용하는 것이 가장 성능에 좋다.
<br><span>
DNS 를 통해서 사이트를 접속하면, GSLB 의 서버 주소를 알 수 있다. GSLB 서버에서는 서비스 인스턴스의 IP 풀을 갖고 있는데, 각 서비스의 상태를 추적한다.
<br><span>
GSLB 에서는 유효한 서비스의 IP 를 응답함으로서 클라이언트는 유효한 IP 를 얻게 된다.
<br><span>
두 번째 기법은 서로 다른 GSLB 서버가 동일 요청에 대해 다른 IP 주소들을 답할 수 있게 하는 것이다.

1. DNS 에 주소를 질의한다.
2. 두 GSLB 서버가 모두 응답한다. 지역에 따라 다른 IP 주소가 응답된다.
3. 클라이언트에서는 먼저 응답받은 서버를 사용한다.
4. 부하 분산기는 트래픽을 인스턴스로 전달한다.

### DNS 의 가용성

DNS 서버의 주요 강조점은 다양성이다. DNS 를 운영 시스템과 같은 인프라에 두어서는 안된다.

### 소프트웨어 부하 분산

역 프록시 서버로 구성되면, 단일 IP 주소로 들어오는 호출을 역 다중화해서 여러 주소로 흩뿌린다.
<br><span>
스쿼드, HA 프록시, 아파치 httpd, nginx 등을 사용할 수 있다.
<br><span>
역 프록시 서버를 설정하면 응답을 캐시해서 서비스 인스턴스의 부하를 경감할 수 있다.

### 상태 점검

부하 분산기가 제공하는 주요 서비스 중 하나는 상태 점검이다. 일정 수 이상 상태 점검에 실패한 인스턴스에는 부하 분산기가 트래픽을 보내지 않는다.

### 고정 연결

고정 세션(Sticky Session)을 사용하면 부하 분산기가 반복되는 요청을 가능한 한 같은 인스턴스로 보내게 할 수 있다.
쿠키를 사용하는 방법이 일반적인데, 쿠키값을 바탕으로 인스턴스에 연결되도록할 수 있다.

### 시스템에 장애가 나는 이유

각 요청은 요청이 통과하는 모든 단계에서 소켓을 소비하는 것이 자명하다.
요청이 한 인스턴스에서 처리되는 동안 해당 인스턴스는 새 요청을 받을 임시 소켓 하나가 부족해진다.
<br><span>
또한, NIC 를 통해 전송되는 물리 입출력 대역폭도 한정된 자원이다. 소켓에서 데이터를 읽기 전까지 NIC 에 도착한 모든 것은 버퍼에 보관된다.
버퍼에 들어가는 모든 데이터는 대기열을 통해 움직여야 한다. 쓰기 버퍼가 가득차면 TCP 스택은 더 이상 쓰기 요청을 받을 수 없게 되고 요청을 차단한다.

### 장애 예방

부하가 심한 상황에서는 시간 내에 처리할 수 없는 작업을 거절하는 것이 할 수 있는 최선의 일이다. 이를 부하 제한 이라고 한다.
신속하게 거절하는 편이 시한을 넘길 떄까지 기다렸다가 끄는 것보다 낫다.
<br><span>
서비스의 수신 대기열도 상대적으로 짧아야 한다. 모든 요청은 수신 대기열에 머물면서 시간을 보내고 처리를 위해 또 어느 정도의 시간을 보낸다.
전체 소요 시간을 체류 시간이라고 부른다.

> 서비스를 보호하기 위해서 부하가 높아지면 요청을 거부해야 한다. 가능한 한 앞단과 가까운 작업은 거부되어야 하고,
> 더 깊이 들어올수록 더 많은 자원이 할당된다.

