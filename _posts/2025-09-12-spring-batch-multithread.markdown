---
layout: post
title: "Spring Batch를 멀티스레드로 실행시켜서 배치 실행 성능을 높여보자"
date: 2025-09-12 19:26:01 +0900
categories: [ Spring ]
---

---

# Spring Batch를 멀티스레드로 실행시켜서 배치 실행 성능을 높여보자

Spring Batch를 운영하다 보면 대용량 데이터 처리 시 성능 문제에 직면하게 됩니다.
배치에 따라 다르지만, network I/O, DB I/O 작업이 많다면 멀티스레드 처리를 통해 성능을 크게 향상시킬 수 있을 것 같아서 그 과정에서 삽질과 고민을 정리해보고자 합니다.
이 글에서는 Spring Batch 멀티스레드 처리 시 마주치는 세 가지 핵심 고민과 해결방법을 실제 코드와 함께 살펴보겠습니다.

## 기본 예시 코드

먼저 일반적인 Spring Batch Reader 구조를 살펴보겠습니다.

```kotlin
@Component
@StepScope
class UserDataItemReader(
    private val userRepository: UserRepository,
    @Value("#{jobParameters['targetDate']}") private val targetDate: String,
    @Value("#{jobParameters['departmentId']}") private val departmentId: Long,
) : ItemReader<UserData> {

    private val department by lazy {
        userRepository.findDepartmentById(departmentId)
    }

    private val users by lazy {
        userRepository.findUsersByDepartmentAndDate(department, LocalDateTime.parse(targetDate))
    }

    private var currentIndex = 0

    override fun read(): UserData? = if (currentIndex < users.size) {
        users[currentIndex++]
    } else {
        null
    }
}
```

## 고민 1: 싱글톤 인스턴스의 필드 문제와 @StepScope

### 문제 상황

Spring의 `@Component`는 기본적으로 싱글톤입니다. 그렇다면 위 코드에서 `jobParameters`가 달라져도 필드값들이 제대로 갱신될까요?

```kotlin
// 첫 번째 실행: departmentId = 1
// 두 번째 실행: departmentId = 2
// 과연 department과 users가 새로 조회될까?
```

해답은 `@StepScope` 에 있습니다.

### Spring Batch 에서 Step 의 핵심 특징

1. **Step 실행마다 새 인스턴스**: 각 Step이 실행될 때마다 Reader의 새로운 인스턴스가 생성됩니다.
2. **jobParameters 변경 감지**: `departmentId`나 `targetDate` 같은 jobParameters가 바뀌면 새로운 인스턴스를 생성합니다.
3. **Late Binding**: `@Value`로 주입받는 jobParameters가 실제 Step 실행 시점에 바인딩됩니다.

이제 `lazy`를 사용하는 이유도 명확해집니다:

```kotlin
// 생성자에서 바로 실행하면
private val department = userRepository.findDepartmentById(departmentId)  // 객체 생성 시점에 즉시 DB 조회

// lazy로 하면
private val department by lazy { userRepository.findDepartmentById(departmentId) }  // 실제 사용 시점에 DB 조회
```

**lazy 사용의 이유:**
- 성능 최적화: 실제로 `read()` 메서드가 호출되기 전까지 DB 조회를 미룸
- 불필요한 DB 호출 방지: Reader가 생성되었지만 실제로 사용되지 않는 경우 DB 조회 안 함

그런데 Spring 에서 `@Component` 는 싱글톤 인스터스로 만들잖아. 그러면 어떻게 매번 재생성이 되는거지?
<br/> 그 비결은 `@StepScope` 에 있습니다.

### StepScope 구현 메커니즘 딥다이브

#### 1. 프록시 기반 객체 생성

StepScope는 AOP 프록시를 사용하여 싱글톤을 오버라이드합니다(Spring Batch 소스 코드 참고):

