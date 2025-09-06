---
layout: post
title: "데이터 중심 애플리케이션 설계11"
date: 2025-09-06 17:02:01 +0900
categories: [ 독서 ]
---

---

# 스트림 처리

## 개요

11장에서는 배치 처리와 대비되는 **스트림 처리**에 대해 다룹니다. 배치 처리가 고정된(bounded) 크기의 데이터를 처리하는 반면, 스트림 처리는 **끝없이 이어지는(unbounded) 데이터 스트림**을 실시간 또는 거의 실시간으로 처리합니다.

## 1. 이벤트 스트림 전송 (Transmitting Event Streams)

### 기본 개념

**이벤트(Event)**: 한 번 발생하여 여러 소비자에 의해 처리될 수 있는 데이터 단위
**토픽(Topic)/스트림(Stream)**: 관련된 이벤트들의 그룹화된 집합

### 메시징 시스템의 두 가지 패턴

#### 부하 분산(Load Balancing)
- 각 메시지는 **하나의 컨슈머에게만** 전달
- 처리 작업을 여러 컨슈머에게 분산
- 비싼 처리 작업에 유용

```
Producer → [Message Queue] → Consumer 1
                         → Consumer 2
                         → Consumer 3
```

#### 팬아웃(Fan-out)
- 각 메시지는 **모든 컨슈머에게** 전달
- 여러 독립적인 시스템이 같은 데이터 필요할 때 사용

```
Producer → [Topic] → Consumer A (Analytics)
               → Consumer B (Monitoring)
               → Consumer C (Archiving)
```

## 2. 전통적 메시지 브로커 vs 로그 기반 메시지 브로커

### 전통적 메시지 브로커 (RabbitMQ, ActiveMQ, IBM MQ)

**특징**:
- **일시적(Transient) 메시징**: 메시지 전달 후 즉시 삭제
- **푸시 기반**: 브로커가 컨슈머에게 메시지 푸시
- **ACK 메커니즘**: 컨슈머가 처리 완료를 확인해야 메시지 삭제

**장점**:
- 단순한 아키텍처
- 즉시 메시지 처리 보장
- 메모리 사용량 최소화

**단점**:
- 메시지 재처리 불가능
- 확장성 제한
- 메시지 순서 보장의 어려움

### 로그 기반 메시지 브로커 (Apache Kafka, Amazon Kinesis)

**핵심 개념**: 데이터베이스나 파일 시스템처럼 쓰여진 모든 것을 영구적으로 기록

#### 파티셔닝된 로그 구조

```
Topic: user-events
├── Partition 0: [event1] [event2] [event3] [event4] ...
├── Partition 1: [event5] [event6] [event7] [event8] ...
└── Partition 2: [event9] [event10] [event11] [event12] ...
```

**특징**:
- **단조 증가하는 오프셋**: 각 파티션 내에서 메시지에 순차적 번호 할당
- **파티션 내 전체 순서 보장**: 같은 파티션의 메시지는 순서 보장
- **풀 기반**: 컨슈머가 능동적으로 메시지 읽기
- **메시지 보존**: 설정된 보존 기간 동안 메시지 유지

#### 확장성과 내결함성

로그 기반 브로커는 확장이 훨씬 쉽습니다. Kafka를 확장하려면 토픽의 파티션 수를 늘리기만 하면 됩니다

```
확장 전: Topic (3 partitions) → 3 consumers
확장 후: Topic (6 partitions) → 6 consumers
```

**파티션 키를 통한 순서 보장**:
```java
// 같은 사용자의 이벤트는 같은 파티션으로
producer.send(new ProducerRecord<>("user-events",
    user.getId(), // 파티션 키
    userEvent));
```

### 재처리 가능성: 스트림 처리의 핵심

로그 기반 메시징의 가장 큰 장점은 **메시지 재생(replay)** 능력입니다:

```
Consumer Group A: offset 1000에서 읽는 중
Consumer Group B: offset 500부터 재처리 (버그 수정 후)
Consumer Group C: offset 0부터 새로운 분석 작업 시작
```

이는 배치 처리의 특성과 유사하여 **입력 데이터의 반복 가능한 변환**을 가능하게 합니다.

## 3. 데이터베이스와 스트림 (Databases and Streams)

### 시스템 동기화 문제

**이중 쓰기(Dual Writes) 문제**:
```
Application → Database (SUCCESS)
          → Search Index (FAIL)
결과: 데이터 불일치 발생
```

