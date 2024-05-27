---
layout: post
title: "코틀린을 돌아보며1"
date: 2024-03-23 18:36:01 +0900
categories: [ Kotlin, Grammar ]
---

# 코틀린을 돌아보자1

코틀린을 마지막으로 한 것이 7개월 전이니, 문법을 다시 한번 정리해보고자 합니다.
<br><span>
![Desktop View](/assets/img/2024-03-23/last-kotlin.png){: width="972" height="589" }

## Open

자바의 클래스에 접근 제한자를 명시하지 않는다면 package-private 로 간주됩니다. 즉, 같은 패키지 내의 다른 클래스들에만 접근이 허용됩니다.
<br><span>
반면, 코틀린에서는 클래스와 메소드가 기본적으로 final 클래스로, 상속을 허용하지 않습니다. 따라서 상속을 허용하기 위해서는 해당 클래스 앞에 open 변경자를 붙여야 합니다.
<br><span>
오버라이드를 허용하고 싶은 메소드나 프로퍼티의 앞에도 open 변경자가 붙어야 오버라이드가 가능합니다.

```kotlin

// open 클래스이므로 상속이 가능
open class Human {

  // 하위 클래스에서 override 불가능
  fun eatSomething(): String {}

  // 하위 클래스에서 override 가능
  open fun walk(): String {}

}

```

그렇다면 abstract 키워드가 붙으면 어떨까요? 주석으로 설명을 대체하겠습니다.

```kotlin

abstract class MyAbstractClass {
  fun myMethod() {
    // 구현. 하위 클래스에서 오버라이드 불가능
  }
}

abstract class MyAbstractClass {
  abstract fun myMethod() // 하위 클래스에서 반드시 오버라이드해야 함.


```

## Internal

코틀린에서 internal 키워드는 **모듈 내부** 접근 제어자입니다. 이 접근 제어자를 사용하면 같은 모듈 내에서만 해당 요소에 접근할 수 있습니다. 모듈이란 컴파일 시간에
함께
컴파일되는 Kotlin 파일들의 그룹을 의미합니다. 보통은 하나의 프로젝트를 의미합니다.

```kotlin

// ModuleA.kt
internal class InternalClass {
  // 클래스 내용
}

// 다른 파일(ModuleB.kt)에서 접근할 수 없음


```

코틀린에서 패키지는 네임스페이스를 관리하기 위한 용도로만 사용됩니다. 따라서 패키지를 가시성 제어에 사용하지 않으며, 모듈이라는 이름으로 부르고 있는 것입니다.
<br><span>
internal 키워드가 붙는 경우에는 같은 모듈 내에서만 접근이 가능합니다. java 의 protected 와 유사합니다.

## data

Kotlin에서 데이터 클래스(Data Classes)는 데이터를 보유하고 데이터를 다루는 데 주로 사용되는 클래스를 간결하게 작성하기 위한 특별한 유형의 클래스입니다. 이러한
데이터 클래스는 데이터를 저장하고 접근하는 메소드를 자동으로 생성해주며, 일반적으로 데이터의 구조화된 표현을 위해 사용됩니다.

<br><span>

kotlin 컴파일러는 데이터 클래스를 인식하고 자동으로 다음 메소드를 생성합니다.

1. equals(): 객체의 내용이 같은지 비교합니다.
2. hashCode(): 객체의 해시 코드를 생성합니다.
3. toString(): 객체를 문자열로 표현합니다.
4. componentN() 함수: 객체의 각 필드에 대한 구성 요소 함수를 생성합니다.
5. copy() 함수: 객체의 복사본을 만듭니다.

<br><span>
여기서 보면, component 함수와 copy 함수가 눈에 띕니다.
<br><span>
componentN() 함수는 구조 분해 선언(Destructuring Declarations)을 지원하기 위해 생성됩니다. 이 함수는 데이터 클래스의 각 속성에 대한 구성 요소를 반환합니다. N은 속성의 순서를 나타내며, 속성의 순서는 데이터 클래스에서 선언된 순서와 동일합니다.
예를 들어 다음과 같이 사용할 수 있습니다.

```kotlin

data class Person(val name: String, val age: Int)

val person = Person("Alice", 30)
val (name, age) = person // 구조 분해 선언
println("Name: $name, Age: $age")

```

<br><span>
copy() 함수는 기존 객체의 복사본을 생성할 때 사용됩니다. 데이터 클래스는 불변 클래스로 만드는 것이 권장되기에, copy 메소드를 활용해서 객체를 복사하여 사용할 수 있습니다.

> kotlin 에서 data class 를 불변 객체로 만들기를 권장하는 이유?
> 1. 안정성: 불변 객체는 객체의 상태가 변경되지 않으므로 객체의 상태에 대한 부작용이나 예상치 못한 변경을 방지할 수 있습니다. 이는 프로그램의 예측 가능성을 높이고 오류를 줄일 수 있습니다.
> 2. 스레드 안전성: 불변 객체는 여러 스레드에서 동시에 접근해도 안전합니다. 객체의 상태가 변경되지 않기 때문에 동기화를 신경 쓸 필요가 없습니다.
> 3. 가독성: 불변 객체는 상태가 변경되지 않으므로 코드가 더 이해하기 쉽고 예측 가능해집니다. 객체가 변경되지 않기 때문에 코드를 읽는 사람이 해당 객체의 상태를 추적하는 것이 더 쉽습니다.
> 4. 테스트 용이성: 불변 객체는 상태가 변경되지 않기 때문에 객체의 동작을 테스트하는 것이 간단해집니다. 각 테스트 케이스에서 객체의 상태가 변하지 않기 때문에 각 테스트 간에 객체를 공유해도 안전합니다.