```java
// StepScope.java의 핵심 메서드
@Override
public Object get(String name, ObjectFactory<?> objectFactory) {
  StepContext context = getContext();  // 현재 Step의 컨텍스트 조회
  Object scopedObject = context.getAttribute(name);  // 이미 생성된 객체가 있는지 확인

  if (scopedObject == null) {  // 객체가 없으면 새로 생성
    synchronized (mutex) {
      scopedObject = context.getAttribute(name);  // Double-checked locking
      if (scopedObject == null) {
        // 🔑 핵심: ObjectFactory를 통해 새 객체 생성!
        scopedObject = objectFactory.getObject();
        context.setAttribute(name, scopedObject);  // StepContext에 저장
      }
    }
  }
  return scopedObject;
}
```

Step 별로 다른 컨텍스트를 가지고 있기에 매번 새로운 객체를 팩토리 패턴으로 생성하는 것을 확인할 수 있습니다. 생명 주기 흐름을 정리하면 다음과 같습니다.

```
1. ApplicationContext 시작
   ↓
2. @StepScope 빈은 프록시로만 등록 (실제 객체 X)
   ↓
3. Step 실행 시작
   ↓
4. StepSynchronizationManager.register(stepExecution) 호출
   ↓
5. StepContext 생성 및 ThreadLocal에 바인딩
   ↓
6. 첫 번째 빈 참조 시 ObjectFactory를 통해 실제 객체 생성
   ↓
7. StepContext에 객체 저장
   ↓
8. Step 종료 시 StepSynchronizationManager.close() 호출
   ↓
9. StepContext와 함께 객체 소멸
```

그런데, Spring 에서 싱글톤 인스턴스는 생성 시점에 인자를 주입받아야 합니다 어떻게 배치는 jobParameters 를 나중에 받는걸까요?
<br/> 여기엔 Late Binding 메커니즘이 있습니다.

#### Late Binding 메커니즘

```java
// Late Binding 구현
@Override
public Object resolveContextualObject(String key) {
    StepContext context = getContext();
    // SpEL 표현식을 런타임에 평가
    return new BeanWrapperImpl(context).getPropertyValue(key);
}
```

이를 통해 `#{jobParameters[key]}`, `#{stepExecutionContext[key]}` 같은 표현식이 Step 실행 시점에 실제 값으로 바인딩됩니다. 즉, 우리는 위와 같은 과정을 통해서 어떻게 Step 이 Job 마다 생성되고 처리되는지를 알 수 있었습니다.
그러면 이제 이 Step 을 멀티스레드로 구동시키기 위해 필요한 고민을 다뤄보겠습니다.

## 고민 2: AtomicInteger를 써야 하는 이유

### 멀티스레드 환경에서의 위험성

Spring Batch에서는 하나의 Step을 여러 스레드로 병렬 처리할 수 있습니다:

```kotlin
@Bean
fun userDataProcessingStep(): Step {
    return stepBuilderFactory.get("userDataStep")
        .chunk<UserData, ProcessedUserData>(100)
        .reader(userDataReader)
        .processor(userDataProcessor)
        .writer(userDataWriter)
        .taskExecutor(taskExecutor())  // 멀티스레드 설정!
        .build()
}
```

이 경우 다음과 같은 상황이 발생합니다:

```
Step 실행 시:
┌─ Thread 1 ─┐    ┌─ Thread 2 ─┐    ┌─ Thread 3 ─┐    ┌─ Thread 4 ─┐
│  reader.read() │    │  reader.read() │    │  reader.read() │    │  reader.read() │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
        ↓                   ↓                   ↓                   ↓
      동일한 Reader 인스턴스의 currentIndex에 동시 접근!
```

### Race Condition 문제

```kotlin
private var currentIndex = 0  // 위험!

override fun read(): UserData? {
    // Thread 1: currentIndex = 0 읽기 → currentIndex++ 실행 → 1
    // Thread 2: currentIndex = 0 읽기 → currentIndex++ 실행 → 1 (같은 값!)
    // 결과: 데이터 중복 읽기 또는 누락!
    return if (currentIndex < users.size) users[currentIndex++] else null
}
```

### AtomicInteger로 해결

