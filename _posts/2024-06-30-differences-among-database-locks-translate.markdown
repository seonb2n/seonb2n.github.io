---
layout: post
title: "(번역) 데이터베이스 락 사이의 차이점은 무엇일까요?"
date: 2024-06-30 14:36:01 +0900
categories: [ 데이터베이스, 번역 ]
---

# (번역) 데이터베이스 락 사이의 차이점은 무엇일까요?

> [원본글](https://blog.bytebytego.com/p/ep118-what-are-the-differences-among)

데이터베이스 관리에 있어서, 락은 데이터의 통일성과 일관성을 보장하기 위해서 데이터에 대한 동시 접근을 보호하는 메커니즘입니다.

> 원본글의 이미지를 참조해주세요
> https://substackcdn.com/image/fetch/w_1456,c_limit,f_webp,q_auto:good,fl_lossy/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2F42c5f5c6-b7d8-46ac-895f-06edd3d7fb7a_1280x1664.gif

<br><span>

데이터베이스에서 사용되는 락의 종류는 다음과 같습니다:

1. Shared Lock (S Lock)
- 공유 잠금 (S 잠금)
- 여러 트랜잭션이 동시에 자원을 읽을 수 있도록 하지만 수정은 할 수 없도록 하는 락입니다. 다른 트랜잭션도 동일한 자원에 대해 공유 잠금을 획득할 수 있습니다.

2. Exclusive Lock (X Lock)
- 배타적 잠금 (X 잠금)
- 트랜잭션이 자원을 읽고 수정할 수 있도록 허용하는 락입니다. 배타적 잠금이 유지되는 동안 다른 트랜잭션은 어떤 유형의 락도 해당 자원에 대해 획득할 수 없습니다.

3. Update Lock (U Lock)
- 업데이트 잠금 (U 잠금)
- 트랜잭션이 자원을 업데이트할 의도가 있을 때 데드락 시나리오를 방지하기 위해 사용되는 락입니다.

4. Schema Lock
- 스키마 잠금
- 데이터베이스 객체의 구조체를 보호하기 위해 사용되는 락입니다.

5. Bulk Update Lock (BU Lock)
- 대량 업데이트 잠금 (BU 잠금)
- 대량 삽입 작업 중에 성능을 향상시키기 위해 필요한 락의 수를 줄임으로써 사용되는 락입니다.

6. Key-Range Lock
- 키-범위 잠금
- 인덱스 데이터에서 팬텀 읽기(트랜잭션이 이미 읽은 범위에 새로운 행을 삽입하는 것)를 방지하기 위해 사용되는 락입니다.

7. Row-Level Lock
- 행 수준 잠금
- 테이블의 특정 행을 잠그며, 다른 행은 동시에 액세스할 수 있도록 허용하는 락입니다.

8. Page-Level Lock
- 페이지 수준 잠금
- 데이터베이스의 특정 페이지(고정 크기의 데이터 블록)를 잠그는 락입니다.

9. Table-Level Lock
- 테이블 수준 잠금
- 전체 테이블을 잠그는 락. 구현하기는 간단하지만 동시성의 성능을 크게 줄일 수 있습니다.
