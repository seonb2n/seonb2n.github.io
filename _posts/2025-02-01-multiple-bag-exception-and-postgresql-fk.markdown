---
layout: post
title: "MultipleBagException 에서 Postgresql 의 FK 인덱스까지"
date: 2025-02-01 13:16:01 +0900
categories: [ Postgresql ]
---

---

# MultipleBagException 에서 Postgresql 의 FK 인덱스까지

## 개요

MultipleBagException 을 해결하기 위한 여러 방법을 탐색하던 중, 쿼리를 나눠서 해결하는 방법을 채택했습니다. 이 경우에 FK 로 in 절에 대한 쿼리에 대한 성능이 궁금해졌습니다.

<br>

## MultipleBagException

다음과 같은 도메인 구조가 있습니다.

```kotlin

@Entity
class Item(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0L,

    val name: String,

    @OneToMany(mappedBy = "item", cascade = [CascadeType.ALL])
    val options: List<ItemOption> = mutableListOf(),

    @OneToMany(mappedBy = "item", cascade = [CascadeType.ALL])
    val histories: List<ItemHistory> = mutableListOf()
)

@Entity
class ItemOption(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0L,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "item_id")
    val item: Item,

    val optionName: String,
    val price: Int
)

@Entity
class ItemHistory(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0L,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "item_id")
    val item: Item,

    val modifiedAt: LocalDateTime,
    val description: String
)

```

Item 을 조회하면서 연관된 옵션과 이력을 함께 가져오고자 다음과 같은 JPQL 을 작성했습니다.

```kotlin

@Repository
class ItemRepository : JpaRepository<Item, Long> {

    @Query("""
        SELECT i FROM Item i
        JOIN FETCH i.options
        JOIN FETCH i.histories
        WHERE i.id IN :itemIds
    """)
    fun findByIdInWithOptionsAndHistories(itemIds: List<Long>): List<Item>
}

```

위의 코드를 실행하면 이런 에러가 발생합니다.

```kotlin

org.hibernate.loader.MultipleBagFetchException: Cannot simultaneously fetch multiple bags

```

MultipleBagException 에 관해서는 다음과 같은 좋은 글들이 있으니, 본 포스트에서는 다루지 않겠습니다.

> https://pasudo123.tistory.com/473
> https://jojoldu.tistory.com/457

다만 저는 이를 해결하기 위해서 2가지 옵션을 고려했는데요. 첫번재는 쿼리를 분리하는 것이고 두번째는 Set 을 사용하는 것이었습니다.

### BatchSize 의 사용을 고려하지 않은 이유

- 지연 로딩으로 인한 쿼리의 발생 시점을 예측하기 어렵다는 점
- Item 도메인의 특성상 사용처에 따라서 다양한 BatchSize 를 가져야하기에, 획일화되면서 최적화된 Size 의 지정이 불가능하다는 점
- BatchSize 설정으로 인해서 Options 만 필요한 경우에도 histories 도 같이 로딩된다는 점

### Set 을 사용하는 것보다 쿼리를 분리하는 것이 나은 이유

필요한 비즈니스 로직은, item 목록을 조회하면서 연관된 options 와 history 를 모두 가져와야 하는 것이었습니다. Set 을 사용하면 이 경우에 카다시안 곱으로 인해서 조회 대상이 되는 row 가 매우 많아지게 됩니다.
<br> 예를 들어 100 개의 item 에 10 개의 option 과 100 개의 history 가 있다면 100 * 10 * 100 개의 row 가 조회됩니다. Set 을 통해 후처리로 중복 제거를 해줘야하니 추가적인 연산 비용도 들어갑니다.
<br> 반면에 다음과 같이 로직을 구성한다면 단순이 100 + 10 + 100 개의 row 만 조회할 수 있습니다.

```kotlin

      val item = itemRepository.findById(itemId)
      val options = itemRepository.findOptionsByItemId(itemId)
      val histories = itemRepository.findHistoriesByItemId(itemId)

```

그런데, 쿼리를 분리하는 로직으로 작성하는 경우엔 item 을 조립하기 위해서 메모리를 사용해야 한다는 점과, itemId 라는 FK 로 in 절을 수행해야 한다는 점이 걱정됐습니다. 따라서, join 과 fk 의 in 절에 대한 내용을 추가적으로 조사해봤습니다.

