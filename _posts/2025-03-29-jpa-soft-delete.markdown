---
layout: post
title: "JPA 가 내 참조 관계를 지웠다."
date: 2025-03-29 15:29:01 +0900
categories: [ 경험, JPA ]
---

---

# JPA 가 내 참조 관계를 지웠다.

## 배경

새로운 서비스를 런칭하면서, 운영의 이점을 위해서 soft delete 를 적용했습니다. 그리고 며칠 간 이상 없이 운영되는 것 처럼 보였으나, 고객의 요구로 삭제된 데이터를 확인해야할 일이 발생했습니다.
<br/> 소프트 딜리트의 적용을 믿고 자신 있게 데이터를 확인했는데, 데이터는 남아 있으나 연관관계가 끊어져 있다는 사실을 발견했습니다. 다행히(?) DB 백업을 해둔 덕에 원본 데이터는 확인할 수 있었으나 문제의 원인을 정확히 파악해야 할 필요성을 느꼈습니다.

## Soft Delete

JPA 에서 Soft Delete 를 사용하기 위해서는 다음과 같은 어노테이션을 사용합니다.

> @SQLDelete(sql = "UPDATE orders SET deleted_at = NOW() WHERE id = ?")
> <br/> @SQLRestriction("deleted_at is NULL")

