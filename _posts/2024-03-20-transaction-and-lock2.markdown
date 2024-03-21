---
layout: post
title: "동시성 이슈와 트랜잭션 격리수준과 락2"
date: 2024-03-20 20:33:01 +0900
categories: [ Database ]
---

# 락을 활용한 동시성 이슈를 해결해보려고 합니다.

락을 활용해서 멀티 쓰레드 환경에서 발생할 수 있는 동시성 이슈를 해결해보고자 합니다.
<br>
실험 환경은 다음과 같습니다.

| 환경          | 버전    |
|-------------|-------|
| MySQL       | 8.2.0 |
| Spring Boot | 3.2.3 |
| Java        | 17    |

<br>
한 개의 레코드에 대해서, 동시에 10 개의 쓰레드가 접근해서 업데이트하는 시나리오를 생각해보겠습니다.

## 낙관락을 활용하는 경우

낙관락은 말 그대로 트랜잭션이 충돌하지 않을 것이라 가정하는 방법입니다. Jpa 를 사용하는 경우, @Version 어노테이션을 활용하여 엔티티의 버전을 관리합니다.

```java

@Entity
public class Pocket {

  @Id
  @GeneratedValue
  private Long pocketId;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "user_id")
  private User user;

  private Long point;

  @Version
  private Integer version;

  public Long addPoint(Long inputPoint) {
    this.point = this.point + inputPoint;
    return this.point;
  }

  protected Pocket() {
  }

  @Builder
  public Pocket(Long pocketId, User user, Long point) {
    this.pocketId = pocketId;
    this.user = user;
    this.point = point;
    this.version = 1;
  }
}

```

Entity 클래스를 위와 같이 구현하면 낙관락을 사용할 수 있습니다. queryDSL 을 사용한다면 낙관락의 사용을 명시적으로 지정할 수 있습니다.

```java

// repository Layer
@Override
public Optional<Pocket> findUserPocketWithOptimisticLock(Long pocketId){
  QPocket pocket=QPocket.pocket;
  return Optional.ofNullable(queryFactory.selectFrom(pocket)
  .where(pocket.pocketId.eq(pocketId))
  .setLockMode(LockModeType.OPTIMISTIC)
  .fetchFirst()
  );
  }

// service Layer
@Transactional
public void addPointWithOptimisticLock(Long pocketId,Long point){
  Pocket pocket=pocketRepository.findUserPocketWithOptimisticLock(pocketId).orElseThrow();
  pocket.addPoint(point);
  }
```

위의 메서드는 어떤 쿼리로 실행될까요? 아마 이러한 쿼리로 업데이트가 발생할 것입니다.

```sql

UPDATE pocket
set point   = ?,
    version = ? # 버전 + 1 증가
where
  id = ?
  and version = ? # 기존 버전과 비교

```

레코드의 업데이트를 수행하며 버전을 확인할 것입니다. 그렇다면 낙관락으로 1 개의 레코드를 동시에 10개의 쓰레드가 업데이트하고자 한다면 어떻게 될까요?
<br>
ObjectOptimisticLockingFailureException 이 발생하면서 최초 1개의 트랜잭션을 제외한 나머지 트랜잭션은 롤백처리될 것입니다.

## 비관락을 활용하는 경우

비관락은 데이터베이스의 락을 사용하여 동시성을 제어합니다. SELECT ... FOR UPDATE 구문을 사용합니다. QueryDSL 을 활용한다면 다음과 같은 코드로 작성될 수
있습니다.

```java

@Override
public Optional<Pocket> findUserPocketWithPessimisticLock(Long pocketId){
  QPocket pocket=QPocket.pocket;
  return Optional.ofNullable(queryFactory.selectFrom(pocket)
  .where(pocket.pocketId.eq(pocketId))
  .setLockMode(LockModeType.PESSIMISTIC_WRITE)
  .fetchFirst());
  }

```

그런데, LockModeType 이 PESSIMISTIC 이 아니라, PESSIMISTIC_WRITE 입니다. LockModeType enum 을 확인해보면 다음과 같습니다.

```java

public enum LockModeType {
  /**
   * 생략..
   */

  /**
   *
   * Pessimistic read lock.
   *
   * @since 2.0
   */
  PESSIMISTIC_READ,

  /**
   * Pessimistic write lock.
   *
   * @since 2.0
   */
  PESSIMISTIC_WRITE,

  /**
   * Pessimistic write lock, with version update.
   *
   * @since 2.0
   */
  PESSIMISTIC_FORCE_INCREMENT,
}

```

무슨 차이일까요?

- PESSIMISTIC_WRITE 는 일반적인 비관적 락을 의미합니다. 데이터베이스에 SELECT FOR UPDATE 를 사용하여 배타락을 겁니다. NON-REPEATABLE
  READ 를 방지합니다. 다른 트랜잭션에서 읽기, 쓰기가 모두 불가능합니다.
- PESSIMISTIC_READ 는 데이터를 읽기만 하고 수정하지 않을 때 사용합니다. 다른 트랜잭션에서 읽기는 가능합니다.
- PESSIMISTIC_FORCE_INCREMENT 는 비관적 락이지만 버전 정보를 증가시킵니다.

```java

@DisplayName("비관락을 활용하는 경우, 순차적으로 연산이 수행된다.")
@Test
public void testAddPointWithPessimisticLock()throws Exception{
final int threadNumber=10;
final long inputPoint=100L;
  ExecutorService executorService=Executors.newFixedThreadPool(10);
  CountDownLatch latch=new CountDownLatch(threadNumber);
  for(int i=0;i<threadNumber; i++){
  executorService.execute(()->{
  pocketService.addPointWithPessimisticLock(1L,inputPoint);
  var point=pocketService.findTotalPocketPointByUserId(1L);
  logger.info("point: {}",point);
  latch.countDown();
  });
  }
  executorService.shutdown();
  latch.await();
  assertEquals(1000,point);
  }

```

비관적락을 활용하여 10개의 쓰레드가 동시에 1개의 레코드에 업데이트를 수행하겠습니다. 그 결과는 순차적인 실행으로 총 결과는 1000원이 됩니다.

## 결론

동시성 문제를 해결하기 위한 Lock 을 정리해봤습니다. <br>
어떤 레코드에 대해서 동시성 이슈가 발생할 가능성이 높다면 비관적 락을 활용해야 하지만, 다른 트랜잭션을 대기시키기에 데드락 문제를 발생시킬 수 있습니다.
<br>
낙관적 락은 데드락은 발생시키지 않지만 버전이 다른 트랜잭션을 어떻게 처리할지를 고려해야 합니다.
<br>
2008 년
글이지만 [스택오버플로우에서 두 락의 용처에 대한 응답](https://stackoverflow.com/questions/129329/optimistic-vs-pessimistic-locking)
이 있습니다. 이 글에 따르면, 낙관적 락은 가용성을 중시하며 atomic 한 트랜잭션을 위해서 사용하며, 비관적 락은 엄중하게 일관성 있는 트랜잭션의 수행을 위해서 사용한다고 합니다.
<br>
읽어보시기를 권해드립니다.

> 예제 코드는 여기서 확인하실 수 있습니다.
> https://github.com/seonb2n/transaction-lock-test
