---
layout: post
title:  "Chirpy Jekyll Theme github blog 적용 중 에러 해결"
date:   2024-01-07 12:12:57 +0900
categories: jekyll
---
Chirpy jekyll 테마를 github 적용 중에 다음과 같은 에러가 발생했다.

### 에러 내용

```
* At _site/404.html:1:

  internal script reference /assets/js/dist/commons.min.js does not exist

* At _site/about/index.html:1:

  internal script reference /assets/js/dist/page.min.js does not exist

* At _site/archives/index.html:1:

  internal script reference /assets/js/dist/misc.min.js does not exist

* At _site/categories/index.html:1:

  internal script reference /assets/js/dist/categories.min.js does not exist

* At _site/index.html:1:

  internal script reference /assets/js/dist/home.min.js does not exist

* At _site/tags/index.html:1:

  internal script reference /assets/js/dist/commons.min.js does not exist
```

결국 dist 파일이 존재하지 않았다는 것이다. dist 파일은 npm 을 통해서 생성하면 된다.
<br>
1. 가장 먼저 /assets/js 경로에 dist 디렉토리를 생성하자
<br>
2. .gitignore 에서 /assets/js/dist 를 삭제해서 해당 파일이 repository 에 올라갈 수 있도록 수정하자.
<br>
3. terminal 을 실행하고 다음과 같은 명령어를 수행하자.
```
npm install
npx rollup -c --bundleConfigAsCjs
```
![Desktop View](/assets/img/2024-01-07/2024010701.png){: width="972" height="589" }

이렇게 파일이 생성되면 성공이다.
<br>
이제 해당 파일을 repository 에 올리면 정상적으로 블로그가 구동된다.