SQL Delete 어노테이션을 사용해서, JPA 의 delete 가 DB 에 반영되는 쿼리를 업데이트 쿼리로 변경할 수 있고, SQL Restriction 을 사용해서 엔터티를 조회할 때 묵시적인 제약을 걸 수 있습니다.
<br/> 실제 운영 환경에서는 다음과 같은 형태로 사용되고 있었습니다.이해를 돕기 위한 코드이며 [다음과 같은 레포](https://github.com/seonb2n/hibernate-soft-delete)에 올려두었습니다.


```kotlin



@Entity
@Table(name = "orders")
@SQLDelete(sql = "UPDATE orders SET deleted_at = NOW() WHERE id = ?")
@SQLRestriction("deleted_at is NULL")
data class Order(
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  val id: Long? = null,

  val orderNumber: String,

  @OneToOne
  @JoinColumn(name = "review_id", nullable = true)
  var review: Review? = null,

  @Column(name = "created_at")
  val createdAt: LocalDateTime = LocalDateTime.now(),

  @Column(name = "updated_at")
  var updatedAt: LocalDateTime = LocalDateTime.now(),

  @Column(name = "deleted_at")
  var deletedAt: LocalDateTime? = null
)


@Entity
@Table(name = "reviews")
@SQLDelete(sql = "UPDATE reviews SET deleted_at = NOW() WHERE id = ?")
@SQLRestriction("deleted_at is NULL")
data class Review(
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  val id: Long? = null,

  val content: String,

  val rating: Int,

  @Column(name = "created_at")
  val createdAt: LocalDateTime = LocalDateTime.now(),

  @Column(name = "updated_at")
  var updatedAt: LocalDateTime = LocalDateTime.now(),

  @Column(name = "deleted_at")
  var deletedAt: LocalDateTime? = null
)


fun deleteReviewFirst(orderId: Long, reviewId: Long) {
  reviewRepository.deleteById(reviewId)
  orderRepository.deleteById(orderId)
}

```

주문을 하고 나면, 주문의 결과로 리뷰를 작성하고 날지는 optional 하게 사용자가 선택할 수 있습니다. 이런 상황에서, 주문을 지우기 위해서 위와 같은 메서드를 호출해서 주문에 딸린 review 를 먼저 삭제하고 order 를 삭제하는 경우에, order 의 review_id 필드가 null 로 변했습니다.

```kotlin


@Test
fun testDeleteReviewFirst() {
  logger.info("==== DeleteReviewFirst 테스트 ====")
  // 삭제 전 상태 확인
  val orderBefore = testOrderService.getOrderById(orderId)
  val reviewBefore = testOrderService.getReviewById(reviewId)
  logger.info("삭제 전 Order: ${orderBefore.id}, reviewId: ${orderBefore.review?.id}")
  logger.info("삭제 전 Review: ${reviewBefore.id}")

  // Review를 먼저 삭제하고 Order 삭제
  logger.info("Review 먼저 삭제 후 Order 삭제 실행")
  testOrderService.deleteReviewFirst(orderId, reviewId)

  // 영속성 컨텍스트 초기화
  entityManager.flush()
  entityManager.clear()

  // 네이티브 쿼리로 Order의 review_id 확인
  val reviewIdResult = entityManager.createNativeQuery(
    "SELECT review_id FROM orders WHERE id = :orderId"
  ).setParameter("orderId", orderId).resultList

  val reviewId = if (reviewIdResult.isNotEmpty()) reviewIdResult[0] else "null"
  logger.info("Order(id=$orderId)의 review_id: $reviewId")

  // 삭제된 Review 데이터 확인
  val deletedReviewResult = entityManager.createNativeQuery(
    "SELECT id, content, rating, deleted_at FROM reviews WHERE id = :reviewId"
  ).setParameter("reviewId", reviewId).resultList

  logger.info("Review(id=$reviewId) 삭제 상태: ${deletedReviewResult.isNotEmpty()}")
  if (deletedReviewResult.isNotEmpty()) {
    val review = deletedReviewResult[0]
    logger.info("삭제된 Review 정보: $review")
  }
}

```

```shell


    /* update
        for org.example.testonetoone.domain.Order */update orders
    set
        created_at=?,
        deleted_at=?,
        order_number=?,
        review_id=?,
        updated_at=?
    where
        id=?

2025-03-29T15:01:19.441+09:00  INFO 22148 --- [test-one-to-one] [    Test worker] o.e.t.service.TestOrderServiceTest       : Order(id=17)의 review_id: null

```

**테스트 코드를 통해서 delete 메서드가 호추되는 경우에 review_id 필드가 null 로 변하는 것을 확인할 수 있다.**

## 문제의 원인

문제의 원인을 파악하기 위해서는 soft delete 의 작동이 단순히 DELETE 쿼리를 UPDATE 쿼리로 대체하는 것에 불과하다는 것을 알아야 합니다. Hibernate 의 내부 동작이 연관관계를 처리하는 방식에 있어서 해당 어노테이션은 아무런 영향을 미치지 못합니다.
<br/> 그렇다면 내부 동작이 어떻게 되어 있길래 연관 관계에 있는 엔터티의 참조 필드를 null 로 처리할까요? 이를 위해서 hibernate 의 코드를 직접 살펴봤습니다.


### DefaultDeleteEventListener

hibernate 에는 DefaultDeleteEventListener 라는 클래스가 있습니다.

![Desktop View](/assets/img/2025-03-29/img-01.png){: width="972" height="589" }

설명을 보면 알 수 있듯이, entity 에 대한 delete 이벤트가 일어났을 때 호출되는 이벤트 listener 입니다. 이 listener 의 작동 부분을 살펴봅시다.

![Desktop View](/assets/img/2025-03-29/img-02.png){: width="972" height="589" }
![Desktop View](/assets/img/2025-03-29/img-03.png){: width="972" height="589" }
![Desktop View](/assets/img/2025-03-29/img-04.png){: width="972" height="589" }

타고 들어가면 결국 deleteEntity 라는 메서드가 있는 것을 발견할 수 있습니다. deleteEntity 는 다음과 같이 구현되어 있습니다.

```kotlin


/**
 * Perform the entity deletion.  Well, as with most operations, does not
 * really perform it; just schedules an action/execution with the
 * {@link org.hibernate.engine.spi.ActionQueue} for execution during flush.
 *
 * @param session The originating session
 * @param entity The entity to delete
 * @param entityEntry The entity's entry in the {@link PersistenceContext}
 * @param isCascadeDeleteEnabled Is delete cascading enabled?
 * @param persister The entity persister.
 * @param transientEntities A cache of already deleted entities.
 */
protected final void deleteEntity(
  final EventSource session,
final Object entity,
final EntityEntry entityEntry,
final boolean isCascadeDeleteEnabled,
final boolean isOrphanRemovalBeforeUpdates,
final EntityPersister persister,
final DeleteContext transientEntities) {

  if ( LOG.isTraceEnabled() ) {
    LOG.trace( "Deleting " + infoString( persister, entityEntry.getId(), session.getFactory() ) );
  }

  final PersistenceContext persistenceContext = session.getPersistenceContextInternal();
  final Object version = entityEntry.getVersion();

  final Object[] currentState = entityEntry.getLoadedState() == null
  ? persister.getValues(entity) //i.e. the entity came in from update()
  : entityEntry.getLoadedState();

  final Object[] deletedState = createDeletedState( persister, entity, currentState, session );
  entityEntry.setDeletedState( deletedState );

  session.getInterceptor().onRemove(
    entity,
    entityEntry.getId(),
    deletedState,
    persister.getPropertyNames(),
    persister.getPropertyTypes()
  );

  // before any callbacks, etc., so subdeletions see that this deletion happened first
  persistenceContext.setEntryStatus( entityEntry, Status.DELETED );
  final EntityKey key = session.generateEntityKey( entityEntry.getId(), persister );

  cascadeBeforeDelete( session, persister, entity, transientEntities );

  new ForeignKeys.Nullifier(  entity, true, false, session, persister ) //여기가 우리의 참조 관계를 null 로 만든 곳입니다.
  .nullifyTransientReferences( entityEntry.getDeletedState() );
  new Nullability( session, NullabilityCheckType.DELETE )
  .checkNullability( entityEntry.getDeletedState(), persister );
  persistenceContext.registerNullifiableEntityKey( key );
  ... 생략 ...

```

ForeignKeys.Nullifier를 생성하고 nullifyTransientReferences 메서드를 호출하는 부분을 참고하시면 될 것 같습니다. 이 메서드는 연관된 엔티티들의 외래 키 참조를 null로 설정하여 외래 키 제약 조건 위반을 방지합니다. 해당 메서드에 대한 구현은 다음과 같이 되어 있습니다.

```kotlin


/**
 * Nullify all references to entities that have not yet been inserted in the database, where the foreign key
 * points toward that entity.
 *
 * @param values The entity attribute values
 */
public void nullifyTransientReferences(final Object[] values) {
  final String[] propertyNames = persister.getPropertyNames();
  final Type[] types = persister.getPropertyTypes();
  for ( int i = 0; i < types.length; i++ ) {
  values[i] = nullifyTransientReferences( values[i], propertyNames[i], types[i] );
}
}


```

바로 이 메서드에서 엔터티의 모든 필드를 순회하면서 삭제하려는 엔티티를 참조하는 외래 키를 null 로 설정하고 있습니다.

## 정리

하이버네이트의 연관관계 null 처리 로직을 분석하면 다음과 같습니다.

```kotlin

Session.delete(entity)
  → DefaultDeleteEventListener.onDelete()
    → deletePersistentInstance()
      → delete()
        → deleteEntity()
          → ForeignKeys.Nullifier.nullifyTransientReferences()

```

nullifyTransient() 메서드(코드 전체를 보지 않았지만)는 다음과 같은 원리로 작동합니다:
- 속성이 엔티티 참조인 경우:
  - 참조된 엔티티가 아직 저장되지 않았거나(transient)
  - 삭제 예정인 경우(영속성 컨텍스트에서 DELETED 상태)
  → 해당 참조를 null로 설정

결국 일대일 단방향 관계에서 엔티티 B가 삭제될 때 일어나는 일은 다음과 같은 순서라고 결론을 내릴 수 있습니다.

1. session.delete(b) 호출
2. DefaultDeleteEventListener.onDelete()가 삭제 이벤트 처리
3. deleteEntity() 메서드 실행
4. ForeignKeys.Nullifier가 생성되고 nullifyTransientReferences() 호출
5. 모든 엔티티에 대해 스캔하여 B를 참조하는 외래 키 검색
6. 엔티티 A의 b_id 필드를 null로 설정
7. 변경 사항이 더티 체킹에 의해 추적됨
8. 세션 플러시 시 A 엔티티에 대한 UPDATE 쿼리 실행 (b_id = null)
9. B 엔티티에 대한 DELETE 쿼리 실행

## 결론

JPA 에서 엔터티를 삭제하는 경우에 연관관계의 엔터티를 어떻게 처리하는지 이해도가 부족한 상황에서 작성한 코드가 문제가 됐습니다.
<br/> 이 문제를 해결하려면, 커스텀 삭제 메서드를 구현하거나, @SQLDelete 를 제거해야 할 것 같습니다. 물론, 객체의 삭제 순서를 바꿔서 Order -> review 순서로 삭제하는 방법도 있지만 이런 묵시적인 해결 방법은 미래에 실수를 만들 여지가 있을 것 같습니다.
<br/> 이 게시글을 읽으시는 여러분은 신중하게 soft delete 를 적용하시기를 바라며 마치겠습니다.
