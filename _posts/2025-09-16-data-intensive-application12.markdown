---
layout: post
title: "데이터 중심 애플리케이션 설계12"
date: 2025-09-16 20:02:01 +0900
categories: [ 독서 ]
---

---

# 데이터 시스템의 미래

## 개요

12장에서는 단순히 현재의 시스템을 설명하는 것을 넘어, **미래의 데이터 시스템이 어떻게 설계되고 구축되어야 하는지**에 대한 저자의 견해를 제시합니다.

---

## 1. 데이터 통합 및 파생 데이터 (Data Integration and Derived Data)

### 데이터 흐름 시스템의 필요성

현대 애플리케이션에서는 다양한 도구를 결합하여 데이터를 통합해야 합니다. **배치 및 스트림 처리 시스템**이 이러한 통합의 핵심 역할을 담당합니다.

**파생 데이터셋의 예시**:
```
원본 데이터: User Events Log
    ↓
파생 데이터:
├── Search Index (Elasticsearch)
├── Materialized Views (분석용 집계)
├── Recommendation System (ML 모델)
└── Real-time Metrics (모니터링 대시보드)
```

### 점진적인 진화 (Gradual Evolution)

**기존 방식의 문제**: 대규모 스키마 변경 시 서비스 중단 불가피

**파생 뷰를 활용한 해결책**:
```
Phase 1: Old Schema + Old Code (100% 트래픽)
Phase 2: Old Schema + Old Code (90%) + New Schema + New Code (10%)
Phase 3: Old Schema + Old Code (50%) + New Schema + New Code (50%)
Phase 4: New Schema + New Code (100%)
```

**실무 예시**:
```sql
-- 기존 사용자 테이블
CREATE TABLE users_v1 (
    id BIGINT,
    name VARCHAR(255),
    email VARCHAR(255)
);

-- 점진적 마이그레이션: 파생 뷰 생성
CREATE VIEW users_v2 AS
SELECT
    id,
    SUBSTRING_INDEX(name, ' ', 1) as first_name,
    SUBSTRING_INDEX(name, ' ', -1) as last_name,
    email
FROM users_v1;
```

### 람다 아키텍처 (Lambda Architecture)

**핵심 개념**: 과거 데이터 재처리와 실시간 업데이트를 결합

```
Real-time Layer (실시간):
Events → Storm/Flink → Redis/HBase → Query Results

Batch Layer (배치):
Events → Hadoop/Spark → HDFS → Query Results
           ↓
     (주기적 재처리)

Serving Layer:
Real-time Results + Batch Results → 최종 결과
```

**실무 적용 예시**:
```java
// 실시간: 최근 1시간 페이지뷰
@Service
public class RealtimeAnalytics {
    public long getRecentPageViews(String page) {
        return redisTemplate.opsForValue()
            .get("pageviews:recent:" + page);
    }
}

// 배치: 전체 기간 페이지뷰 (매시간 갱신)
@Service
public class BatchAnalytics {
    public long getTotalPageViews(String page) {
        return jdbcTemplate.queryForObject(
            "SELECT total_views FROM page_stats WHERE page = ?",
            Long.class, page);
    }
}
```

### 데이터베이스 비번들링 (Unbundling Databases)

**핵심 아이디어**: 애플리케이션 코드를 파생 함수로 사용하여 데이터 흐름을 명확화

**스프레드시트 모델**: 입력 변경 시 자동으로 파생 데이터 재계산
```
A1: 100 (주문 금액)
B1: 0.1 (할인율)
C1: =A1*(1-B1) (최종 금액: 90) ← 자동 계산

데이터 시스템에서:
Order Amount Changed → Trigger → Recalculate Final Amount
```

### 비동기 메시지 스트림의 장점

**전통적 동기식 API**:
```
Client → Service A → Service B → Service C
    ← 응답 ← 응답 ← 응답
(전체 지연시간 = A + B + C)
```