## Postgresql 에서의 FK

아시다시피, postgresql 에서는 fk 에 대해서 인덱스를 자동으로 생성해주지 않습니다. 이 점이 mysql 과의 차이점 중 하나인데요. 그 이유가 궁금해서 좀 찾아본 결과 다음과 같은 2 가지 주요 이유로 정리해볼 수 있었습니다.

1. 개발자에게 더 많은 인덱스 생성 제어권을 제공하기 위해서
2. 모든 외래 키가 인덱스를 필요로 하지 않기 때문에

**참고**
> https://www.percona.com/blog/should-i-create-an-index-on-foreign-keys-in-postgresql/
> https://stackoverflow.com/questions/304317/does-mysql-index-foreign-key-columns-automatically
> https://stackoverflow.com/questions/48793071/does-a-postgres-foreign-key-imply-an-index
> https://softwareengineering.stackexchange.com/questions/329051/is-indexing-foreign-keys-a-good-practice

실제로 저의 경험으로 돌이켜봤을 때도, mysql 에서 자동으로 fk 의 인덱스를 만들어주는 것은 양날의 검이었던 것 같습니다.

## 인덱스가 없는 FK

저의 경우에는, itemID 는 fk 지만 인덱스가 없습니다. 따라서 in 절에 대한 쿼리 플랜을 확인해봤는데요.

```sql

-- item 조회
SELECT * FROM item WHERE id IN (1, 2, 3, 4, 5);
-- 인덱스가 PK이므로 Index Scan 사용

-- item_option 조회 (인덱스 없는 FK)
SELECT * FROM item_option WHERE item_id IN (1, 2, 3, 4, 5);
-- Seq Scan 발생
-- item_id에 인덱스가 없어서 전체 테이블을 스캔하면서 조건 체크

-- item_history 조회 (인덱스 없는 FK)
SELECT * FROM item_history WHERE item_id IN (1, 2, 3, 4, 5);
-- 마찬가지로 Seq Scan 발생

```

예상하던 결과입니다. 그러면 in 절과 join 절에 있어서 조회 성능이 유의미한 차이가 발생하는지 확인이 필요할 것 같습니다.

```sql

-- item 테이블에 10000건
-- item_option 테이블에 100000건 (item 당 평균 10개)
-- item_history 테이블에 1000000건 (item 당 평균 100개)

-- 실행 계획 비교를 위한 쿼리
-- Case 1: JOIN 사용
EXPLAIN ANALYZE
SELECT io.*
FROM item_option io
INNER JOIN item i ON io.item_id = i.id
WHERE i.customer_id = 1;

-- Case 2: IN절 사용
EXPLAIN ANALYZE
SELECT *
FROM item_option
WHERE item_id IN (1, 2, 3, ..., 100);

```
다음과 같은 결과가 나옵니다.

```shell

-- Case 1
Nested Loop  (cost=8.45..1325.45 rows=1000 width=40)
  ->  Seq Scan on item  (cost=0.00..25.00 rows=100 width=8)
       Filter: (customer_id = 1)
  ->  Index Scan using idx_item_option_item_id on item_option  (cost=8.45..13.00 rows=10 width=40)
       Index Cond: (item_id = item.id)


-- Case 2

Bitmap Heap Scan on item_option  (cost=5.45..625.45 rows=1000 width=40)
  ->  Bitmap Index Scan on idx_item_option_item_id  (cost=0.00..5.45 rows=1000 width=0)
       Index Cond: (item_id = ANY ('{1,2,3,...,100}'::integer[]))

```

테이블의 사이즈와 조회할 데이터의 규모를 바탕으로 판단했을 때, in 절을 사용하는 편이 메모리의 사용량도 적고 소요 시간도  더 적은 것을 확인할 수 있었습니다. 아무래도 item_option 테이블만 접근한다는 점에서 우위가 있습니다.

## 결론

경우에 따라서 In 절을 사용하는 편이 Join 보다 성능상 우위가 있다. MutipleBagException 이 발생하는 경우에, in 절을 바탕으로 로직을 분리하게끔 코드를 작성하는 옵션도 고려해보자.
