---
layout: post
title: "JPA에서 엔티티의 영속화(Persistence) 생명주기"
date: 2024-04-26 22:00:01 +0900
categories: [ JPA ]
---

# JPA에서 엔티티의 영속화(Persistence) 단계

## 엔티티의 생명주기

JPA에서 엔티티는 총 4가지 상태를 가집니다.

- New/Transient(비영속): 영속화되지 않은 상태로, 데이터베이스에 저장되지 않은 객체입니다.
- Persistent/Managed(영속): 영속 컨텍스트에 관리되는 상태로, 데이터베이스에 저장되었거나 저장될 예정인 객체입니다.
- Detached(준영속): 영속 컨텍스트에서 분리된 상태로, 영속성이 유실된 객체입니다.
- Removed(삭제): 영속 컨텍스트에서 관리되던 객체가 삭제된 상태입니다.

### 비영속

순수한 객체 상태로 엔티티 객체가 생성되면 비영속 상태입니다.

```java

Member member=new Member();
  member.setId(1);

```

### 영속

엔티티 매니저를 통해서 엔티티를 영속성 컨텍스트에 저장한 상태입니다.

```java

em.persist(member);

```

영속 성태라는 것은 영속성 컨텍스트에 의해서 관리된다는 뜻입니다.

### 준영속

영속성 컨텍스트와 분리된 상태입니다.

```java

em.detach(member);

```

### 삭제

```java

em.remove(member);

```

엔티티를 영속성 컨텍스트와 db에서 삭제합니다. 이는 JPA의 트랜잭션 내에서 이루어지며, 트랜잭션을 커밋할 때 영속성 컨텍스트의 변경 사항이 데이터베이스에 반영됩니다. 따라서
em.remove()를 호출한 후에는 해당 엔티티가 영속성 컨텍스트와 데이터베이스에서 모두 삭제됩니다.

## 영속화 프로세스

엔티티를 영속화하는 프로세스는 다음과 같습니다.

- 영속화(persist): EntityManager의 persist() 메서드를 사용하여 엔티티를 영속화합니다. 이 때, 엔티티의 상태는 영속 상태가 됩니다.
- 검색(find) 및 조회(getReference): 데이터베이스에서 엔티티를 검색하거나, 이미 영속 컨텍스트에 있는 엔티티를 조회합니다. 검색된 엔티티는 영속 상태가 됩니다.
- 병합(merge): 준영속 상태의 엔티티를 영속 상태로 만들기 위해 merge() 메서드를 사용합니다.
- 삭제(remove): 영속 상태의 엔티티를 삭제하기 위해 remove() 메서드를 사용합니다.

## Flush

플러시(Flush)는 JPA에서 영속성 컨텍스트의 변경 내용을 데이터베이스에 동기화하는 작업을 말합니다. 즉, 영속성 컨텍스트의 변경 사항을 데이터베이스에 반영하는 과정입니다.
일반적으로는 트랜잭션이 커밋될 때 자동으로 플러시가 발생하지만, 명시적으로 플러시를 호출할 수도 있습니다.
<br>
플러시는 다음과 같은 경우에 자동으로 발생합니다.

1. 트랜잭션 커밋: 트랜잭션을 커밋할 때 영속성 컨텍스트의 변경 내용이 데이터베이스에 반영됩니다. 이때 자동으로 플러시가 발생합니다.
2. JPQL 쿼리 실행: JPQL 쿼리를 실행할 때마다 영속성 컨텍스트와 데이터베이스의 동기화를 위해 플러시가 발생합니다.
3. 직접 플러시 호출: EntityManager의 flush() 메서드를 호출하여 명시적으로 플러시를 실행할 수 있습니다.

## 준영속

준영속(detached) 상태는 JPA에서 엔티티가 영속성 컨텍스트와의 연관성을 잃은 상태를 말합니다. 이 상태에서는 영속성 컨텍스트가 해당 엔티티를 더 이상 관리하지 않습니다.
일반적으로는 영속성 컨텍스트에서 분리된 이후의 상태를 말하며, 다음과 같은 경우에 발생합니다.

