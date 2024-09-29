---
layout: post
title: "다중 데이터베이스 환경에서 더티체킹이 발생하지 않았다."
date: 2024-09-29 15:09:01 +0900
categories: [ JPA ]
---

# 다중 데이터베이스 환경에서 더티체킹이 발생하지 않았다.

최근 Spring Boot와 JPA를 사용하는 다중 데이터베이스 환경에서 흥미로운 문제를 겪었습니다. JPA의 더티 체킹(dirty checking)이 제대로 동작하지 않아 엔티티의 변경사항이 데이터베이스에 반영되지 않는 현상이 발생했죠. 이 글에서는 문제의 원인과 해결 과정을 공유하고자 합니다.

## 문제 상황
우리 프로젝트는 두 개의 데이터베이스(A와 B)를 사용하고 있었습니다. User 엔티티는 B 데이터베이스에 속해 있었고, 다음과 같은 코드로 사용자 정보를 업데이트하고 있었습니다

```kotlin

@Service
class UserService(private val userRepository: UserRepository) {

    @Transactional
    fun updateUser(user: User) {
        val foundUser = userRepository.findByUuid(user.uuid)
        foundUser?.let {
            it.fullName = user.fullName
            it.email = user.email
            // userRepository.save(it) // 이 라인은 없었습니다.
        }
    }
}

```

하지만 이 코드를 실행해도 데이터베이스에는 아무런 변화가 없었습니다. JPA의 더티 체킹이 작동하지 않아서 select 쿼리만 발생하고, update 쿼리가 발생하지 않는 것이었습니다.

## 원인 분석

문제의 원인을 파악하기에 앞서 가장 먼저 user 가 정상적으로 영속성 컨텍스트에 속해있는지를 확인했습니다.

```kotlin

entityManager.contains(foundUser)

```

그러나 이 코드는 illegalArgumentException 을 발생시켰고, user 가 영속성 컨텍스트에 속하지 못하고 있다는 점을 바탕으로 여러가지를 점검했습니다.

- @Transactional 어노테이션이 제대로 적용되어 있는지
- AOP 상 문제가 될 부분은 없는지
- User 엔티티가 JPA 엔티티로 올바르게 정의되어 있는지
- JPA 설정이 올바른지

<br>
모든 것이 정상적으로 보였지만, 여전히 더티 체킹은 작동하지 않았습니다. 그러다 문득 다중 데이터베이스 환경이라는 점이 떠올랐습니다.

## 해결 과정

문제의 핵심은 다중 데이터베이스 환경에서 올바른 트랜잭션 매니저를 사용하지 않았다는 것이었습니다.
<br>
우리의 설정은 다음과 같았습니다

```kotlin

@EnableTransactionManagement
@EnableJpaRepositories(
entityManagerFactoryRef = "bEntityManagerFactory",
transactionManagerRef = "bTransactionManager",
basePackages = ["com.example.project.adapter.persistence.b"],
)
class BDatabaseConfiguration {
// ... (생략) ...

    @Bean
    fun bTransactionManager(@Qualifier("bEntityManagerFactory") entityManagerFactory: EntityManagerFactory): PlatformTransactionManager {
        return JpaTransactionManager(entityManagerFactory)
    }
}

// ... (생략) ...
class ADatabaseConfiguration {

  @Primary
  @Bean
  fun aTransactionManager(@Qualifier("aEntityManagerFactory") entityManagerFactory: EntityManagerFactory): PlatformTransactionManager {
    return JpaTransactionManager(entityManagerFactory)
  }
}

```

각각의 데이터베이스 환경에 따른 별개의 설정과 별갸의 PlatformTransactionManager 를 사용하고 있었습니다.
<br>
구조성 User 엔티티는 B 데이터베이스에 속해 있었지만, 우리는 @Transactional 어노테이션에 어떤 트랜잭션 매니저를 사용할지 명시하지 않았고 service 는 primary 인 aTransactionManager 를 사용했던 것이었습니다.
<br>
따라서 해결책은 간단했습니다. @Transactional 어노테이션에 사용할 트랜잭션 매니저를 명시적으로 지정하는 것이었죠

```kotlin

@Service
class UserService(private val userRepository: UserRepository) {

    @Transactional("bTransactionManager")
    fun updateUser(user: User) {
        val foundUser = userRepository.findByUuid(user.uuid)
        foundUser?.let {
            it.fullName = user.fullName
            it.email = user.email
        }
    }
}

```

이렇게 수정하니 더티 체킹이 정상적으로 동작하기 시작했습니다!


## 깨달음과 결론

1. 다중 데이터소스 환경: 여러 개의 데이터소스가 있을 때, Spring은 어떤 트랜잭션 매니저를 사용해야 할지 혼란스러워할 수 있습니다.
2. 기본 트랜잭션 매니저: @Transactional만 사용하면 Spring은 기본 트랜잭션 매니저를 사용합니다. 우리 경우에는 A 데이터베이스의 트랜잭션 매니저가 기본(@Primary 적용)으로 설정되어 있었습니다.
3. 영속성 컨텍스트 불일치: 잘못된 트랜잭션 매니저를 사용하면, 엔티티가 올바른 영속성 컨텍스트에서 관리되지 않습니다.
4. 트랜잭션 격리: 각 데이터소스는 자체적인 트랜잭션 관리를 합니다. A 데이터베이스의 트랜잭션 매니저에서 시작된 트랜잭션은 B 데이터베이스의 변경사항을 관리할 수 없습니다.

다중 데이터베이스 환경에서 JPA를 사용할 때는 항상 올바른 트랜잭션 매니저를 명시적으로 지정해야 합니다. 이는 @Transactional 어노테이션에 트랜잭션 매니저 이름을 명시함으로써 할 수 있습니다.
