---
layout: post
title:  "MyBatis 결과 매핑 에러 해결2"
date:   2024-01-20 12:59:57 +0900
categories: MyBatis
---

### Mybatis 사용중, 쿼리 결과가 dto 에 제대로 매핑이 안되는 오류가 발생했다2

이번에도 mismatch 에러다.

> Error instantiating class com.example.springboard.domain.boards.Board with invalid types (int,String,BoardAccessAuthority) or values (1,all_board,1).
> <br><span> Cause: java.lang.IllegalArgumentException: argument type mismatch

Board 객체를 가져올 때, Board 객체의 필드인 AccessAuthority 를 join 해서 가져오도록 하는 과정에서 발생한 에러이다.
<br><span>
코드는 다음과 같다.

```java
package com.example.springboard.domain.boards;

import com.example.springboard.domain.BaseEntity;

public class Board extends BaseEntity {

  private int id;
  private String title;
  private BoardAccessAuthority boardAccessAuthority;

  public Board(int id, String title, BoardAccessAuthority boardAccessAuthority) {
    this.id = id;
    this.title = title;
    this.boardAccessAuthority = boardAccessAuthority;
  }

  static Board of(int id, String title, BoardAccessAuthority boardAccessAuthority) {
    return new Board(id, title, boardAccessAuthority);
  }

  public int getId() {
    return id;
  }

  public String getTitle() {
    return title;
  }

  public BoardAccessAuthority getBoardAccessAuthority() {
    return boardAccessAuthority;
  }

  public void setId(int id) {
    this.id = id;
  }

  public void setTitle(String title) {
    this.title = title;
  }

  public void setBoardAccessAuthority(
    BoardAccessAuthority boardAccessAuthority) {
    this.boardAccessAuthority = boardAccessAuthority;
  }
}


public class BoardAccessAuthority {

  private int id;
  private String accessLevel;

  public BoardAccessAuthority(int id, String accessLevel) {
    this.id = id;
    this.accessLevel = accessLevel;
  }

  static BoardAccessAuthority of(int id, String accessLevel) {
    return new BoardAccessAuthority(id, accessLevel);
  }

  public int getId() {
    return id;
  }

  public String getAccessLevel() {
    return accessLevel;
  }

  public void setAccessLevel(String accessLevel) {
    this.accessLevel = accessLevel;
  }

  public void setId(int id) {
    this.id = id;
  }
}
```

Mapper xml 을 다음과 같이 구성됐다.

```xml
<!DOCTYPE mapper PUBLIC "-//mybatis.org//DTD Mapper 3.0//EN"
  "http://mybatis.org/dtd/mybatis-3-mapper.dtd">
<mapper namespace="com.example.springboard.mapper.BoardMapper">

  <resultMap id="boardAccessAuthorityResultMap"
    type="com.example.springboard.domain.boards.BoardAccessAuthority">
    <result column="board_access_authority_id" property="id"/>
    <result column="access_level" property="accessLevel"/>
  </resultMap>

  <resultMap id="boardResultMap" type="com.example.springboard.domain.boards.Board">
    <result column="title" property="title"/>
    <result column="id" property="id"/>
    <collection property="boardAccessAuthority" resultMap="boardAccessAuthorityResultMap"/>
  </resultMap>

  <select id="findAll" resultMap="boardResultMap">
    SELECT a.id,
    a.title,
    b.id as board_access_authority_id,
    b.access_level
    FROM boards a
    INNER JOIN board_access_authorities b ON a.access_authority_id = b.id
  </select>

</mapper>

```

클래스와 매퍼의 코드에는 문제가 없어보이는데 왜 board 를 찾은 결과가 제대로 dto 에 매핑이 되지 않는걸까
<br><span>

원인은 간단했다. 기본 생성자가 없었기 때문이다.
<br><span>
[앞선 글](https://seonb2n.github.io/posts/mybatis-mapping-error/)에서 살펴봤듯이, 기본 생성자가 없다면 제대로 객체의 생성이 이루어지지 않는다.
<br><span>

혹시라도 join 을 이용해 연관 관계에 있는 객체를 eager fetch 하는 경우 나같은 문제를 겪는 사람은 생성자를 다시 살펴보기 바란다.
