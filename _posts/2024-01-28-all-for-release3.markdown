---
layout: post
title: "Release 의 모든 것 (7~8장)"
date: 2024-01-28 15:43:01 +0900
categories: [ 독서, Release의 모든 것 ]
---

> Release 의 모든 것 (7~8장) 의 내용 중, 인상적이었던 부분을 발췌 및 요약합니다.

## 기반(인프라)

### 네트워크 인터페이스와 이름

컴퓨터 관리자는 호스트명과 기본 탐색 도메인을 설정할 수 있다. 호스트명과 탐색 도메인을 하나로 연결한 것을 정규 도메인 이름(FQDN) 이라고 부른다.
<br><span>
어떤 프로그램이 특정 호스트명으로 연결을 시도할 때는 DNS 를 통해서 이름을 확인한다. 즉, 컴퓨터 자체의 FQDN 이 DNS 의 IP 주소와 일치한다는 보장이 없다.
그러나, 많은 유틸리티와 프로그램이 컴퓨터가 자체 할당한 FQDN 을 정당한 DNS 이름으로 보고, 자신의 IP 주소로 변환될 수 있다고 가정한다.

### 데이터 센터의 가상 머신

가상 머신은 시계와 관련된 모든 문제를 훨씬 악화시킨다. 시간을 확인하는 두 번의 호출 사이에 가상 머신이 실제 시간으로 무기한 정지될 수 있다.
<br><span>
정지된 가상 머신은 원래 호스트와 상대적으로 시간이 어긋나 있는 물리 호스트로 옮겨질 수 있다.

### 데이터 센터의 컨테이너

컨테이너에서 호스트로 포트 포워딩을 해야 한다. 컨테이너 사이에 가상 네트워크를 만들기 위해서는 가상 랜을 사용한다. 이는 매우 어려운 문제다.
또 다른 문제는 올바른 서버에 올바른 유형의 컨테이너 인스턴스가 충분히 있는지 확인하는 일이다.
<br><span>
컨테이너는 생겼다 없어지는, 빠른 가동 시간을 갖고 있다. 이 작업을 제어 평면 소프트웨어의 다른 부분에 위임하는데, 이 상황에서 가용성을 모니터링하는 것은 어렵다.
<br><span>
전체 컨테이너 이미지가 환경 사이에 옮겨지기 때문에 이미지에는 DB 접속 정보와 같은 것이 없어야 한다. 모든 접속 정보는 외부에서 제공되어야 한다.
혹은, 컨테이너를 실행할 때 구성 정보를 주입하는 방법을 고려해보자.

### 클라우드 내 가상 머신

기기의 ID 가 오래 유지되지 않는다는 점이 문제가 될 수 있다. 기기 ID 와 IP 주소는 기기가 작동하는 동안에만 유지된다. AWS 에서 가상 머신의 IP 주소는 부팅할 때마다
바뀐다.
<br><span>

## 프로세스

- 서비스  : 여러 기기에 걸친 프로세스의 집합으로, 단위 기능을 전달하기 위해 함께 일한다.
- 인스턴스 : 부하 분산기 뒤에 동일한 실행 파일들이 부하를 나누어 처리할 때, 기기 하나에 설치된 실행 파일 하나를 말한다.
- 실행 코드 : 프로세스로 기기를 구동할 수 있고 빌드 절차에 의해 만들어지는 산출물
- 프로세스 : 실행 코드를 메모리에 읽어들여 실행되는 이미지다.
- 설치본 : 기기 내에 있는 실행 코드와, 부속 디렉터리, 구성 파일, 기타 자원 파일을 의미한다.
- 배치 : 기기에 설치되는 행위.

### 코드 빌드

