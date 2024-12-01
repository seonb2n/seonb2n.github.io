---
layout: post
title: "테스트 db 를 h2 로 전환해보기"
date: 2024-12-01 18:27:01 +0900
categories: [ 이슈, 테스트 ]
---

---


# 테스트 db 를 postgresql 에서 h2 로 전환해보자

## 베경

현재 회사에서는 테스트 코드의 수행을 위해서 덤프된 postgresql 도커 이미지를 가져오고 있습니다. 매번 테스트를 로컬에서 수행할 때마다 로컬에 테스트용 db 컨테이너를 띄우는 셈입니다.
<br>
이 구조는 미리 준비된 데이터를 바탕으로 테스트를 할 수 있다는 장점이 있지만, 다음과 같은 3가지의 단점이 존재했습니다.

- 경우에 따라서는 덤프된 데이터에 테스트 코드가 의존하고 있습니다.
- 몇백메가 정도의 컨테이너 이미지를 매번 s3 로부터 받아오는 것은 월에 몇십만원 정도의 비용을 발생시키는 일입니다.
- 테스트 수행 전 컨테이너 환경을 구성해야하기에 수행 시간이 오래 걸립니다.

<br>이 문제를 해결해보고자 h2 인메로리 디비를 활용해서 테스트를 구성하는 것을 시도해봤습니다. h2 인메모리 디비를 테스트에 사용하면 다음과 같은 3가지 장점이 있습니다..
- 테스트 실행 전후에 컨테이너를 시작 종료하는 오버헤드가 없습니다.
- CI/CD 파이프라인에서도 손쉽게 사용 가능하며, 빌드 시간이 단축됩니다.
- 셋업이 간단합니다.

## 방법

다음과 같이 테스트 시, testContainer 대신에 h2 를 사용하도록 변경했습니다. 저희는 코어 모듈에 테스팅 컨벤션을 구현하고 모듈 별로 gradle 에서 해당 테스팅 컨벤션 모듈을 상속하고 있기에 코어 모듈만 변경해도 하위 모듈에 설정이 적용됩니다.
```gradle

testImplementation("com.h2database:h2")

```

```yaml

spring:
  datasource:
    url: jdbc:h2:mem:testdb;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE
    driver-class-name: org.h2.Driver
    username: sa
    password:
  jpa:
    database-platform: org.hibernate.dialect.H2Dialect

```
위와 같이 간단한 설정만으로 h2 디비를 사용하도록 해줄 수 있었습니다. 그 후 기존 테스트 코드에서 테스트 컨테이너를 사용하는 부분을 걷어내고 h2 를 사용하도록 아래와 같은 testConfiguration 적용했습니다.

```kotlin

    @Bean
    @Qualifier(Jpa.Startup.DATA_SOURCE_NAME)
    fun startupDataSource(): DataSource {
        return HikariDataSource().apply {
            driverClassName = "org.h2.Driver"
            jdbcUrl = "jdbc:h2:mem:startup_testdb;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE"
            username = "sa"
            password = ""
        }
    }

```

## 제한점

### JSON 타입의 컬럼(성공)

이렇게 설정을 변경한 후, 설레는 마음으로 테스트를 수행했습니다. 테스트의 수행은 실패했습니다. 이유는 간단했는데요, h2 디비가 postgresql  의 json 타입을 지원하지 않기 때문이었습니다.
<br>
이 문제를 해결하기 위해서 JSON 타입인 컬럼을 h2 에서는 TEXt 로 사용하도록 엔티티를 수정했습니다.
```kotlin

@Entity
@Table(name = "foo_table")
class FooEntity(
    // ... 다른 필드들 ...

    @Type(JsonType::class)
    @Column(
        name = "foo_json_column",
        columnDefinition = "#{T(org.springframework.core.env.Profiles).of('test') ? 'TEXT' : 'jsonb'}"
    )
    val fooJson: FooVO,
) : LongPrimaryKeyOffsetEntity()

```

이렇게 해주니 json 컬럼에 대한 호환 문제는 없어졌습니다.
> 위와 같은 컬럼 타입이 지저분하다고 생각되서 차후에 TestJsonColumn 어노테이션을 다음과 같이 추가했습니다.

