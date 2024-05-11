---
layout: post
title: "결제 로직 설계2"
date: 2024-05-11 10:04:01 +0900
categories: [ 설계 ]
---

# 결제 로직 설계

결제 로직을 어떻게 구현할 수 있을지를 고찰해보고자 합니다.

## 재고 관리

결제가 완료되면 상품의 주문이 완료된 것이고, 결제가 취소되면 상품의 주문이 취소된 것입니다. 모든 상품은 '유한'한 개수의 제한이 있기에, 우리는 상품의 재고 관리를 해야만 합니다.
<br>
일반적으로, 티케팅을 하는 과정을 생각해봅시다. 상품의 결제 화면에 들어간 순간 해당 좌석은 구매자가 '홀드' 하게 됩니다. 이후에 일정 시간이 지나도 결제가 이루어지지 않는다면 다른 구매자가 해당 좌석을 구매할 수 있게 됩니다.
<br>
그렇다면, 상품의 재고는 상품의 결제 화면에 들어간 순간에 감소해야 하는 걸까요?

### 배치

```shell

0 * * * * root /path/to/your/script.sh

```

결제 완료가 됐지만, 보낼 상품이 품절인 것은 문제입니다. 따라서, 구매 희망하는 것(결제 페이지 진입) 만으로도 재고를 감소시킨다는 전략은 합리적입니다. 그러나 구매를 희망했음에도 실제 구매가 이루어지지 않는 상품들이 존재할 수 있습니다.
만약 악의적인 사용자가 수천개의 계정을 만들어서 '구매 희망'만 하는 경우엔 상품이 실제로 판매되지 않은채 재고만 소진될 것입니다.
<br>
이를 방지하기 위해서, '구매 희망'으로 재고가 감소한 상품이 일정 시간이 지나도 결제가 되지 않는다면 다시 원복해줘야 합니다. 일정 시간이 지나도 결제가 되지 않는다면, 해당 구매 희망을 취소하고 재고를 원복하기 위해서 가장 먼저 생각할 수 있는 방법은 배치입니다.
<br>
배치를 통해서 우리는 상품에 대한 점유를 풀 수 있을 것입니다. 만약에 구매 희망자가 상품을 장바구니에 담았음에도 결제를 하지 않는 경우, 30분 뒤에 상품의 재고를 회복시켜줘야 한다면 30분 마다 배치가 돌면 될 것입니다.
<br>
그러나 배치는 관리 포인트의 어려움과, 일정 시간마다 시스템에 고정적인 부하가 가해진다는 단점이 있습니다. 만약 모종의 이유로 시스템이 배치 리소스를 할당할 수 없는 경우엔, 상품의 점유만 발생하고 해제는 발생하지 않겠죠.

### Queue

이런 부분에 있어서 부하에 대한 버퍼를 주기 위해서 큐를 사용할 수 있을 것입니다. Redis 나 RabbitMQ 를 사용한다면 일정 시간이 지난 후에 로직이 수행되도록 할 수 있을 것입니다.

```python

import pika
import time

# RabbitMQ 연결 설정
connection = pika.BlockingConnection(pika.ConnectionParameters('localhost'))
channel = connection.channel()

# 큐 선언
channel.queue_declare(queue='scheduled_tasks', durable=True)

# 특정 시간에 작업 예약
def schedule_task(task, delay):
    channel.basic_publish(
        exchange='',
        routing_key='scheduled_tasks',
        body=task,
        properties=pika.BasicProperties(
            delivery_mode=2,  # 메시지 지속성 설정
            expiration=str(delay * 1000)  # 밀리초 단위로 지연 시간 설정
        )
    )
    print(f"Task '{task}' scheduled after {delay} seconds")

# 작업 처리 함수
def callback(ch, method, properties, body):
    print(f"Received task: {body.decode('utf-8')}")
    # 여기서 작업을 처리하거나 호출하는 로직을 작성할 수 있습니다.

# 큐에 작업 예약을 위한 소비자 설정
channel.basic_consume(queue='scheduled_tasks', on_message_callback=callback, auto_ack=True)

print('Waiting for scheduled tasks...')
channel.start_consuming()


```

큐를 사용하면, 처리의 버퍼를 둘 수 있다는 점이 유용합니다. 예를 들어 어떤 시간대에 매우 많은 주문이 몰리는 경우에, 일단 큐에서 해당 주문에 대한 점유 처리 로직을 받기에 서버 부담을 완화할 수 있다는 것입니다.
큐의 로직을 처리할 수 있는 컨슈머의 수를 조절함으로서 주문이 많이 몰리는 경우에도 동적으로 조정할 수 있을 것입니다.
<br>
그러나 큐라는 별도의 아키텍쳐에 대한 관리 포인트가 존재한다는 점은 단점입니다.

### 로직

점유 처리를 위해서 rdb 의 timestamp 를 사용하는 흥미로운 로직이 있습니다.

```sql

SELECT p.stock_count - COALESCE(SUM(CASE WHEN o.status IN ('pre', 'during') THEN 1 ELSE 0 END), 0) AS hold_stock
FROM product p
       LEFT JOIN `order` o ON p.product_id = o.product_id
WHERE p.product_id = 231 and now() < o.expired_at
;

```

상품의 재고를 조회하는 것은, 해당 상품에 대한 '구매 대기' 혹은 '결제 중'인 주문 중에서 만료 시간이 현재보다 작은 주문의 재고를 제외한 재고로 반환하는 것입니다.
order 테이블에서 상품의 id, order 의 상태, expired_at 으로 인덱싱을 해둔다면 빠른 시간 안에 현재 상품의 주문 가능 재고를 확인할 수 있을 것입니다.

<br>
이 방법에는 상품의 재고 조회를 위해서 항상 이런 로직을 활용해야 한다는 단점이 있습니다. jpa 를 사용한다면 stock_count 에 대한 getter 에서 구현해두면 안전할 것입니다.

```java

    // 재고에서 보유된 주문 수를 제외한 현재 재고를 반환하는 Getter 메서드
    public int getStockCountWithAvailableStock() {
        // 보유된 주문 수 조회
        int heldOrdersCount = getHeldOrdersCount(); // 이 메서드는 점유, 결제 상태 중 만료되지 않은 주문을 조회하는 로직을 호출합니다.

        // 재고에서 보유된 주문 수를 뺀 현재 재고를 반환
        return stockCount - heldOrdersCount;
    }

```

결제가 완료된 경우에만 product 의 stock_count 자체를 감소시켜준다면 위의 로직을 활용해도 좋을 것 같습니다.