1. em.clear() 로 영속성 컨텍스트를 완전히 초기화할 때
2. em.detach() 로 엔티티를 명시적으로 분리할 때
3. em.close() 로 엔티티 매니저를 닫을 때

em.clear() 를 호출하면 영속성 컨텍스트를 제거하고 새로 만든 것과 같다.

## 병합

병합(Merge)은 JPA에서 영속성 컨텍스트에 없는 엔티티를 영속성 컨텍스트에 추가하거나, 준영속 상태의 엔티티를 영속성 컨텍스트에 다시 합치는 작업을 말합니다. 주로 영속성
컨텍스트와의 연관성을 다시 맺거나 엔티티의 상태를 복원할 때 사용됩니다.

```java

// 엔티티 매니저 생성
EntityManager entityManager = entityManagerFactory.createEntityManager();

Member member = entityManager.find(Member.class, memberId);

// 준영속 상태로 엔티티를 변경
entityManager.close();


// 엔티티의 값을 변경
member.setName("New Name");
member.setEmail("newemail@example.com");

// 트랜잭션 커밋 이전에 병합 수행
Member mergedMember = entityManager.merge(member);

// 트랜잭션 커밋
transaction.commit();

```

위의 코드처럼, 준영속 상태인 엔티티의 값을 변경한 후에 병합(merge)을 수행하면 변경된 값이 데이터베이스에 반영됩니다.
병합 작업은 준영속 상태의 엔티티를 영속 상태로 만들어주는 과정이기 때문에, 변경된 값이 병합된 엔티티에 반영됩니다. 그리고 이후에 영속성 컨텍스트를 플러시하고 트랜잭션을 커밋하면 변경된 값이 데이터베이스에 반영됩니다.

## 엔티티 매니저와 동시성

엔티티 매니저는 엔티티 매니저 팩토리를 통해서 생성할 수 있습니다.

```java

EntityManager em = emf.createEntityManager();

```

엔티티 매니저 팩토리는 여러 스레드가 동시에 접근해도 안전하지만, 엔티티 매니저는 여러 스레드가 동시에 접근하면 동시성 문제가 발생합니다.
[redhat 에서 작성된 entity manager and transaction scopes](https://access.redhat.com/documentation/zh-cn/jboss_enterprise_application_platform/5/html/hibernate_entity_manager_reference_guide/transactions) 라는 글을 참고해보자.
<br>

이 글에 따르면, 엔티티 매니저는 저렴하지만 쓰레드 세이프 하지 못하기에 하나의 비즈니스 과정에서만 사용되고, 그 이후에 버려져야 한다고 합니다. 엔티티 매니저를 생성한다고 즉시 JDBC 연결을 맺는 것은 아니기에, 특정 요청에 대해서 필요할 수 도 있는 경우에는 일단 생성해줘도 괜찮다고 합니다.
<br>
따라서, 엔티티 매니저는 트랜잭션 단위로 사용하는 것을 권장하며, 해당 원칙을 지키지 않은 경우 발생할 수 있는 동시성 이슈에 대한 부분이 나옵니다.
1. EntityManager는 스레드 안전하지 않으므로, 동시에 작동해야 하는 환경에서는 EntityManager 인스턴스를 공유하면 경합(race) 조건이 발생할 수 있음.
2. EntityManager에서 발생하는 예외는 데이터베이스 트랜잭션을 롤백하고 EntityManager를 즉시 닫아야 함. 응용 프로그램에서 EntityManager를 바인딩하고 있는 경우, 응용 프로그램을 중지해야 함.
3. 영속성 컨텍스트는 관리 상태에 있는 모든 객체를 캐시하므로, 오랫동안 열어두거나 많은 데이터를로드하는 경우 OutOfMemoryException을 발생시킬 수 있음. Stale data(잘못된 데이터) 발생 가능성도 있으므로 주의해야 함.