```kotlin


@Target(AnnotationTarget.FIELD)
@Retention(AnnotationRetention.RUNTIME)
@Type(JsonType::class)
@Column
annotation class TestJsonColumn(
    val name: String,
    // Column 어노테이션의 다른 속성들도 필요한 경우 추가
    val nullable: Boolean = false,
    val unique: Boolean = false,
    val updatable: Boolean = true
)

Component
class TestJsonColumnProcessor : BeanFactoryPostProcessor {
  override fun postProcessBeanFactory(beanFactory: ConfigurableListableBeanFactory) {
    val environment = beanFactory.getBean(Environment::class.java)
    val isTestProfile = environment.activeProfiles.contains("test")

    // 모든 엔티티 클래스를 찾아서 처리
    beanFactory.getBeanNamesForType(Any::class.java)
      .map { beanFactory.getType(it) }
      .filterNotNull()
      .filter { it.isAnnotationPresent(Entity::class.java) }
      .forEach { entityClass ->
        entityClass.declaredFields
          .filter { it.isAnnotationPresent(TestJsonColumn::class.java) }
          .forEach { field ->
            val column = field.getAnnotation(Column::class.java)
            val columnDefinition = if (isTestProfile) "TEXT" else "jsonb"

            // Column 어노테이션의 columnDefinition 값을 동적으로 설정
            val columnField = Column::class.java.getDeclaredField("columnDefinition")
            columnField.isAccessible = true
            columnField.set(column, columnDefinition)
          }
      }
  }
}

```

### Postgresql 에서 사용하는 Json 함수(실패)

이후에 테스트를 수행하니 다음과 같은 에러가 발생했습니다.

```shell

Caused by: org.h2.jdbc.JdbcSQLSyntaxErrorException: Function "jsonb_agg" not found; SQL statement:

```

이 문제를 해결하기 위해서 h2 커스텀 Dialect 를 추가하려고 시도해봤습니다.

```kotlin

class CustomH2Dialect : H2Dialect() {
    init {
        registerColumnType(Types.OTHER, "json")

        // JSON 함수들 등록
        registerFunction(
            "jsonb_agg",
            object : SQLFunctionTemplate(
                StandardBasicTypes.STRING,
                "group_concat(?1)"  // H2의 GROUP_CONCAT을 사용하여 비슷한 동작 구현
            ) {}
        )

        // 필요한 경우 다른 JSON 함수들도 등록
        registerFunction(
            "jsonb_build_object",
            object : SQLFunctionTemplate(
                StandardBasicTypes.STRING,
                "json_object(?1)"
            ) {}
        )

        registerFunction(
            "jsonb_extract_path_text",
            object : SQLFunctionTemplate(
                StandardBasicTypes.STRING,
                "json_extract(?1, ?2)"
            ) {}
        )
    }
}

@Bean
@Qualifier(Jpa.Startup.DATA_SOURCE_NAME)
fun startupDataSource(): DataSource {
  return HikariDataSource().apply {
    driverClassName = "org.h2.Driver"
    jdbcUrl = "jdbc:h2:mem:startup_testdb;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;" +
      "INIT=CREATE ALIAS IF NOT EXISTS json_object FOR \"org.h2.util.json.JSONObject.convert\"\\;" +
      "CREATE ALIAS IF NOT EXISTS json_extract FOR \"org.h2.util.json.JSONObject.extract\"\\;" +
      "CREATE ALIAS IF NOT EXISTS group_concat FOR \"org.h2.aggregate.GroupConcat.group_concat\""
    username = "sa"
    password = ""
  }
}

```
그러나 이 방법은 실패했습니다. 뿐만 아니라, h2 구동 시에, init.sql 로 alias 를 등록하려고 해도 안되더라고요.
이 방법에 대해서는 향후 해결법을 찾으면 공유하겠습니다

## 결론

h2 로 테스팅을 할 수 있는 환경을 구축하는 것은 장점들이 있지만, json 을 사용하거나 특정 db 에 종속된 dialect 를 사용하는 경우엔 호환이 잘 안될 수 있습니다.
사실 전환하기 전부터 json 쪽이 문제가 생길 것을 예측했는데 확실히 해당 부분이 허들이 되는 것 같습니다.
만약 json 을 rdb 에서 사용하기 않는다면 h2 로의 전환을 고려하기에 더 좋을 것 같습니다.
