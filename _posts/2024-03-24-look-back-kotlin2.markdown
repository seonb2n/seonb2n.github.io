---
layout: post
title: "코틀린을 돌아보며2"
date: 2024-03-24 22:16:01 +0900
categories: [ Kotlin, Grammar ]
---

# 코틀린을 돌아보자2

## 스코프 함수

코틀린에서 scope 함수는 객체의 컨텍스트 내에서 코드 블록을 실행하는 데 사용되는 특별한 함수입니다. 이러한 함수들은 주어진 객체를 참조하여 작업을 수행하고, 작업이 완료된
후에는 해당 객체를 반환합니다. 주로 코드의 가독성을 높이고 객체의 범위를 명확하게 지정하기 위해 사용됩니다.

### apply

- 객체의 속성을 초기화하거나 설정할 때 사용됩니다.
- 코드 블록 내에서 객체를 수정할 수 있으며, 마지막에는 객체 자체를 반환합니다.
- 주로 객체의 초기화나 설정 과정을 체이닝 없이 수행할 때 사용됩니다.

```kotlin

val person = Person().apply {
  name = "John"
  age = 30
}

```

이렇게도 사용할 수 있습니다.

```kotlin

val person = Person("John", 30).apply {
  name = "Mr. " + name
  나이To만나이()
}

class Person(var name: String, var age: Int) {
  fun 나이To만나이() {
    age -= 2
  }
}

```

### run

- 객체의 컨텍스트 내에서 코드를 실행하고, 그 결과를 반환합니다.
- 코드 블록 내에서 객체의 멤버에 접근할 때 유용합니다.
- 주로 코드 블록 내에서 여러 작업을 수행하고 결과를 반환해야 할 때 사용됩니다.

```kotlin

val result = person.run {
  // person 객체의 멤버에 접근하여 작업 수행
  "$name is $age years old."

  println(result)
}

```

만약에 run 함수 내에서 인스턴스의 프로퍼티를 변경하면 그 값이 반환됩니다.

```kotlin

val result = person.run {
  // person 객체의 멤버에 접근하여 작업 수행
  "Mr. " + name

  println(result) // Mr. John 반환
}

```

### with

- run과 동일한 기능을 수행합니다.

### also

- 객체를 컨텍스트로 사용하여 코드 블록을 실행하고, 객체 자체를 반환합니다.
- 객체를 변경하지 않고 코드 블록을 실행할 때 유용합니다.
- 객체의 상태를 확인하거나 로깅할 때 사용될 수 있습니다.

```kotlin

val modifiedPerson = person.also {
  // person 객체를 사용하여 어떤 작업 수행
  log("Person: $it")
}

```

java 의 this 객체와 유사합니다.

### let

- 객체를 사용하여 연산을 수행하고 그 결과를 반환합니다.
- 코드 블록 내에서 안전하게 null 체크를 수행할 수 있습니다.
- 주로 null이 아닌 객체를 사용하여 작업할 때 사용됩니다.

```kotlin

val result = nullableObject?.let {
  // nullableObject가 null이 아닐 때 실행
  it.doSomething()
}

```

## Nullable Types

Kotlin에서는 기본적으로 모든 변수가 null이 될 수 있는 Nullable 타입입니다. 이는 Java의 기본 타입과 차이가 있습니다. Nullable 타입을 사용할 때는
안전한 호출(?.), 엘비스 연산자(?:), let 함수 등을 활용하여 NPE(NullPointerException)를 방지해야 합니다.

```kotlin

var nullableString: String? = "Hello"
nullableString?.length // 안전한 호출
val length = nullableString?.length ?: 0 // 엘비스 연산자 사용
nullableString?.let { // let 함수 사용
  // nullableString이 null이 아닐 때 실행되는 블록
  println(it.length)
}

```

어찌보면 typescript 의 null check 와도 유사한 느낌이 듭니다. 이것이 모던 언어의 특징일까요?

## 확장 함수

Kotlin은 확장 함수를 통해 기존 클래스에 새로운 기능을 추가할 수 있습니다.

```kotlin

fun String.addExclamation(): String {
  return "$this!"
}

val greeting = "Hello".addExclamation()
println(greeting) // 출력: Hello!

```

## mutable vs immutable 자료구조

Kotlin은 다양한 자료 구조를 제공하며, 이들은 주로 불변(Immutable)과 가변(Mutable) 두 가지 유형으로 나뉩니다.

### immutable 자료 구조

불변(Immutable) 자료 구조는 생성된 후에 변경할 수 없는 자료 구조입니다. 이는 생성된 후에 내부 상태를 수정할 수 없으며, 새로운 요소를 추가하거나 기존 요소를 변경하는
것이 불가능합니다.

```kotlin

// Immutable List
val immutableList = listOf("apple", "banana", "orange")

// Immutable Set
val immutableSet = setOf("apple", "banana", "orange")

// Immutable Map
val immutableMap = mapOf(1 to "apple", 2 to "banana", 3 to "orange")


```

불변 자료 구조를 변경하려고 하면 오류가 발생합니다.

```kotlin

val immutableList = listOf("apple", "banana", "orange")
immutableList.add("grape") //  Error, 애초에 add() 가 존재하지 않는다.

```

[코드로 확인해보자](https://github.com/Kotlin/kotlinx.collections.immutable/blob/master/core/commonMain/src/ImmutableList.kt)



### mutable 자료 구조

가변(Mutable) 자료 구조는 생성된 후에도 내부 상태를 변경할 수 있는 자료 구조입니다. 이는 새로운 요소를 추가하거나 기존 요소를 수정하거나 제거할 수 있는 특징을 가지고
있습니다.

```kotlin

// Mutable List
val mutableList = mutableListOf("apple", "banana", "orange")
mutableList.add("grape") // 요소 추가
mutableList.removeAt(1) // 요소 삭제

// Mutable Set
val mutableSet = mutableSetOf("apple", "banana", "orange")
mutableSet.add("grape") // 요소 추가
mutableSet.remove("banana") // 요소 삭제

// Mutable Map
val mutableMap = mutableMapOf(1 to "apple", 2 to "banana", 3 to "orange")
mutableMap[4] = "grape" // 요소 추가
mutableMap.remove(2) // 요소 삭제


```