인스턴스의 코드에 무엇이 들어가는지 정확히 알아야만 한다. 개발자에서 운영 인스턴스까지 변조가 일어나지 않게 철저히 보장하는 강력한 **연계 보관성**을 구축해야 한다.
<br><span>
빌드 도구는 의존성을 어딘가에서 개발 장비로 내려받아야 한다. 인터넷에서 의존성을 내려받는 것은 안전하지 않다. 중간자 공격이나 상위 저장소를 위조하는 것으로 의존성 중 하나를
너무나 쉽게 몰래 교체할 수 있다.
<br><span>
라이브러리를 사설 저장소에 넣을 때는 디지털 서명이 상위 저장소에 공개된 정보와 일치하는지 확인해야 한다.

### 불변 폐기 가능 인프라

구성 관리 도구로 기본 이미지를 조금씩 변경하는 접근 방식에는 두 가지 큰 난관이 있다.
이미 검증된 기본 이미지에서 출발하여 일련의 변경 사항을 적용한 다음, 다시 해당 기기를 수정하거나 갱신하지 말아야 한다.
<br><span>
이를 **불변 인프라**라고 부른다. 한번 배치된 기기는 다시 바뀌지 않는다.

### 투명성

투명성이란 운영자, 개발자, 사업 책임가가 시스템의 과거 추세, 현재 상황, 어느 순간의 상태, 미래 예측을 이해할 수 있게 하는 특성을 뜻한다.
<br><span>
투명한 시스템은 디버깅하기가 훨씬 쉽다. 따라서 투명한 시스템은 불투명한 시스템보다 더 빨리 성숙할 것이다.
<br><span>
기술 또는 아키텍처를 변경할 때는 기존 인프라에서 얻어진 데이터에 전적으로 의존한다. 좋은 데이터는 좋은 의사 결정을 가능하게 한다.


### 투명성 기술
블랙 박스 기술은 프로세서 외부에 존재하며 외부에서 관찰 가능한 사항을 통해 프로세스를 조사한다. 예를 들면 로그를 남기면 로그 수집기는 서버 프로세스를 방해하지 않고 로그 데이터를 수집할 수 있다.
화이트 박스 기술은 프로세서 내부에서 작동한다. 언어별 라이브러리의 형태로 제공되는 에이전틈이며, 직접 호출할 수 있는 API 를 제공한다.

### 로그 기록

#### 로그 위치
인스턴스가 가상 머신에서 돌아간다고 하더라도 로그 파일을 애플리케이션 코드와 분리하는 것이 좋다.
심볼릭 링크를 사용해서 로그 전용 파일 시스템을 마운트 하는 방법을 고려해보자.

#### 로그 수준
로그는 개발이나 테스트가 아닌 운영이 목표여야 한다. 오류 또는 심각 수준으로 기록된 모든 로그는 운영의 일환으로 어떤 조치를 취할 필요가 있어야 한다는 것이다.
비즈니스 로직이나 사용자 입력의 오류는 로그에 경고로 남기자.
NullPointerException 은 무조건 오류라고 할 수 없다.
<br><span>
운영 환경에서 디버그 수준 로그를 남기는 마라. 빌드 절차에 디버그나 추적 로그 수준을 활성화하는 모든 구성 설정을 삭제해라.


#### 로그에 관한 메모
로그 메시지에는 트랜잭션의 단계를 추적하는데 사용될 식별자가 포함되어야 한다. 사용자 ID, 세션 ID, 트랜잭션 ID 또는 수신된 요청에 할당된 임의의 번호다.

### 상태 점검
측정값은 해석하기 어렵고, 무엇이 정상을 의미하는지 배우려면 시간이 필요하다.
<br><span>
빠른 요약 정보를 제공하기 위해 인스턴스의 일부로 상태 점검 기능을 만들 수 있다.
- 호스트 IP 주소
- 런타임이나 인터프리터 버전 번호
- 애플리케이션 버전이나 소스 코드 버전 관리 시스템 커밋 ID
- 인스턴스가 작업을 받아들이는지 여부
- 연결 풀, 캐시, 회로 차단기 상태