**해결책**: 데이터베이스를 단일 소스로, 다른 시스템을 팔로워로 구성

### 변경 데이터 캡처 (Change Data Capture, CDC)

**개념**: 시스템 오브 레코드의 모든 변경사항을 파생 데이터 시스템에 반영

**구현 방법**:
- **WAL/Binlog 읽기**: MySQL의 binlog, PostgreSQL의 WAL 활용
- **CDC 도구**: Debezium, Maxwell, Streamsets 등

```
MySQL → Binlog → Kafka → [Elasticsearch, Data Warehouse, Cache]
```

**실무 예시**:
```sql
-- MySQL에서 사용자 정보 업데이트
UPDATE users SET email = 'new@email.com' WHERE id = 123;

-- CDC가 캡처하는 이벤트 -> 모니터링이나 고객 활동에 사용된다
{
  "op": "u",  // update
  "ts_ms": 1641234567890,
  "before": {"id": 123, "email": "old@email.com"},
  "after": {"id": 123, "email": "new@email.com"}
}
```

### 이벤트 소싱 (Event Sourcing)

**핵심 개념**: 애플리케이션 상태 변경을 불변 이벤트 시퀀스로 저장

**명령(Command) vs 이벤트(Event)**:
```
명령: "사용자 123의 이메일을 변경하라"
     ↓ (유효성 검사)
이벤트: "사용자 123의 이메일이 변경됨"
```

**상태와 스트림의 관계**:
- **상태** = 이벤트 스트림의 **적분(integrate)**
- **변경 스트림** = 상태의 **미분(differentiate)**

```
이벤트 스트림: [생성, +100원, -30원, +50원]
현재 잔액: 120원 (모든 이벤트의 누적 결과)
```

## 4. 스트림 처리 (Processing Streams)

### 주요 활용 사례

#### 모니터링과 알림
- **사기 감지**: 비정상적인 거래 패턴 실시간 탐지
- **보안 침입 감지**: 로그인 시도 패턴 분석
- **시스템 모니터링**: 에러율, 응답시간 임계값 감시

#### 실시간 통계 계산
**윈도우(Window) 기반 처리**:

```
텀블링 윈도우 (5분):
00:00-00:05 | 00:05-00:10 | 00:10-00:15 | ...

호핑 윈도우 (5분 크기, 1분 간격):
00:00-00:05
  00:01-00:06
    00:02-00:07
      00:03-00:08
```

**실무 예시**:
```java
// Kafka Streams를 사용한 5분 윈도우 집계
KStream<String, PageView> pageViews = ...;
pageViews
  .groupByKey()
  .windowedBy(TimeWindows.of(Duration.ofMinutes(5)))
  .count()
  .toStream()
  .foreach((key, count) ->
    alerting.send("Page " + key + " viewed " + count + " times"));
```

### 시간에 대한 추론

#### 이벤트 시간 vs 처리 시간

**이벤트 시간**: 실제 이벤트 발생 시점
**처리 시간**: 스트림 프로세서가 이벤트를 관찰하는 시점

```
이벤트 발생: 09:00:00
네트워크 지연...
처리 시점: 09:00:30

→ 09:00-09:01 윈도우에 포함되어야 하지만,
  처리 시간 기준으로 하면 잘못된 윈도우에 배치됨
```

#### 지연 이벤트 처리

**워터마크(Watermark)** 개념:
```
워터마크: "이 시점 이전의 모든 이벤트는 도착했다"고 가정하는 시점
예: 현재 시간 - 30초

늦게 도착하는 이벤트(Stragglers) 처리:
1. 무시
2. 별도 스트림으로 처리
3. 결과 업데이트 (복잡성 증가)
```

### 스트림 조인 (Stream Joins)

#### 스트림-스트림 조인
**윈도우 조인**: 특정 시간 범위 내에서 이벤트 매칭

```java
// 클릭과 구매를 30분 내에 조인
KStream<String, Click> clicks = ...;
KStream<String, Purchase> purchases = ...;

clicks.join(purchases,
  (click, purchase) -> new ClickPurchase(click, purchase),
  JoinWindows.of(Duration.ofMinutes(30)));
```

#### 스트림-테이블 조인
**활동 이벤트 보강**: 변경 로그로 이벤트에 컨텍스트 추가