**비동기 메시지 스트림**:
```
Client → [Queue] → Service A → [Queue] → Service B → [Queue] → Service C
   ↓                 ↓                     ↓                     ↓
즉시 응답        백그라운드 처리      백그라운드 처리      백그라운드 처리
```

**실무 구현 예시**:
```java
// 주문 처리: 동기식 vs 비동기식
@RestController
public class OrderController {

    // 동기식: 모든 처리 완료까지 대기
    @PostMapping("/order/sync")
    public ResponseEntity<String> createOrderSync(@RequestBody Order order) {
        orderService.save(order);           // DB 저장
        inventoryService.updateStock(order); // 재고 업데이트
        emailService.sendConfirmation(order); // 이메일 발송
        return ResponseEntity.ok("Order processed");
    }

    // 비동기식: 즉시 응답, 백그라운드 처리
    @PostMapping("/order/async")
    public ResponseEntity<String> createOrderAsync(@RequestBody Order order) {
        orderService.save(order);
        eventPublisher.publish(new OrderCreatedEvent(order));
        return ResponseEntity.ok("Order received"); // 즉시 응답
    }
}
```

---

## 2. 정확성 및 무결성 목표 (Aiming for Correctness)

### 정확히 한 번 처리 (Exactly-Once Semantics)

**목표**: 시스템 장애나 재시도에도 불구하고 모든 작업이 정확히 한 번만 실행되도록 보장

**실무 시나리오**:
```
결제 요청 처리 중 네트워크 오류 발생
→ 클라이언트가 재시도
→ 중복 결제 위험
```

### 멱등성 (Idempotence) 구현

**고유한 작업 식별자 활용**:
```java
@Service
public class PaymentService {

    @Transactional
    public PaymentResult processPayment(PaymentRequest request) {
        String idempotencyKey = request.getIdempotencyKey();

        // 이미 처리된 요청인지 확인
        PaymentResult existing = paymentRepository
            .findByIdempotencyKey(idempotencyKey);
        if (existing != null) {
            return existing; // 기존 결과 반환
        }

        // 새로운 결제 처리
        PaymentResult result = executePayment(request);
        result.setIdempotencyKey(idempotencyKey);
        paymentRepository.save(result);

        return result;
    }
}
```

**API 레벨에서의 멱등성**:
```bash
# 같은 키로 여러 번 호출해도 안전
curl -X POST /api/payments \
  -H "Idempotency-Key: txn_123456789" \
  -d '{"amount": 100, "currency": "USD"}'
```

### 무결성 vs 적시성 (Integrity vs Timeliness)

**무결성 우선 원칙**: 대부분의 비즈니스에서 **데이터 정확성이 속도보다 중요**

**실무 예시**:
```java
@Service
public class BankTransferService {

    // 잘못된 방식: 속도 우선
    public void transferFundsUnsafe(Long fromAccount, Long toAccount, BigDecimal amount) {
        // 잔액 확인 없이 즉시 실행
        accountRepository.decreaseBalance(fromAccount, amount);
        accountRepository.increaseBalance(toAccount, amount);
    }

    // 올바른 방식: 무결성 우선
    @Transactional
    public TransferResult transferFundsSafe(Long fromAccount, Long toAccount, BigDecimal amount) {
        // 1. 잔액 충분성 검증
        Account from = accountRepository.findByIdForUpdate(fromAccount);
        if (from.getBalance().compareTo(amount) < 0) {
            throw new InsufficientFundsException();
        }

        // 2. 원자적 트랜잭션으로 실행
        from.decreaseBalance(amount);
        Account to = accountRepository.findByIdForUpdate(toAccount);
        to.increaseBalance(amount);

        // 3. 결과 기록 (감사 목적)
        TransferResult result = new TransferResult(fromAccount, toAccount, amount);
        transferLogRepository.save(result);

        return result;
    }
}
```

### 조정 회피 시스템 (Coordination-Avoiding Systems)

**목표**: 분산 트랜잭션 없이도 강력한 무결성 보장

