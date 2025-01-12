---
layout: post
title: "PostgreSQL 17 document 로 CDC 살펴보기"
date: 2025-01-05 09:02:01 +0900
categories: [ 데이터베이스 ]
---

---

# PostgreSQL 17 document 로 CDC 살펴보기

## 배경

> https://github.com/seonb2n/postgresql-cdc-spring

안녕하세요. 일전에 Postgresql 에서 CDC 를 구현하기 위해서 debezium 을 활용해 실습을 했던 적이 있습니다. 손쉽게 구현은 했지만, 정확한 원리를 알기 위해서 공식 문서를 참고해보고자 합니다.
<br>
GPT 에게 물어본 결과 다음과 같은 항목을 읽으라고 추천받았습니다.
> [#47 Logical Decoding](#47-logical-decoding) Logical Decoding CDC의 핵심 기능인 논리적 디코딩에 대한 상세 내용. 변경 데이터를 캡처하고 처리하는 기본 메커니즘 설명

> [#28 Write-Ahead Log](#28-reliability-and-the-write-ahead-log) Reliability and the Write-Ahead Log WAL(Write-Ahead Log)이 CDC의 기반이 되는 원리 설명. 변경 사항이 어떻게 로깅되는지 이해 가능

> [#29 Logical Replication](#29-logical-replication) Logical Replication CDC와 밀접하게 연관된 논리적 복제 개념 설명. 실제 데이터 변경사항이 어떻게 전파되는지 이해 가능

> [#26 High Availability](#26-high-availability-load-balancing-and-replication) High Availability, Load Balancing, and Replication CDC를 활용한 데이터 동기화와 복제 관련 내용

> [#38 Event Triggers](#38-event-triggers) Event Triggers 데이터 변경 이벤트를 감지하고 처리하는 방법 이해

하나씩 읽으며 내용 정리해보겠습니다.

# 47. Logical Decoding

> https://www.postgresql.org/docs/current/logicaldecoding.html

## 1. 기본 개념

### Logical Decoding이란?
* PostgreSQL의 변경 사항(INSERT/UPDATE/DELETE)을 외부 시스템이 이해할 수 있는 형식으로 스트리밍하는 기능입니다
* MySQL의 binlog와 유사하지만, 더 유연한 기능을 제공합니다

### 주요 사용 사례
* 데이터 복제(Replication)
* 변경 이력 추적(Audit)
* 실시간 데이터 파이프라인 구축

## 2. 핵심 구성 요소

### Replication Slots
```sql
-- 복제 슬롯 생성 예시
SELECT * FROM pg_create_logical_replication_slot('slot_name', 'test_decoding');
```
* 변경 데이터의 위치를 추적하는 메커니즘
* 복제가 중단되어도 필요한 WAL 데이터를 자동으로 유지
* MySQL의 binlog position보다 관리가 용이

### Output Plugins
* 변경 데이터의 출력 형식을 결정
* 기본 제공되는 'test_decoding' 외에도 사용자 정의 가능
* JSON, Protobuf 등 다양한 형식으로 변환 가능

## 3. 데이터 수신 방법

### SQL 인터페이스
```sql
-- 변경 데이터 조회
SELECT * FROM pg_logical_slot_get_changes('slot_name', NULL, NULL);
```

### 스트리밍 복제 프로토콜
* 실시간으로 변경 데이터를 수신 가능
* 복제 프로토콜을 통한 지속적인 데이터 수신

## 4. MySQL과의 주요 차이점

* **유연성**: 사용자 정의 출력 플러그인 지원
* **관리용이성**: Replication slot으로 자동 WAL 관리
* **접근성**: SQL로 직접 변경 데이터 조회 가능
* **확장성**: 다양한 고급 기능(대용량 트랜잭션, 2PC) 지원

# 28. Reliability and the Write-Ahead Log

> https://www.postgresql.org/docs/current/index.html

## 1. 신뢰성(Reliability)의 기본 개념

### PostgreSQL의 신뢰성 보장 방식

* 모든 변경사항은 먼저 로그에 기록 후 실제 데이터 변경
* MySQL의 redo log와 유사한 개념인 WAL 사용
* ACID 속성을 완벽하게 보장

## 2. 데이터 체크섬(Data Checksums)

### 체크섬이란?

* 데이터 손상을 감지하기 위한 검증 메커니즘
* 디스크 오류나 하드웨어 문제로 인한 데이터 손상 탐지
* MySQL의 innodb_checksum_algorithm과 유사한 기능

```sql
-- 체크섬 활성화 상태 확인
SHOW data_checksums;
```

## 3. WAL(Write-Ahead Logging)

data integrity 를 보장하기 위한 표준 방법입니다.WAL 의 주요한 개념은 변경 사항이 로그된 이후에만 데이터가 쓰여진다는 것입니다.

### WAL의 주요 목적
* 디스크 쓰기 횟수를 현저히 줄일 수 있음. 트랜잭션이 커밋된 이후에만 디스크에 영속화를 함.
* 온라인 백업과 특정 시점으로 리커버리하는 기능도 가능하게 함.
* 트랜잭션의 원자성과 영속성 보장
* 비동기 복제의 기반이 됨

### WAL의 작동 방식
```text
1. 변경사항을 WAL 버퍼에 기록
2. WAL 파일에 영구적으로 기록
3. 실제 데이터 파일 변경
```

## 4. 비동기 커밋(Asynchronous Commit)

### 동작 방식
* 트랜잭션이 논리적으로 완료되면 즉시 성공 반환
* WAL 레코드의 디스크 기록을 기다리지 않음
* 성능 향상과 데이터 손실 위험을 교환

### 특징과 용도
* 트랜잭션 응답 시간 개선을 위한 기능
* WAL 기록을 비동기적으로 처리
* MySQL의 innodb_flush_log_at_trx_commit=2와 유사

```sql
-- 세션 레벨에서 비동기 커밋 설정
SET synchronous_commit = off;
```

### 위험 구간

```text

1. 트랜잭션 완료
2. 클라이언트에 성공 응답 반환 ──┐
3. WAL 버퍼에 변경사항 기록      │
4. WAL writer가 디스크에 기록     │
                                 │
   [2]와 [4] 사이가 위험 구간 ────┘

```

* 클라이언트는 성공 응답을 받았지만, 데이터가 아직 디스크에 기록되지 않았다면 발생
* WAL writer 가 주기적으로 깨어나서 작업하기에, 작업 전에 서버 크래쉬가 발생하면 데이터가 유실될 수 있다.

## 5. WAL 설정(Configuration)

### 주요 설정 파라미터
* `wal_level`: WAL 기록 수준 설정
* `wal_buffers`: WAL 버퍼 크기
* `wal_writer_delay`: WAL 작성 주기

```sql
-- WAL 설정 확인
SHOW wal_level;
SHOW wal_buffers;
```

## 6. WAL 내부 구조(Internals)

### WAL 세그먼트 파일
* 기본 16MB 크기의 순차적 로그 파일
* 순환적으로 재사용
* MySQL의 redo log 파일과 유사한 개념

### WAL의 장점
* 랜덤 I/O를 순차 I/O로 변환
* 데이터 파일 변경을 지연시켜 성능 향상
* 포인트-인-타임 복구 가능

### MySQL과의 주요 차이점
* WAL은 단일 목적(데이터 복구)에 집중
* MySQL의 binlog가 담당하는 복제 기능은 별도 처리
* 더 세밀한 설정 옵션 제공

# 29. Logical Replication

> https://www.postgresql.org/docs/current/index.html

## 1. 논리적 복제의 기본 개념

### 정의와 특징
* 데이터 객체와 변경사항을 복제하는 방식
* 복제 식별자(주로 기본 키) 기반
* 물리적 복제와 달리 선택적 복제 가능

### 작동 방식
```plaintext
Publisher(발행자) ──> Publication(발행물) ──> Subscriber(구독자)
```

## 2. 주요 구성 요소

### Publication (발행)
* 복제할 데이터의 집합을 정의
* 테이블 단위로 선택 가능
* 데이터 필터링 가능
* UPDATE/DELETE 시에는 Replica Identity 를 통해서 복제 대상을 식별할 수 있어야 함

### Subscription (구독)
* 발행된 데이터를 수신하는 설정
* 여러 발행을 구독 가능
* 동일 publisher-subscriber 쌍 간 여러 구독 가능
* 캐스케이드 복제 지원
* 스키마는 복제되지 않고, 테이블은 미리 존재해야 함. 뷰는 불가하며 일반 테이블만 복제 가능

### Publication Slot
* 구독당 하나의 슬롯을 사용해서 지속적인 변경 사항의 추적

## 3. 주요 사용 사례

### 데이터 동기화
* 증분 변경사항 실시간 전송
* 데이터베이스 일부만 선택적 복제
* 여러 데이터베이스 통합

### 버전 및 플랫폼 간 복제
* 다른 PostgreSQL 버전 간 복제
* 다른 운영체제 간 복제 (Linux ↔ Windows)

## 4. 복제 프로세스

### 초기 동기화
```sql
-- 발행 생성
CREATE PUBLICATION my_pub FOR TABLE users, orders;

-- 구독 생성
CREATE SUBSCRIPTION my_sub
CONNECTION 'host=publisher dbname=db'
PUBLICATION my_pub;
```

### 실시간 복제
1. 발행자의 변경사항 감지
2. 구독자에게 변경사항 전송
3. 구독자가 동일 순서로 적용

## 5. MySQL 복제와의 차이점

### 주요 차이점
* PostgreSQL
  - 객체 단위의 선택적 복제
  - 양방향 복제 지원
  - 필터링과 변환 기능

* MySQL
  - 전통적으로 전체 DB 복제
  - 마스터-슬레이브 구조
  - 제한적인 필터링

## 6. 고급 기능

### Row Filters (행 필터링)
* 특정 조건에 맞는 데이터만 복제
* UPDATE 변환 지원
* 파티션 테이블 지원

### Column Lists (열 선택)
* 특정 열만 선택적으로 복제
* 민감한 데이터 제외 가능

## 7. 모니터링과 보안

### 모니터링
```sql
-- 복제 상태 확인
SELECT * FROM pg_stat_subscription;
SELECT * FROM pg_stat_replication;
```

### 보안 고려사항
* 복제 사용자 권한 관리
* 데이터 접근 제어
* 네트워크 보안 설정

# 26. High Availability, Load Balancing, and Replication

> https://www.postgresql.org/docs/current/high-availability.html

## 1. 핵심 아키텍처 구성

### 서버 유형
* **Primary (Master)**
  - 읽기/쓰기 가능
  - 데이터 수정 권한 보유

* **Standby (Slave / Secondary)**
  - Warm Standby: 승격 전까지 연결 불가
  - Hot Standby: 읽기 전용 쿼리 처리 가능

```sql
-- Hot Standby 설정 예시
ALTER SYSTEM SET hot_standby = on;
```

## 2. 동기화 방식

### 동기식 복제
```plaintext
Client → Primary → 모든 Standby 확인 → Commit 완료
```
* 데이터 손실 없음 보장
* 일관된 결과 보장
* 성능 오버헤드 발생

### 비동기식 복제
```plaintext
Client → Primary → Commit 완료
         ↓
    Standby 전파 (지연 발생)
```
* 더 빠른 응답 시간
* 일부 데이터 손실 가능성
* 약간의 데이터 지연 허용

## 3. 구현 단위

### 서버 단위
* 전체 데이터베이스 서버 복제
* 관리 단순성
* 유연성 제한

### 세부 단위
* 데이터베이스별 복제
* 테이블별 복제
* 더 높은 유연성

## 4. 성능과 기능의 트레이드오프

### 성능 영향 요소
```plaintext
동기식 복제 (네트워크 지연 2ms 가정)
- 쓰기 작업: +2ms 이상 지연
- 처리량: 최대 50% 감소 가능

비동기식 복제
- 쓰기 작업: 최소 지연
- 처리량: 거의 영향 없음
```

## 5. MySQL과의 비교

### PostgreSQL
* Hot Standby 기본 지원
* 스트리밍 복제 내장
* 세부적인 복제 설정 가능

### MySQL
* Semi-sync 복제
* Group Replication 옵션
* 상대적으로 단순한 구성

## 6. 주요 사용 사례

### 고가용성 구성
```plaintext
Primary ─→ Sync Standby (자동 장애 조치)
   └──→ Async Standby (재해 복구)
```

### 부하 분산
```plaintext
Primary ─→ Hot Standby 1 (읽기 부하)
   └──→ Hot Standby 2 (읽기 부하)
```

# 38. Event Triggers

> https://www.postgresql.org/docs/current/event-triggers.html

## 개요
- 일반 트리거와 달리 데이터베이스 전체에 적용되는 글로벌 트리거
- DDL 이벤트를 캡처할 수 있음
- 프로시저 언어나 C로 작성 가능 (일반 SQL은 불가)

## 동작 유형

- login 이벤트
- ddl_command_start dlqpsxm
- ddl_command_end 이벤트
- sql_drop 이벤트
- table_rewrite 이벤트

## 일반 트리거와 이벤트 트리거 비교

| 특징 | 일반 트리거 | 이벤트 트리거 |
|------|------------|--------------|
| 범위 | 단일 테이블 | 데이터베이스 전체 |
| 이벤트 타입 | DML 이벤트 | DDL 이벤트 |
| 작성 언어 | SQL, PL/pgSQL 등 | 프로시저 언어, C |
| 적용 대상 | 특정 테이블의 데이터 변경 | 데이터베이스 구조 변경 |

## 주요 특징
1. **글로벌 스코프**
  - 데이터베이스 전체에 영향을 미침
  - 구조적 변경 모니터링 가능

2. **DDL 이벤트 지원**
  - CREATE, ALTER, DROP 등의 DDL 문 감지
  - 스키마 변경 추적 가능

3. **프로그래밍 언어 지원**
  - 이벤트 트리거 지원하는 프로시저 언어 사용
  - C 언어로 작성 가능
  - 일반 SQL은 사용 불가

4. **활용 사례**
  - 데이터베이스 스키마 변경 감사
  - DDL 작업 로깅
  - 스키마 변경 제어 및 검증
