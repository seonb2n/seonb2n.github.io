---
layout: post
title: "Dirties Context"
date: 2024-05-29 21:23:01 +0900
categories: Spring
---

# @Dirties Context 란

Spring 에서 통합 테스트 수행 중, 테스트 간 격리성 확보를 위해 사용할 수 있는 방법 중 하나인 **@DirtiesContext**에 대해서 정리해봤습니다.

## 공식문서 요약

> https://docs.spring.io/spring-framework/reference/testing/annotations/integration-spring/annotation-dirtiescontext.html

@DirtiesContext 는 테스트의 수행 중 오염된 ApplicationContext 를 정리하는 역할을 수행합니다. Spring Container 가 여러 테스트가 수행되는
동안 동일한 설정하에 재조립되게 해줍니다.
<br><span>
@DirtiesContext 는 클래스 레벨과, 메서드 레벨에서 모두 사용이 가능합니다. 만약에 클래스 모드는 BEFORE_EACH_TEST_METHOD 이고, 메서드 모드는
AFTER_METHOD 라면, Context 는 주어진 테스트 메서드의 수행 전 후에 모두 오염처리 될 것입니다.
<br><span>
@DirtiesContext 애노테이션을 @ContextHierarchy와 함께 사용할 때, hierarchyMode 플래그를 사용하면 컨텍스트 캐시를 어떻게 정리할지 제어할 수
있습니다.
<br><span>
기본적으로, 포괄적인 알고리즘이 사용됩니다. 이 알고리즘은 현재 테스트의 컨텍스트뿐만 아니라, 공유된 조상 컨텍스트를 가진 다른 모든 컨텍스트 계층도 정리합니다. 이렇게 하면 공통
조상 컨텍스트의 하위 계층에 있는 모든 ApplicationContext 인스턴스가 컨텍스트 캐시에서 제거되고 닫히게 됩니다.
<br><span>
하지만 이 포괄적인 접근 방식이 과도할 수 있습니다. 이럴 때는 간단한 현재 레벨 알고리즘을 사용할 수 있습니다. 현재 레벨 알고리즘은 테스트가 속한 현재 계층의 컨텍스트만
정리하며, 다른 계층에는 영향을 주지 않습니다.

```java

@ContextHierarchy({
  @ContextConfiguration("/parent-config.xml"),
  @ContextConfiguration("/child-config.xml")
})
class BaseTests {
  // class body...
}

class ExtendedTests extends BaseTests {

  @Test
  @DirtiesContext(hierarchyMode = CURRENT_LEVEL)
  void test() {
    // some logic that results in the child context being dirtied
  }
}

```

## 사용 모드

### MethodMode

- BEFORE_METHOD
- AFTER_METHOD

### ClassMode

- BEFORE_CLASS : 클래스의 테스트가 시작되기 전에 새로운 Context 를 생성
- BEFORE_EACH_TEST_METHOD : 클래스의 모든 테스트 매서드를 실행하기 전에 Context 를 재생성
- AFTER_EACH_TEXT_METHOD : 클래스의 모든 테스트 메서드가 실행된 후에 Context 를 재생성
- AFTER_CLASS (default) : 클래스의 테스가 모두 실행된 후애 새로운 Context 를 재생성

## 단점

DirtiesContext 는 사용하기에 편리하지만, 테스트를 할 때마다 스프링 컨텍스트가 초기화되고 재생성되기에 테스트가 느려집니다. 이 방법을 해결하기 위해서 db 를
초기화하는 방법을 많이 사용합니다. db 를 직접 초기화하는 방법을 사용하는 경우에, 약 10 배 정도의 테스트 수행 시간 개선이 이루어짐을 확인할 수 있습니다.


## 참고

https://sup2is.tistory.com/111

https://newwisdom.tistory.com/95
