---
layout: post
title: "redis, pub/sub"
date: 2024-03-2 11:06:01 +0900
categories: [ redis ]
---


# redis pub sub

Messaging Queue 의 메시징 패턴 중 하나이다. 채팅 시스템, 푸시 알림 시스템, 구독 시스템과 같은 시스템에서 사용된다.
<br>
redis 의 경우, 메시지를 pub 쪽에 저장하지 않기에, subscriber 가 존재하지 않는다면 메시지는 그대로 유실된다.
즉, 메시지에 대한 수신 확인을 보장하지 않는다는 것이다.

## topic

publisher 를 subscriber 가 구독하는 순간 topic (채널) 이 생성된다.
특정 topic 을 구독하는 여러 subscriber 들이 존재할 수 있다. subscriber 는 여러 채널을 구독할 수 있으니 채널과 subscriber 는 **다대다** 관계이다.

## 실제 코드 참고
[redis pub/sub code](https://github.com/redis/redis/blob/6.2/src/pubsub.c)

```c
/* 메시지 생산 */
int pubsubPublishMessage(robj *channel, robj *message) {
 1. 클라이언트 수 초기화,
 2. 주어진 채널에 대한 구독자 목록 탐색
 3. 구독자가 있는 경우, 클라이언트에게 메시지 전송
 4. 패턴 딕셔너리 탐색으로, 클라이언트 탐색
 5. 클라이언트에게 메시지 전달
 6. 메시지를 받는 클라이언트 수 반환
}

```

## 정리

- redis pub/sub 은 redis 서버를 매개로 해서, 클라이언트 간 통신을 시켜준다.
- redis 클라이언트는 redis 서버 내 '채널' 을 생성할 수 있다.
- 메시지를 수신하고자 하는 클라이언트(subscriber)는 해당 채널의 메시지를 subscribe 할 수 있다.
- 메시지를 전송하고자 하는 클라이언트(publisher)는 해당 채널에 메시지를 publish 할 수 있다
- 메시지를 publish 하는 순간에, subscribe 하는 클라이언트만 메시지를 수신하고, 메시지는 유실된다.

### 실무에 적용된 레퍼런스

[올리브영 쿠폰 발급 시스템 redis pub/sub 도입 후기](https://oliveyoung.tech/blog/2023-08-07/async-process-of-coupon-issuance-using-redis/)
<br>
[채널톡 채팅 서버 개선](https://channel.io/ko/blog/real-time-chat-server-1-redis-pub-sub)
