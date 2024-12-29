---
layout: post
title: "Spring Cloud Gateway 에서 사용자 요청 로그 남기기2 - Spring Cloud Gateway 의 Filter 에 대한 삽질을 곁들인"
date: 2024-12-29 12:40:01 +0900
categories: [ 설계 ]
---

---

# Spring Cloud Gateway 에서 사용자 요청 로그 남기기2 - Spring Cloud Gateway 의 Filter 에 대한 삽질을 곁들인

## 배경

> [1편 - spring cloud gateway 를 사용해서 로깅을 해보자](https://seonb2n.github.io/posts/spring-gateway-logging/)

안녕하세요. 저번 아티클에 이어서, 이번에는 request body, response body 를 로그로 남기기 위한 gateway filter 를 구현했습니다

## 사용 기술

- DynamoDB : 로그 저장소
- OrderGatewayFilter : 게이트웨이 필터 컴포넌트
- ServerHttpResponseDecorator : 응답 본문 처리를 위한 데코레이터
- ServerHttpRequestDecorator : 요청 본문 처리를 위한 데코레이터
- NettWriteResponseFilter : Spring 내장 필터

## 플로우

1. 클라이언트에서 요청 보냄
2. 게이트웨이에 요청 도착
3. 다른 필터 호출
4. UserRequestLogFilter 의 request Decorator 작동해서 requestBody 캐싱
5. 다운스트림 서비스 처리(MSA 서비스로 라우팅)
6. 응답 생성 후, UserRequestLogFilter 의 response Decorator 작동
7. 로그 저장 코루틴 실행 및 클라이언트에 응답

### 메서드 호출 순서

```
UserRequestLogFilter.apply()
└─> handleRequestWithBody()
    └─> [다운스트림 서비스 처리]
        └─> LoggingResponseDecorator.writeWith()
            └─> processResponseData()
                └─> logUseCase.saveLog()
```

## 구현

코드는 이와 같습니다. 코드에 대한 별도 설명은 하지 않겠습니다. 코드 밑의 내용은 해당 코드를 구현하기 위해 삽질한 과정과 Spring Cloud Gateway 와 Filter 의 작동 원리에 대한 설명입니다.

```kotlin

@Component
class UserRequestLogFilter(
    private val logUseCase: LogUseCase,
    private val coroutineScope: CoroutineScope,
) : AbstractGatewayFilterFactory<Any>() {
    companion object {
        private val EMPTY_BYTES = ByteArray(0)
        private const val MAX_LOGGING_SIZE = 1024 * 1024 // 1MB 사이즈 제한
        const val REQUEST_BODY_ATTR = "requestBody"
    }

    override fun apply(config: Any?): GatewayFilter =
        OrderedGatewayFilter({ exchange, chain ->
            val contentLength = exchange.request.headers.contentLength
            val isMultipart =
                exchange.request.headers
                    .contentType
                    ?.includes(MediaType.MULTIPART_FORM_DATA) ?: false

            val skipBodyLogging = isMultipart || contentLength > MAX_LOGGING_SIZE

            // 먼저 responseDecorator를 설정
            val decoratedExchange =
                exchange
                    .mutate()
                    .response(LoggingResponseDecorator(exchange, coroutineScope, logUseCase))
                    .build()

            if (skipBodyLogging) {
                decoratedExchange.attributes[REQUEST_BODY_ATTR] = "[Body logging skipped - large content or multipart]"
                chain.filter(decoratedExchange)
            } else {
                handleRequestWithBody(decoratedExchange, chain)
            }
        }, -2)

    private fun handleRequestWithBody(
        exchange: ServerWebExchange,
        chain: GatewayFilterChain,
    ): Mono<Void> =
        DataBufferUtils
            .join(exchange.request.body)
            .map { dataBuffer ->
                val bytes = ByteArray(dataBuffer.readableByteCount())
                dataBuffer.read(bytes)
                DataBufferUtils.release(dataBuffer)
                bytes
            }.defaultIfEmpty(EMPTY_BYTES)
            .flatMap { bytes ->
                exchange.attributes[REQUEST_BODY_ATTR] = String(bytes)
                chain.filter(
                    exchange
                        .mutate()
                        .request(RequestBodyDecorator(exchange, bytes))
                        .build(),
                )
            }
}

class LoggingResponseDecorator(
    private val exchange: ServerWebExchange,
    private val coroutineScope: CoroutineScope,
    private val logUseCase: LogUseCase,
) : ServerHttpResponseDecorator(exchange.response) {
    private val log: Logger = LoggerFactory.getLogger(this.javaClass)

    override fun writeWith(body: Publisher<out DataBuffer>): Mono<Void> {
        // ID를 여기서 읽고 제거
        // 생략.. 여기서 요청자의 식별 정보 추출

        return when (body) {
            is Mono -> {
                body.flatMap { buffer ->
                    val bytes = ByteArray(buffer.readableByteCount())
                    buffer.read(bytes)
                    DataBufferUtils.release(buffer)

                    val responseBuffer = exchange.response.bufferFactory().wrap(bytes)

                    if (true) { //생략.. 요청자의 식별  정보가 타당한지 판별하는 로직이 들어가 있음
                        Mono
                            .fromRunnable<Unit> {
                                processResponseData(bytes, institutionId, profileId)
                            }.then(
                                super.writeWith(Mono.just(responseBuffer)),
                            )
                    } else {
                        super.writeWith(Mono.just(responseBuffer))
                    }
                }
            }
            is Flux -> {
                body.collectList().flatMap { buffers ->
                   // response 가 chunk 로 반환되기에 collect 를 해야함
                    val totalSize = buffers.sumOf { it.readableByteCount() }
                    val combinedBytes = ByteArray(totalSize)
                    var offset = 0

                    buffers.forEach { buffer ->
                        val length = buffer.readableByteCount()
                        buffer.read(combinedBytes, offset, length)
                        DataBufferUtils.release(buffer)
                        offset += length
                    }

                    val responseBuffer = exchange.response.bufferFactory().wrap(combinedBytes)
                    Mono
                      .fromRunnable<Unit> {
                        processResponseData(combinedBytes)
                      }.then(
                        super.writeWith(Mono.just(responseBuffer)),
                        )
                }
            }
            else -> super.writeWith(body)
        }
    }

    private fun processResponseData(
        bytes: ByteArray,
    ) {
        val responseBody = String(bytes)
        // 캐싱해둔 requestBody 추출
        val requestBody = exchange.attributes[UserRequestLogFilter.REQUEST_BODY_ATTR] as? String ?: ""

        log.info("Processing response data with length: ${bytes.size}")

        coroutineScope.launch(Dispatchers.IO) {
            try {
                logUseCase.saveLog(
                  // 생략 로그로 저장할 인자들
                )
            } catch (e: Exception) {
                log.error("Failed to save log", e)
            }
        }
    }

    private fun getRelevantHeaders(request: ServerHttpRequest): Map<String, String> {
        val relevantHeaders = setOf("user-agent", "accept", "origin", "content-type", "content-length")
        return request.headers
            .toSingleValueMap()
            .filterKeys { it.lowercase(Locale.getDefault()) in relevantHeaders }
    }
}

class RequestBodyDecorator(
    private val exchange: ServerWebExchange,
    private val bytes: ByteArray,
) : ServerHttpRequestDecorator(exchange.request) {
    override fun getBody(): Flux<DataBuffer> =
        if (bytes.isEmpty()) {
            Flux.empty()
        } else {
            Flux.just(exchange.response.bufferFactory().wrap(bytes))
        }
}

```

삽질을 좀 했습니다. GatewayFilter 에다가 responseDecorator 를 추가한 경우에 writeWith 메서드가 호출되지 않는 부분이 문제였습니다.
<br/>
관련해서 다음과 같은 stackoverflow 글들과 github issue 를 확인했습니다.
- https://stackoverflow.com/questions/76078243/spring-cloud-gateway-serverhttpresponsedecorator-writewith-not-called-on-receivi
- https://docs.spring.io/spring-cloud-gateway/reference/spring-cloud-gateway/global-filters.html#netty-write-response-filter
- https://github.com/spring-cloud/spring-cloud-gateway/issues/3519
- https://github.com/spring-cloud/spring-cloud-gateway/issues/1771

12 시간에 걸친 디버깅 결과, 확인할 수 있었던 점은 writeWith 가 호출되기 위해서는 필터의 순서가 중요하다는 점이었습니다. 그런데 저의 경우에는 Order 를 구현해서 다음과 같은 코드를 작성했음에도 gatewayFilter 에서 responseBody 를 소화하지 못했습니다. 다음과 같은 코드였는데요.
```kotlin


@Component
class UserRequestLogFilter : AbstractGatewayFilterFactory<Any>(), Ordered {
    override fun getOrder(): Int = NettyWriteResponseFilter.WRITE_RESPONSE_FILTER_ORDER - 1


```

github issue 를 참고해보면 이렇게 내용을 정리해볼 수 있었습니다.
1. WebFilter 를 사용해라.
2. NettWriteResponseFilter 보다 순서가 앞서야 한다.

그러나, 저는 여러 마이크로 서비스 별로 동적인 yml 설정으로 적용할 수 있는 Gatewayfilter 를 사용하고 싶었습니다. 따라서 GatewayFilter 를 사용하기 위한 방법을 탐색했습니다.
<br/> 일단 그 과정에서 issue 의 답변에 따라서 getOrder 를 구현했음에도 왜 필터가 순서대로 적용되지 않았는지 의문점을 가졌습니다. 그 결과 다음과 같은 내용을 배울 수 있었는데요.

<br/> Ordered 인터페이스를 구현하는 것은 필터 팩토리의 순서를 지정하는 것이고, 필터 인스턴스는 기본 순서(0)로 동작한다는 점이었습니다. 그러면 추가적인 의문이 생기는데요, 왜 WebFilter 는 Ordered 를 구현하는 경우 순서가 의도대로 적용되는지였습니다.
그 해답은 WebFilter 와 GatewayFilter 의 구현 방식 때문이었습니다.

- https://cloud.spring.io/spring-cloud-gateway/2.1.x/multi/multi__gatewayfilter_factories.html

WebFilter 는 필터 로직 자체를 구현하기 때문에, Ordered 인터페이스가 필터 컴포넌트의 순서를 직접 제어하고, 해당 순서에 따라서 필터 체인에 등록됩니다.
반면에 AbstractGatewayFilterFactory 를 상속받아 구현한 저의 LogFilter 가 Ordered 를 상속해도, 이는 팩토리의 순서를 제언한 것이지 필터 인스턴스의 순서를 제어한 것이 아니었습니다.
따라서 저의 GatewayFilter 구현체의 순서를 제어하기 위해서는 OrderedGatewayFilter 를 사용해서 인자로 순서를 지정해줘야 합니다.
<br/>
대부분의 디버깅 과정이 그렇듯이, 어찌보면 당연한 내용이지만 삽질하는 과정 끝에야 깨닫게 되는 허무한 원인이었던 것 같습니다.

## 결론

GatewayFilter 에서 request body 와 response body 를 캡쳐하고자 decorator 를 사용했습니다. 부하테스트를 통해서 캡쳐 과정으로 인한 혹시 모를 응답 시간의 지연을 확인해봤습니다.
기준점은 서비스별 주요 호출되는 api 를 뽑은 뒤에, 피크타임 api 호출 횟수 * 10 으로 VUSER 를 잡고 테스트를 진행했습니다.
<br/> 그 과정에서 필터에서 로깅을 하지 않는 경우와 비교했을 때 지연율의 차이가 0.2 % 이내로 미미했습니다. 게이트웨이 서비스의 pod 은 개당 2core 1g 메모리를 사용하고 있는데, vuser 200 까지도 문제 없이 요청을 처리하고 있으며, dynamodb 의 쓰기 제한으로 로깅이 실패하더라도 문제 없이 응답을 내려주고 있는 점을 확인했습니다.
<br/> 다음번엔 베스트 프렉티스로 이벤트 기반 로깅 시스템으로 전환한 후 아티클을 작성해보겠습니다. 긴 글 읽어주셔서 감사합니다.

