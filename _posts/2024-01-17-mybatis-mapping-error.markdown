---
layout: post
title:  "MyBatis 결과 매핑 에러 해결"
date:   2024-01-17 21:06:57 +0900
categories: MyBatis
---

### Mybatis 사용중, 쿼리 결과가 dto 에 제대로 매핑이 안되는 오류가 발생했다.

> java.lang.NumberFormatException: For input string: "I am not a member"
> <br> at java.base/jdk.internal.math.FloatingDecimal.readJavaFormatString(FloatingDecimal.java:2054) ~[na:na]
> <br> at java.base/jdk.internal.math.FloatingDecimal.parseDouble(FloatingDecimal.java:110) ~[na:na]

Article class 의 구조는 다음과 같다.

```java
public class Article extends BaseEntity {

    private Integer id;
    private Integer userId;
    private Integer boardId;
    private String title;
    private String content;
    private Integer articleCommentNumber;
    private Integer articleHitNumber;

    private Article(Integer userId, Integer boardId, String title, String content,
        Integer articleCommentNumber, Integer articleHitNumber) {
        this.userId = userId;
        this.boardId = boardId;
        this.title = title;
        this.content = content;
        this.articleCommentNumber = articleCommentNumber;
        this.articleHitNumber = articleHitNumber;
    }

    public static Article of(Integer userId, Integer boardId, String title, String content) {
        return new Article(userId, boardId, title, content, 0, 0);
    }

    public Integer getId() {
        return id;
    }

    public Integer getUserId() {
        return userId;
    }

    public Integer getBoardId() {
        return boardId;
    }

    public String getTitle() {
        return title;
    }

    public String getContent() {
        return content;
    }

    public Integer getArticleCommentNumber() {
        return articleCommentNumber;
    }

    public Integer getArticleHitNumber() {
        return articleHitNumber;
    }
}
```

Mapper xml 을 다음과 같이 구성됐다.

```xml
<!DOCTYPE mapper PUBLIC "-//mybatis.org//DTD Mapper 3.0//EN"
  "http://mybatis.org/dtd/mybatis-3-mapper.dtd">
<mapper namespace="com.example.springboard.mapper.ArticleMapper">
  <select id="findArticleByArticleId" parameterType="Integer"
    resultType="com.example.springboard.domain.articles.Article">
    SELECT id, user_id, board_id, title, content, article_comment_number, article_hit_number
    FROM articles
    WHERE id = #{articleId}
  </select>
</mapper>
```

클래스와 매퍼의 코드에는 문제가 없어보이는데 왜 article 을 찾은 결과가 제대로 dto 에 매핑이 되지 않는걸까?

<br>

```sql
INSERT INTO board.articles
(user_id, board_id, title, content, article_comment_number, article_hit_number)
VALUES (1, 0, 'written_no_member', 'I am not a member', 0, 0);
```

Mock 데이터는 위의 쿼리를 통해서 생성됐다. 문제가 되는 필드인 I am not a member 를 null 로 줘봤다.
<br>
그 결과 오류는 발생하지 않았지만, dto의 필드를 자세히 보면 정상적으로 매핑이 되고 있지 않음을 알고 있었다.
<br>
이것으로 mybatis 의 결과를 dto 로 파싱하는 쪽에 문제가 있음이 확실했다.
<br>
그러면 mybatis 의 파싱 원리를 살펴봐야 한다.
- 기본 생성자만 존재하는 경우 : 쿼리 결과와 객체의 매핑이 정상적으로 진행 X
- 기본 생성자와 별칭(alias) 이 존재하는 경우 : 정상적 매핑
  - 나의 경우엔 별칭은 없었지만 MybatisConfig 를 통해 snake-case -> camelCase 로 매핑되도록 했지만 정상적 매핑이 되지 않았다.
- 모든 필드의 생성자(All Args)가 존재하면 별칭이 없더라도 매핑이 정상 수행(이 방법으로 해결했다)
- No Args, All Args 가 아닌 여러 개의 생성자가 존재하면, 오류가 발생한다(나의 케이스)
- 리플렉션을 사용하기에 필드에 대한 getter/setter 는 필요하지 않다.

### 결국 원인은, 생성자를 제대로 구성하지 않았기 때문이다.
<br>
내가 사용하는 생성자는 All Args 생성자도 아니고, 일부 필드에 대한 생성자였기에 매핑이 정상적으로 수행되지 않은 것이다.

### 생성자가 private 생성자라면?
상관 없다. Mybatis 는 reflection 을 사용하기에 객체를 생성하고 초기화하기 때문이다.