**CRDT (Conflict-free Replicated Data Types) 활용**:
```java
// 예시: 분산 카운터
public class GCounterCRDT {
    private Map<String, Long> counters = new HashMap<>();

    public void increment(String nodeId) {
        counters.merge(nodeId, 1L, Long::sum);
    }

    public long getValue() {
        return counters.values().stream()
            .mapToLong(Long::longValue)
            .sum();
    }

    // 다른 노드와 병합 (항상 동일한 결과)
    public void merge(GCounterCRDT other) {
        other.counters.forEach((nodeId, value) ->
            this.counters.merge(nodeId, value, Long::max));
    }
}
```

**이벤트 소싱을 통한 조정 회피**:
```java
@Entity
public class BankAccount {
    private String accountId;
    private List<AccountEvent> events = new ArrayList<>();

    // 현재 잔액은 이벤트로부터 계산
    public BigDecimal getBalance() {
        return events.stream()
            .map(AccountEvent::getAmountChange)
            .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    // 새 이벤트 추가 (조정 없이 가능)
    public void addEvent(AccountEvent event) {
        events.add(event);
    }
}
```

---

## 3. 윤리적 책임: "올바른 일 하기" (Doing the Right Thing)

### 엔지니어의 도덕적 상상력

**핵심 메시지**: 기술자들은 자신이 구축하는 시스템의 **사회적 영향을 고려해야 할 책임**이 있습니다.

**실무에서의 고민 사례**:
```java
// 추천 알고리즘 설계 시 고려사항
@Service
public class RecommendationService {

    public List<Content> getRecommendations(User user) {
        // 기술적으로는 가능하지만 윤리적 고려 필요:

        // 1. 사용자 취약성 악용하지 않기
        if (user.hasAddictionHistory()) {
            // 중독성 콘텐츠 필터링
        }

        // 2. 편향 증폭 방지
        // 단순 클릭률만 최적화하면 극단적 콘텐츠 선호

        // 3. 다양성 보장
        // 편향된 정보만 노출되지 않도록 균형 고려

        return generateBalancedRecommendations(user);
    }
}
```

### 예측 분석과 편향 문제

**과거 차별의 답습 위험**:
```python
# 문제가 있는 채용 알고리즘 예시
def evaluate_candidate(resume_data):
    # 과거 채용 데이터로 훈련된 모델
    # → 기존 편향을 그대로 학습

    score = ml_model.predict(resume_data)

    # 성별, 인종 등에 따른 암묵적 차별 가능
    return score

# 개선된 접근 방식
def evaluate_candidate_fair(resume_data):
    # 1. 편향 요소 제거
    cleaned_data = remove_bias_indicators(resume_data)

    # 2. 공정성 메트릭 적용
    score = ml_model.predict(cleaned_data)

    # 3. 결과 검증
    if not passes_fairness_check(score, resume_data):
        # 인간 검토 요청
        return request_human_review(resume_data)

    return score
```

### 감시와 프라이버시 문제

**"데이터" → "감시" 관점 전환**:
```
데이터 수집 → 감시 인프라
사용자 분석 → 사용자 추적
개인화 → 프로파일링
```

**실무에서의 프라이버시 보호**:
```java
@Service
public class UserDataService {

    // 데이터 최소화 원칙
    public UserProfile getProfileForRecommendation(Long userId) {
        return UserProfile.builder()
            .interests(getInterests(userId))
            .ageGroup(getAgeGroup(userId))
            // 개인 식별 정보는 제외
            .build();
    }

    // 목적 제한 원칙
    public void collectUserBehavior(UserAction action) {
        if (action.getType() == ActionType.PURCHASE) {
            // 구매 데이터는 추천에만 사용
            recommendationService.updatePreferences(action);
        } else {
            // 다른 용도로 사용 금지
        }
    }

    // 데이터 보존 기간 제한
    @Scheduled(fixedRate = 24 * 60 * 60 * 1000) // 매일
    public void cleanupOldData() {
        userActivityRepository.deleteOlderThan(
            LocalDateTime.now().minusMonths(6)
        );
    }
}
```

