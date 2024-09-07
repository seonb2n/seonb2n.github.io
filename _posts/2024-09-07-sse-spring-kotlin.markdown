---
layout: post
title: "코프링과 코루틴에서 SSE 를 사용해보자"
date: 2024-09-07 21:46:01 +0900
categories: [ Spring ]
---

# 코프링과 코루틴에서 SSE 를 사용해보자

<br><span> 코프링에서 SSE 를 사용해서 알림 기능을 구현해보겠습니다.

> - MongoDB
> - Kotlin
> - Spring Boot
> - Coroutine

## 왜 SSE 인가요?

<br><span> 알림 기능을 구현하기 위해서 가장 먼저 고려한 옵션은 롱풀링과 소켓 방식이었습니다. 그러나 토이 프로젝트 특성 상, 소켓 통신은 비용의 부담이 되고 롱풀링은 평소에 많이 사용해봤기에 색다른 방법을
시도하고 싶었습니다.
<br><span>따라서, 서버 -> 클라이언트인 단방향 통신으로만 사용하기에 최적의 방법이면서 구현이 용이한 SSE 를 선택했습니다.

## 구조 설계

- 알림 객체는 서버 내 여러 이벤트로 인해서 생성이 됩니다.
- 생성된 알림 객체는 mongo DB 에 저장됩니다.
- DB 에 저장과 동시에 emitter 를 통해서 이벤트로 생성이 됩니다.
- 이벤트에 대한 구독자가 있다면 이벤트를 송신합니다.

## 상세 코드

<br><span> 알림 클래스는 다음과 같습니다.

```kotlin

@Document
class Notification(
  @Id
  var id: String? = null,
  val notificationType: NotificationType,
  val targetUserId: String,
  var isRead: Boolean = false,
  val createdAt: LocalDateTime = LocalDateTime.now(),
) {

}

```

<br><span> repository 클래스는 다음과 같습니다. 이벤트 처리를 위해서 이벤트를 보관할 Sink 를 생성해줘야 합니다. 따라서 mongoDB 저장을 위한 repository 와 알림 저장을 위한 repository 를 별도 구현하겠습니다.

#### CustomNotificationRepository

```kotlin

interface CustomNotificationRepository {
  fun subscribeToUserNotifications(userId: String): Flux<ServerSentEvent<Notification>>
  fun emitNotification(notification: Notification)
}

```

#### CustomNotificationRepositoryImpl

```kotlin

class CustomNotificationRepositoryImpl : CustomNotificationRepository {
  private val sinks = mutableMapOf<String, Sinks.Many<ServerSentEvent<Notification>>>()

  override fun subscribeToUserNotifications(userId: String): Flux<ServerSentEvent<Notification>> {
    val sink = sinks.getOrPut(userId) { Sinks.many().multicast().onBackpressureBuffer() }
    return sink.asFlux().doOnCancel {
      sinks.remove(userId)
    }
  }

  override fun emitNotification(notification: Notification) {
    sinks[notification.targetUserId]?.tryEmitNext(
      ServerSentEvent.builder(notification).build()
    )
  }
}

```

#### NotificationRepository

```kotlin


interface NotificationRepository : ReactiveMongoRepository<Notification, String>, CustomNotificationRepository {

  fun findAllByTargetUserIdAndIsReadFalse(userId: String): Flux<Notification>

}

```

<br><span> 이제 이 알림을 생성 및 수신 처리할 service layer 와 controller layer 를 구현합니다.

#### NotificationService

```kotlin

@Service
class NotificationService(
  private val notificationRepository: NotificationRepository
) {

  @Transactional
  suspend fun createNotification(notificationType: NotificationType, userId: String): Notification {
    val notification = Notification(notificationType = notificationType, targetUserId = userId)
    val savedNotification = notificationRepository.save(notification).awaitSingle()
    notificationRepository.emitNotification(savedNotification)
    return savedNotification
  }

  fun subscribeToUserNotifications(userId: String): Flow<ServerSentEvent<Notification>> {
    val existingNotifications = notificationRepository.findAllByTargetUserIdAndIsReadFalse(userId)
      .asFlow()
      .map { notification -> ServerSentEvent.builder(notification).build() }

    val newNotifications = notificationRepository.subscribeToUserNotifications(userId)
      .asFlow()

    return merge(existingNotifications, newNotifications)
  }

  suspend fun markNotificationAsRead(id: String): Notification {
    val notification = notificationRepository.findById(id).awaitSingle()
    notification.isRead = true
    return notificationRepository.save(notification).awaitSingle()
  }

  suspend fun getUnreadNotificationsCount(userId: String): Int {
    return notificationRepository.findAllByTargetUserIdAndIsReadFalse(userId).collectList().awaitSingle().size
  }
}

```

#### NotificationController

```kotlin

@RestController
@RequestMapping("/api/v1/notifications")
class NotificationController(
  private val notificationService: NotificationService
) {

  @GetMapping("/subscribe/{userId}", produces = [MediaType.TEXT_EVENT_STREAM_VALUE])
  fun subscribeToNotifications(@PathVariable userId: String): Flow<ServerSentEvent<Notification>> {
    return notificationService.subscribeToUserNotifications(userId)
  }

  @PutMapping("/{id}/read")
  suspend fun markNotificationAsRead(@PathVariable id: String): Notification {
    return notificationService.markNotificationAsRead(id)
  }

  @GetMapping("/unread-count/{userId}")
  suspend fun getUnreadNotificationsCount(@PathVariable userId: String): Int {
    return notificationService.getUnreadNotificationsCount(userId)
  }
}


```

<br><span> 알림이 생성되면 userId 로 해당 알림을 구독하고 있던 사용자는 알림을 전달받습니다.

![Desktop View](/assets/img/2024-09-07/2024-09-07-01.png){: width="972" height="589" }


### 모든 코드와 테스트 코드가 궁금하다면?

https://github.com/PmeetLabs/pmeet-server/pull/175

### 참고

https://velog.io/@black_han26/SSE-Server-Sent-Events
