---
layout: post
title:  "Spring MVC DispatcherServlet 과 HandlerAdapter"
date:   2024-01-08 19:12:57 +0900
categories: Spring
---
Spring MVC 의 DispatcherServlet 과 HandlerAdapter 를 정리해보자.

### DispatcherServlet
스프링에서 요청이 들어오면, Servlet Container 내에서 요청을 처리할 수 있는 적절한 Servlet 을 찾는다.
<br>
이때, 적절한 Servlet 을 찾는 역할을 하는 것이 DispatcherServlet 이다.
- 스프링 MVC 의 핵심
- Front Controller 역할을 한다.

DispatcherServlet 동작 순서
1. 요청을 분석한다.
2. 핸들러 매핑을 통해 요청을 처리할 핸들러를 찾는다.
3. (등록되어 있는 핸들러 어댑터 중에) 해당 핸들러를 실행할 수 있는 `핸들러 어댑터`를 찾는다.
4. 찾아낸 `핸들러 어댑터`를 사용해서 핸들러의 응답을 처리한다.
   - 핸들러의 리턴값을 보고 어떻게 처리할지 결정한다.
   - 뷰 이름에 해당하는 뷰를 찾아서 모델 데이터를 랜더링한다.
   - @ResponseBody 가 있다면 Converter를 사용해서 응답 본문을 만든다.
   - 만약, 예외가 발생했다면 예외 처리 핸들러에 요청 처리를 위임한다.
5. 최종적으로 응답을 보낸다.

### HandlerAdapter
HandlerMapping 이 찾은 handler 를 처리할 수 있는 인터페이스이다.
<br>
핸들러는 컨트롤러를 의미한다.
<br>
1. **AnnotationMethodHandlerAdapter**: @RequestMapping 애노테이션을 사용하여 매핑된 메소드를 가진 컨트롤러를 처리한다.
2. **HttpRequestHandlerAdapter**: HttpRequestHandler 인터페이스를 구현한 핸들러를 처리한다.
3. **SimpleControllerHandlerAdapter**: Controller 인터페이스를 구현한 단순한 컨트롤러를 처리한다.

HandlerAdapter는 각 핸들러의 종류에 따라 적절한 방식으로 핸들러를 실행하고
그 결과를 DispatcherServlet에 반환한다.


