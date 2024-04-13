---
layout: post
title: "JPA 와 엔티티 데이터"
date: 2024-04-13 11:57:01 +0900
categories: [ JPA ]
---

# JPA 와 엔티티 데이터

## 명시되지 않은 @Access

JPA 가 엔티티 데이터에 접근하는 방식을 지정하기 위해서는 @Access 를 사용할 수 있습니다. Access 어노테이션에는 두 가지 옵션이 있는데, 필드 접근을 위한 FIELD
와 프로퍼티 접근을 위한 PROPERTY 가 있습니다.
<br>
@Access 를 명시적으로 사용하지 않는 경우엔, ID 어노테이션을 기준으로 접근 방식을 결정합니다.

```java

@Entity
public class Member {

  @Id
  private Long id;
}

```

### private 프로퍼티를 JPA 가 접근할 수 있는 이유

아이디가 필드에 있기 때문에 필드 접근 방식을 사용한 것과 동일합니다. 즉, JPA 는 member.id 로 필드 접근을 한다는 의미입니다. 그렇다면 여기서 의문이 생기는데,
JPA private 필드인 id 에 어떻게 필드 접근을 할까요?
<br>
예상하셨다시피, reflection 을 사용해서 JPA 는 프리이빗 필드에 접근한다고 합니다.

```java

Member member=new Member();
  // 리플렉션을 사용하여 id 필드에 접근
  Field idField=Member.class.getDeclaredField("id");
  idField.setAccessible(true); // private 필드에 접근할 수 있도록 설정
  // id 값 설정
  idField.set(member,123L);
  System.out.println("Member id: "+member.getId());

```

이러한 형태로 private 으로 생성된 필드에 대해서도 값을 할당할 수 있을 것입니다. 이와 관련해서 stackoverflow 의 글들을 살펴봤습니다.
<br>

[JPA 에서 getter setter 가 없이도 private field 에 접근하는 방법](https://stackoverflow.com/questions/38002366/how-does-a-jpa-provider-access-private-field-values-when-no-getter-setter-meth)
<br/>
답변을 보면 이런 내용이 나옵니다.
> The term directly refers to an access strategy which allows the manipulation of an object's
> field (value) without the need to use getter/setter methods. In Java and for most OR-mappers (at
> least the ones I know of) this is achieved via Introspection - using the Java Reflection API. This
> way, classes' fields can be inspected for and manipulated to hold/represent data values from the (
> relational) database entries (i.e., their respective columns).

JPA 명세 상, 직접 접근 방식은 객체의 필드에 대한 조작을 통해서 달성된다고 합니다. 흔히들 (java reflection api 를 사용하는) introspection 이라고
부르는 방법입니다.
<br>
intr
ospection 은 runtime 에서 클래스의 정보나 메소드, 필드를 검출하기 위해서 사용하는 방법입니다. 자세한 내용은 하단의 문서를 살펴보시면 좋을 것 같습니다.
> [introspection java tutorial](https://web.archive.org/web/20090226224821/http://java.sun.com/docs/books/tutorial/javabeans/introspection/index.html)

## @Access(AccessType.PROPERTY)

이 설정을 통해서 프로퍼티 접근 방식을 사용할 수 있습니다. 프로퍼티 접근 방식과 기존의 필드 접근 방식을 모두 사용하는 것도 가능합니다.

## 둘 모두를 적용한 예시

```java

@Entity
public class Member {

  @Id
  private Long id;

  @Transient
  private String firstName;

  @Transient
  private String lastName;

  @Access(AccessType.PROPERTY)
  public String getFullName() {
    return firstName + lastName;
  }
}

```

db 의 컬럼에 있는 fullName 에는 firstName + lastName 이 저장될 것입니다. 위의 예시에서는 fullName 이라는 필드를 별도로 클래스 프로퍼티로
생성하지 않았지만, 추가를 해줘야 합니다. 없는 경우엔 이런 에러가 발생합니다.

```java

For property-based access both setter and getter should be present

```

```java

@Column(name = "real_name")
private String fullName;

```

만약에 이런 경우는 어떻게 될까요?

```java

@Entity
public class Member {

  @Id
  private Long id;

  private String firstName;

  @Access(AccessType.PROPERTY)
  public String getFirstName() {
    return "Mr. " + firstName;
  }
}

```

![Desktop View](/assets/img/2024-04-13/2024-04-13-firstname.png){: width="972" height="589" }
<br />
firstName 의 필드가 Mr. sb 로 들어간 것을 보실 수 있습니다.

```java

Member member=new Member();
  member.setName("kim");
  member.setFirstName("sb");

  Long saveId=memberService.join(member);

  Member foundMember=memberRepository.findById(saveId).get();
  assertEquals("Mr. Mr. sb",member.getFirstName());

```

이렇게 테스트를 해볼 수 있는데, getFirstName 의 경우엔, 실제 firstName 의 Mr. 이 붙은 결과를 반환해주기에 위의 코드와 같은 결과가 나옵니다.
<br>
결론적으로, 우리는 특정 필드에 대해서 조합형으로 사용하기 위해서는 필드를 잘 설계해서 중복되지 않게 결과가 저장되도록 해야 함을 알 수 있습니다.
이런 주의 사항은 stackoverflow 에서 확인할 수 있었습니다.
<br />
[어떻게 AccessType.FILED 와 AccessType.PROPERTY 를 사용할지](https://stackoverflow.com/questions/13874528/what-is-the-purpose-of-accesstype-field-accesstype-property-and-access)
