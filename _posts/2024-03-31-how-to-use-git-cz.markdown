---
layout: post
title: "git cz 를 적용해서 commit message 를 관리해보자"
date: 2024-03-31 11:36:01 +0900
categories: [ git-cz ]
---

# git -cz

![Desktop View](/assets/img/2024-03-31/2024-03-31-git-cz.png){: width="972" height="589" }

프로젝트를 진행하다보면 commit message 관리의 필요성을 느낍니다. git-cz 를 활용해서 커밋 메시지를 카테고리화하고, 가독성을 높여봅시다.
<br><span>
[git-cz github](https://github.com/streamich/git-cz)
<br><span>
본인의 환경은 윈도우이며 로컬에 설치된 node 는 18.17 입니다.
```shell

> node -v
> v18.17.0

```

1. git-cz 를 설치해줍니다.

```shell

npm install -g commitizen

npm install -g cz-conventional-changelog

echo '{"path" : "cz-conventional-changelog"}' > ~/.czrc


```

저의 경우에는 마지막 코드를 실행한 후, git cz 커맨드 실행시 이런 에러가 발생했습니다.

```shell

The config file at "C:\Users\seonbin\.czrc" contains invalid charset, expect utf8

```

파일을 직접 찾아서 editor 로 utf-8 로 변환해줍니다.
![Desktop View](/assets/img/2024-03-31/2024-03-31-encoding.png){: width="972" height="589" }

2. 이제, 프로젝트 directory 에서 다음 명령어를 실행하면 git-cz 를 사용하실 수 있습니다.

```shell

git init

git add .

git cz

```

3. 만약 emoji 를 추가하고 싶다면 emoji 를 추가해주면 됩니다.

```shell

npm install -g cz-emoji-conventional cz-emoji

```

그리고, 아까 열었던 .czrc 파일도 수정해줍니다.

```shell

{
  "path": "cz-emoji-conventional"
}

```

이제 git-cz 커맨드를 입력하시면 이모지가 추가된 prefix 를 확인하실 수 있으실 겁니다.
<br><span>
git-cz 를 사용하면 단일 커밋에 대한 가독성이 좋을 뿐 아니라, 함께 프로젝트를 진행하는 입장에서도 mr 의 성격을 파악하기 좋습니다.