```kotlin
@Component
@StepScope
class UserDataItemReader(
    private val userRepository: UserRepository,
    @Value("#{jobParameters['targetDate']}") private val targetDate: String,
    @Value("#{jobParameters['departmentId']}") private val departmentId: Long,
) : ItemReader<UserData> {

    private val department by lazy { userRepository.findDepartmentById(departmentId) }
    private val users by lazy {
        userRepository.findUsersByDepartmentAndDate(department, LocalDateTime.parse(targetDate))
    }

    // Thread-safe한 인덱스 관리
    private val currentIndex = AtomicInteger(0)

    override fun read(): UserData? {
        val index = currentIndex.getAndIncrement()
        return if (index < users.size) {
            users[index]
        } else {
            null
        }
    }
}
```

대부분의 production 환경에서는 성능을 위해 멀티스레드를 사용하므로, `AtomicInteger`를 사용하는 것이 안전합니다.

## 고민 3: 멀티스레드 구현과 성능 차이

### 멀티스레드 구성

```kotlin
@Configuration
class BatchTaskExecutorConfig {

    @Bean("batchTaskExecutor")
    fun batchTaskExecutor(): TaskExecutor {
        val executor = ThreadPoolTaskExecutor()
        executor.corePoolSize = 4          // 기본 스레드 수
        executor.maxPoolSize = 8           // 최대 스레드 수
        executor.queueCapacity = 1000      // 대기열 크기
        executor.setThreadNamePrefix("batch-thread-")
        executor.setRejectedExecutionHandler(ThreadPoolExecutor.CallerRunsPolicy())
        executor.initialize()
        return executor
    }
}
```

corePoolSize 와 maxPoolSize 는 알겠는데 queueCapacity 는 뭘까요? queueCapacity 를 알기 위해서는 ThreadPoolTaskExecutor의 작업 처리 순서를 이해해야 합니다:

```
작업이 들어올 때:

1. corePoolSize(4) 이하 → 새 스레드 생성해서 즉시 처리
2. corePoolSize 초과 → 대기열(queue)에 작업 저장 (최대 1000개)
3. 대기열도 가득참 → maxPoolSize(8)까지 추가 스레드 생성
4. 모든 스레드 사용중 + 대기열 가득참 → RejectedExecutionHandler 실행
```

결국 일종의 작업 대기열(queue) 사이즈(capacity)로 이해하시면 됩니다.

### Step 구성

```kotlin
@Configuration
class UserDataBatchConfig {

    @Bean
    fun userDataProcessingStep(
        jobRepository: JobRepository,
        transactionManager: PlatformTransactionManager,
        reader: UserDataItemReader,
        processor: UserDataItemProcessor,
        writer: UserDataItemWriter,
        @Qualifier("batchTaskExecutor") taskExecutor: TaskExecutor,
    ): Step = StepBuilder("userDataStep", jobRepository)
        .chunk<UserData, ProcessedUserData>(100, transactionManager)
        .reader(reader)
        .processor(processor)
        .writer(writer)
        .taskExecutor(taskExecutor)        // 멀티스레드 적용
        .throttleLimit(4)                  // 동시 실행 스레드 수 제한
        .build()
}
```

### 성능 향상 효과

간단한 테스트 코드로 성능 테스트를 진행했습니다.
```
- 단일 스레드: 10,000건 처리 → 20분
- 4 스레드: 10,000건 처리 → 8분 (약 2.5배 향상)
- 8 스레드: 10,000건 처리 → 6분 (약 3.3배 향상)
```

### 주의사항

##### 1. Writer의 동시성 고려
저 같은 경우는 writer 가 네트워크 I/O 고 외부 시스템에서 동시 요청 처리가 가능해서 문제가 없었습니다.
만약 writer 가 파일을 쓰는 경우라면 다른 고려가 필요할 것 같습니다.


#### 2. 트랜잭션 격리

- 각 Chunk가 별도 트랜잭션으로 처리됨
- 실패 시 부분 롤백 발생 가능

## 결론

Spring Batch 멀티스레드 처리를 구현하면서 궁금한 의문과 한계를 이렇게 정리했습니다.