```java
// 사용자 활동에 프로필 정보 추가
KStream<String, UserActivity> activities = ...;
KTable<String, UserProfile> profiles = ...;

activities.join(profiles,
  (activity, profile) ->
    activity.enrichWith(profile.getLocation(), profile.getAge()));
```

#### 테이블-테이블 조인
**구체화된 뷰 유지**: 두 변경 로그를 조인하여 새로운 뷰 생성

## 5. 내결함성 (Fault Tolerance)

### 배치 처리와의 차이점

**배치 처리**: 실패 시 처음부터 재시작 가능
**스트림 처리**: 무한한 스트림이므로 "처음부터" 재시작이 비현실적

### 마이크로배칭(Microbatching)

스트림을 작은 블록으로 나누어 미니어처 배치 프로세스처럼 처리

```
연속 스트림: ━━━━━━━━━━━━━━━━━━━━
마이크로배치: [████][████][████][████]
             1초   1초   1초   1초
```

**Spark Streaming**: 1초 단위 마이크로배치
**Apache Flink**: 동적으로 배치 크기와 경계 조건 선택

### 체크포인트 (Checkpointing)

**개념**: 작업 상태를 주기적으로 저장하여 실패 시 복구점 제공

```
Time: 00:00  00:01  00:02  00:03  00:04
      [CP1]         [CP2]         [CP3]
             ↑
         실패 시 CP2부터 재시작
```

### 정확히 한 번 처리 (Exactly-Once Semantics)

**목표**: 모든 출력과 부작용이 처리 성공 시에만 적용되도록 보장

**포함 범위**:
- 다운스트림 메시지 전송
- 데이터베이스 쓰기
- 작업자 상태 변경
- 입력 메시지 확인 (컨슈머 오프셋 이동)

#### 멱등성(Idempotence) 활용

**설계 원칙**: 여러 번 처리해도 결과가 동일하도록 설계

```java
// 잘못된 방식: 비멱등적
balance += amount;

// 올바른 방식: 멱등적
if (!processedTransactions.contains(transactionId)) {
  balance += amount;
  processedTransactions.add(transactionId);
}
```

#### 울타리 토큰(Fencing Tokens)

**문제**: 죽은 것으로 간주되었지만 실제로는 살아있는 노드의 간섭
**해결**: 토큰을 통해 오래된 프로세스의 작업 거부

```
Generation 1: [Process A] ─┐
                          │ (네트워크 분리)
Generation 2: [Process B] ─┘
                          │
Storage Server: "Generation 1 요청 거부"
```

## 6. 서버 개발자를 위한 핵심 포인트

### 메시지 브로커 선택 기준

#### Kafka를 선택해야 하는 경우
- **높은 처리량** 필요 (수백만 메시지/초)
- **메시지 재처리** 필요
- **이벤트 소싱** 아키텍처
- **실시간 분석** 및 스트림 처리
- **다중 컨슈머** 시나리오

#### 전통적 MQ를 선택해야 하는 경우
- **단순한 워크 큐** 패턴
- **낮은 지연시간** 우선 (밀리초 수준)
- **복잡한 라우팅** 로직 필요
- **트랜잭션** 보장 필요
- **운영 복잡성** 최소화

### 실무 구현 패턴

#### 1. 이벤트 드리븐 아키텍처
```
Order Service → [order.created] → Inventory Service
                              → Payment Service
                              → Notification Service
```

#### 2. CQRS with Event Sourcing
```
Command → Event Store → Read Models
                    → Projections
                    → Analytics
```

#### 3. Change Data Capture
```
OLTP Database → CDC → Kafka → [Analytics, Search, Cache]
```

### 운영 고려사항

#### 모니터링 지표
- **Consumer Lag**: 컨슈머가 얼마나 뒤쳐져 있는지
- **처리량**: 초당 처리되는 메시지 수
- **에러율**: 실패한 메시지 비율
- **지연시간**: 메시지 처리 시간

#### 장애 복구 전략
- **Dead Letter Queue**: 처리 실패한 메시지 별도 보관
- **재시도 정책**: 지수 백오프, 최대 재시도 횟수
- **서킷 브레이커**: 다운스트림 서비스 장애 시 보호

## 스트림 처리의 주요 원칙

- **이벤트 시간 기반 처리**로 정확한 분석
- **멱등성**을 통한 안정적인 재처리
- **백프레셔**와 **체크포인트**를 통한 내결함성
- **파티셔닝**을 통한 확장성과 순서 보장

