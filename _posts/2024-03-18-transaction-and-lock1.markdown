---
layout: post
title: "동시성 이슈와 트랜잭션 격리수준과 락1"
date: 2024-03-18 19:49:01 +0900
categories: [ Database ]
---

# 트랜잭션 격리 수준 테스트

트랜잭션 격리 수준에 따라서 어떤 동시성 이슈가 발생하는지 테스트해보고, 그 결과를 공유하고자 합니다.
<br><span>
실험 환경은 다음과 같습니다.

| 환경 | 버전      |
|------|---------|
| MySQL | 8.2.0   |
| Spring Boot | 3.2.3   |
| Java | 17      |

<br><span>
한 개의 레코드에 대해서, 동시에 10 개의 쓰레드가 접근해서 업데이트하는 시나리오를 생각해보겠습니다.

## 트랜잭션을 사용하지 않는 경우

```java

  @DisplayName("트랜잭션을 사용하지 않는 경우, 값이 덮어 씌워질 것이다.")
  @Test
  void testAddPointWithoutTransaction() throws InterruptedException {
    final int threadNumber = 10;
    final long inputPoint = 100L;
    ExecutorService executorService = Executors.newFixedThreadPool(10);
    CountDownLatch latch = new CountDownLatch(threadNumber);
    for (int i = 0; i < threadNumber; i++) {
      executorService.execute(() -> {
        pocketService.addPointWithoutTransaction(1L, inputPoint);
        var point = pocketService.findTotalPocketPointByUserId(1L);
        logger.info("point: {}", point);
        latch.countDown();
      });
    }
    latch.await();
    var point = pocketService.findTotalPocketPointByUserId(1L);
    assertEquals(200, point);
  }
```

10개의 쓰레드가 각각 데이터를 읽어와서, 값을 현재 값 + 100 으로 업데이트합니다. 위의 경우에는 10개가 모두 100 -> 200 으로 업데이트를 수행하므로, 최종 결과는 200 이 됩니다.
<br><span>
트랜잭션을 사용하지 않있기에, ***Lost Update***(두 개 이상의 스레드가 동일한 레코드를 동시에 읽고 수정하려고 할 때, 어떤 스레드의 업데이트가 다른 스레드의 작업에 의해 덮어쓰여지는 현상)이 발생합니다.

## IsolationLevel 이 Repeatable Read 인 경우

```java

    @DisplayName("repeatable read 트랜잭션을 사용하는 경우에는 값이 덮어 씌워질 것이다.")
    @Test
    void testAddPointWithDefaultTransaction() throws InterruptedException {
        final int threadNumber = 10;
        final long inputPoint = 100L;
        ExecutorService executorService = Executors.newFixedThreadPool(10);
        CountDownLatch latch = new CountDownLatch(threadNumber);
        for (int i = 0; i < threadNumber; i++) {
            executorService.execute(() -> {
                pocketService.addPointWithRepeatableReadTransaction(1L, inputPoint);
                var point = pocketService.findTotalPocketPointByUserId(1L);
                logger.info("point: {}", point);
                latch.countDown();
            });
        }
        latch.await();
        executorService.shutdown();
        var point = pocketService.findTotalPocketPointByUserId(1L);
        assertEquals(200, point);
    }

```

트랜잭션 격리 수준이 Repeatable Read 인 경우에도, Lost Update 현상이 발생합니다. 각각의 트랜잭션이 시작된 시점(100) 에서 100 을 더하고, 그 결과를 차례대로 업데이트하고, 커밋하기 때문입니다.
<br><span>
따라서, 10번의 update 가 발생하고, 결과적으로 단 하나의 업데이트만 반영된 상태가 됩니다.

## IsolationLevel 이 Serializable 인 경우

```java

    @DisplayName("트랜잭션 Isolation 이 Serializable 인 경우, DeadLock 이 발생한다.")
    @Test
    void testAddPointWithSerializeTransaction() throws InterruptedException {
        final int threadNumber = 10;
        final long inputPoint = 100L;
        ExecutorService executorService = Executors.newFixedThreadPool(10);
        CountDownLatch latch = new CountDownLatch(threadNumber);
        for (int i = 0; i < threadNumber; i++) {
            executorService.execute(() -> {
                // CannotAcquireLockException 발생
                try {
                    pocketService.addPointWithSerializeTransaction(1L, inputPoint);
                } catch (Exception e) {
                    logger.error(e.getMessage());
                }
                latch.countDown();
            });
        }
        executorService.shutdown();
        latch.await();
    }

```

```log

2024-03-18T20:07:43.817+09:00 ERROR 16900 --- [transaction-lock-test-pjt] [pool-2-thread-6] c.e.t.service.PocketServiceTest          : could not execute statement [Deadlock found when trying to get lock; try restarting transaction] [update pocket set point=?,user_id=? where pocket_id=?]; SQL [update pocket set point=?,user_id=? where pocket_id=?]

```

데드락이 발생합니다. Serializable 격리 수준에서는 트랜잭션이 완전히 직렬화되어 실행되는 것처럼 동작합니다. 즉, 동시에 실행되는 트랜잭션들이 서로 간섭하지 않고 차례대로 실행되는 것과 같은 효과를 내도록 잠금(Lock)이 획득됩니다.
<br><span>
이렇게 트랜잭션들이 서로 방해받지 않고 실행되기 위해서는 많은 잠금이 필요합니다. 이때 두 개 이상의 트랜잭션이 서로 다른 순서로 잠금을 획득하려고 하면 데드락 상황이 발생할 수 있습니다.
<br><span>
예를 들어, 트랜잭션 A가 레코드 X에 대한 잠금을 획득하고, 트랜잭션 B가 레코드 Y에 대한 잠금을 획득했다고 가정해봅시다. 그리고 A는 Y에 대한 잠금을, B는 X에 대한 잠금을 요청하면 서로 대기 상태에 빠지게 됩니다. 이렇게 되면 둘 다 서로의 잠금 해제를 기다리는 상황이 되어 데드락에 빠지게 됩니다.
<br><span>
따라서 Serializable 격리 수준에서는 동시에 실행되는 트랜잭션 수가 많을수록 데드락 발생 가능성이 높아집니다. 잠금 순서를 정해두거나 타임아웃을 설정하는 등의 전략을 사용하여 데드락 발생을 최소화할 수 있습니다.

## 결론

트랜잭션이 없는 경우, repeatable_read 인 경우, serializable 인 경우를 각각 살펴봤습니다. 이러한 동시성 이슈를 해결하기 위해서는 어떻게 해야 할까요? 락을 활용하는 방법을 통해서 동시성 이슈를 해결해보겠습니다.
