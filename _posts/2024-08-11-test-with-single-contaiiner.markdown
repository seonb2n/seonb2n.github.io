---
layout: post
title: "테스트 싱글 컨테이너 개선기"
date: 2024-08-11 16:28:01 +0900
categories: [ Spring ]
---

# 테스트 싱글 컨테이너 개선기

사이드 프로젝트를 하면서, 테스트 컨테이너를 싱글로 띄우는 형식으로 변경한 경험을 공유하고자 합니다.

<br>사용중인 주요 기술 스택은 다음과 같습니다.

> Kotlin, Spring Boot, Kotest, MongoDB, TestContainer, Coroutine

## AS IS : 테스크 클래스 별 MongoDB Container 생성

```kotlin

@ExperimentalCoroutinesApi
@DataMongoTest
internal class ProjectCommentRepositoryUnitTest(
  @Autowired private val template: ReactiveMongoTemplate
) : DescribeSpec({

  isolationMode = IsolationMode.InstancePerLeaf

  val testDispatcher = StandardTestDispatcher()

  val factory = ReactiveMongoRepositoryFactory(template)

  beforeSpec {
    ... 생략 ...
  }

  afterSpec {
    Dispatchers.resetMain()
    ... 생략 ...
  }

  describe("doSomething()") {
    ... 생략 ...
  }

  ... 생략 ...
}) {
  companion object {
    @Container
    val mongoDBContainer = MongoDBContainer("mongo:latest").apply {
      withExposedPorts(27017)
      start()
    }

    init {
      System.setProperty(
        "spring.data.mongodb.uri",
        "mongodb://localhost:${mongoDBContainer.getMappedPort(27017)}/test"
      )
    }
  }
}

```

기존의 Repository Layer 에 대한 Slice test 코드는 위와 같은 형식으로 작성됐습니다. 테스트를 위해서는 MongoDB 컨테이너를 각 class 별로 생성하고, 테스트가 종료된 후 삭제하는 형식이었습니다.
<br><span> 당연하게도, 테스트 시작 전에 컨테이너를 생성하는 무거운 작업이 선행되어야 했고, 이는 테스트 주도 개발에 있어서 분명 병목 지점이었습니다.

![Desktop View](/assets/img/2024-08-11/2024-08-11-01.png){: width="972" height="589" }

테스트 수행 중간에 화면을 캡쳐한 이미지입니다. 해당 이미지를 보시면 수 많은 몽고 DB 컨테이너가 떠 있는 것을 확인할 수 있습니다. 이 부분을 개선하기로 결정했고, 단일 MongoDB 컨테이너를 모든 Slice Test 에서 사용할 수 있도록 변경했습니다.

## TO BE : 전체 테스트 패키지 내에 단일 컨테이너로 테스트 수행

저의 목표는 1개의 단일 repository 에 대해서만 테스트를 수행하든, 10개의 클래스에 대해서 테스트를 수행하든, 전체 테스트 패키지의 테스트 코드를 수행하든 1개의 MongoDB Container 만 생성해서 사용하는 것이었습니다.

<br><span> 이 문제를 해결하기 위해서 저는 MongoDB 를 사용하는 테스트 클래스에서 사용할 Base Class 를 만들었습니다.

```kotlin

@DataMongoTest
@Testcontainers
abstract class BaseMongoDBTest(body: DescribeSpec.() -> Unit = {}) : DescribeSpec(body) {
    companion object {
        @Container
        val mongoDBContainer = MongoDBContainer("mongo:latest").apply {
            withExposedPorts(27017)
            start()
        }

        init {
            System.setProperty(
                "spring.data.mongodb.uri",
                "mongodb://localhost:${mongoDBContainer.getMappedPort(27017)}/test"
            )
        }
    }

    init {
        isolationMode = IsolationMode.InstancePerLeaf
    }
}


```

DescribeSpec 을 상속하는 이 abstract 클래스는 MongoDB 컨테이너를 싱글톤으로 생성하는 역할을 합니다. companion object는 클래스의 모든 인스턴스에서 공유되는 객체를 정의합니다. 즉, BaseMongoDBTest 클래스를 상속받는 모든 테스트 클래스가 동일한 companion object를 사용하기 때문에 MongoDBContainer도 오직 하나만 생성됩니다.

![Desktop View](/assets/img/2024-08-11/2024-08-11-02.png){: width="972" height="589" }

테스트를 수행하면 MongoDB 컨테이너가 1개만 존재하는 것을 확인할 수 있습니다. **약 20% 의 테스트 수행 시간과 10% 이상 CPU 와 메모리 사용량**을 줄였으니 동료 개발자들의 개발 생산성 향상에 도움이 된 것 같습니다.