**정보화 시대의 "오염 문제"**:
저자는 데이터 축적을 환경 오염에 비유합니다:
- 개별 기업의 합리적 선택이 사회 전체에는 해로움
- 규제와 업계 표준이 필요
- 기술자 개인의 윤리적 선택이 중요

---

## 4. 서버 개발자를 위한 실무 가이드

### 데이터 통합 패턴 구현

#### Change Data Capture (CDC) 설정
```yaml
# Debezium 설정 예시
apiVersion: kafka.strimzi.io/v1beta2
kind: KafkaConnect
metadata:
  name: debezium-mysql-connector
spec:
  config:
    database.hostname: mysql-server
    database.port: 3306
    database.user: debezium
    database.password: dbz
    database.server.id: 184054
    database.server.name: inventory
    table.include.list: inventory.customers,inventory.products
    database.history.kafka.bootstrap.servers: kafka:9092
    database.history.kafka.topic: schema-changes.inventory
```

#### 이벤트 소싱 구현
```java
@Entity
public class OrderAggregate {
    @Id
    private String orderId;

    @ElementCollection
    @OrderColumn
    private List<OrderEvent> events = new ArrayList<>();

    // 이벤트 추가
    public void apply(OrderEvent event) {
        events.add(event);
        // 상태 업데이트 로직
    }

    // 현재 상태 계산
    public OrderState getCurrentState() {
        return events.stream()
            .reduce(new OrderState(),
                   (state, event) -> event.apply(state),
                   (s1, s2) -> s2);
    }
}
```

### 무결성 보장 패턴

#### Saga 패턴 구현
```java
@Service
public class OrderSaga {

    @SagaOrchestrationStart
    public void processOrder(OrderCreatedEvent event) {
        // 1. 재고 예약
        sagaManager.choreography()
            .step("reserve-inventory")
            .compensatedBy("release-inventory")
            .invoke(inventoryService::reserve, event.getOrderId());

        // 2. 결제 처리
        sagaManager.choreography()
            .step("process-payment")
            .compensatedBy("refund-payment")
            .invoke(paymentService::charge, event.getPaymentInfo());

        // 3. 배송 준비
        sagaManager.choreography()
            .step("prepare-shipping")
            .invoke(shippingService::prepare, event.getShippingInfo());
    }
}
```

### 모니터링과 관찰성

#### 데이터 품질 메트릭
```java
@Component
public class DataQualityMonitor {

    private final MeterRegistry meterRegistry;

    @EventListener
    public void onDataProcessed(DataProcessedEvent event) {
        // 데이터 신선도 측정
        Duration age = Duration.between(
            event.getCreatedAt(),
            Instant.now()
        );

        Timer.Sample.start(meterRegistry)
            .stop(Timer.builder("data.processing.latency")
                .tag("source", event.getSource())
                .register(meterRegistry));

        // 데이터 완성도 측정
        double completeness = calculateCompleteness(event.getData());
        Gauge.builder("data.completeness.ratio")
            .tag("dataset", event.getDataset())
            .register(meterRegistry, completeness);
    }
}
```

---

## 미래 데이터 시스템의 설계 원칙

### 1. 데이터 흐름 중심 아키텍처
- **비동기 메시지 스트림** 우선 고려
- **파생 데이터**를 활용한 점진적 진화
- **이벤트 소싱**으로 변경 이력 보존

### 2. 무결성 우선 설계
- **멱등성** 있는 API 설계
- **조정 회피**를 통한 확장성 확보
- **정확히 한 번** 처리 보장

### 3. 윤리적 기술 구축
- **프라이버시 보호** 기본 설계
- **알고리즘 편향** 지속적 모니터링
- **사회적 영향** 고려한 기능 개발

### 4. 운영 관점의 고려사항
- **관찰성**: 데이터 흐름과 품질 모니터링
- **복구 가능성**: 장애 시 데이터 일관성 보장
- **점진적 배포**: 위험을 최소화한 시스템 개선
