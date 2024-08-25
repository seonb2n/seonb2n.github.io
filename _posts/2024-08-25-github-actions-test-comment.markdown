---
layout: post
title: "깃헙 workflows 로 테스트 결과를 자동으로 comment 로 남기자"
date: 2024-08-25 13:08:01 +0900
categories: [ Github, CICD ]
---

# 깃헙 workflows 로 테스트 결과를 자동으로 comment 로 남기자

![Desktop View](/assets/img/2024-08-25/2024-08-25-01.png){: width="972" height="589" }

github 에서 pr 을 생성한 후, 테스트 결과를 자동으로 comment 로 남겨줄 수 있도록 actions 를 추가해주자.

## forked repository 가 아닌 경우

forked repository 가 아닌 경우에는 간단하다.

```yaml

# workflow의 이름을 정의한다.
name: 'test-main-and-publish'

# workflow가 언제 동작할지 정의한다.
# 이 workflow의 경우 main, dev branch에 pull_request 이벤트가 발생할 경우 동작한다.
on:
  pull_request:
    branches: [ "main" ]

jobs:
  build:

    runs-on: ubuntu-latest
    permissions:
      contents: read
      checks: write
      pull-requests: write

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Set up JDK 21
        uses: actions/setup-java@v4
        with:
          java-version: '21'
          distribution: 'temurin'

      - name: Add executable permission to gradlew
        run: chmod +x ./gradlew

      - name: Setup Gradle
        uses: gradle/gradle-build-action@v2

      - name: Cache Gradle dependencies
        uses: actions/cache@v3
        with:
          path: |
            ~/.gradle/caches
            ~/.gradle/wrapper
          key: ${{ runner.os }}-gradle-${{ hashFiles('**/*.gradle*', '**/gradle-wrapper.properties') }}
          restore-keys: |
            ${{ runner.os }}-gradle-

      - name: Build with Gradle
        run: ./gradlew build

      - name: Run tests with Gradle
        run: ./gradlew test

      - name: Publish Test Results
        uses: EnricoMi/publish-unit-test-result-action@v2
        if: always()
        with:
          files: |
            build/test-results/test/TEST-*.xml

```

local 에서 build 를 수행하면 build/test-results/test/ 경로에 테스트 결과에 대한 xml 파일이 생성되는 것을 확인할 수 있다.
<br>
동일하게, build 수행 후에, 테스트 결과를 업로드해줄 수 있는 action 을 수행해주면 된다. workflows 로는 https://github.com/EnricoMi/publish-unit-test-result-action 를 택했는데, java 와 junit 을 지원하기 때문이었다.

## forked repository 인 경우

forked repository 인 경우에 위의 workflow 를 수행하면 다음과 같은 에러가 발생한다.

```

2024-08-21 12:52:11 +0000 - publish -  INFO - This action is running on a pull_request event for a fork repository.
Pull request comments and check runs cannot be created, so disabling these features.
To fully run the action on fork repository pull requests,
see https://github.com/EnricoMi/publish-unit-test-result-action/blob/v2.17.0/README.md#support-fork-repositories-and-dependabot-branches

```

에러 메시지에서 제시하는 글을 살펴보면, forked repository 에서 pr 에 대한 comment 를 남기기 위해서는 파일을 업로드한 후, 업로드된 파일을 바탕으로 comment 를 남기도록 구성해야 한다.

### 테스트 수행 후 파일 업로드

```yaml

# workflow의 이름을 정의한다.
name: 'test-main-and-upload'

# workflow가 언제 동작할지 정의한다.
# 이 workflow의 경우 main, dev branch에 pull_request 이벤트가 발생할 경우 동작한다.
on:
  pull_request:
    branches: [ "main" ]

jobs:
  build:

    runs-on: ubuntu-latest
    permissions:
      contents: read
      checks: write
      pull-requests: write

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Set up JDK 21
        uses: actions/setup-java@v4
        with:
          java-version: '21'
          distribution: 'temurin'

      - name: Add executable permission to gradlew
        run: chmod +x ./gradlew

      - name: Setup Gradle
        uses: gradle/gradle-build-action@v2

      - name: Cache Gradle dependencies
        uses: actions/cache@v3
        with:
          path: |
            ~/.gradle/caches
            ~/.gradle/wrapper
          key: ${{ runner.os }}-gradle-${{ hashFiles('**/*.gradle*', '**/gradle-wrapper.properties') }}
          restore-keys: |
            ${{ runner.os }}-gradle-

      - name: Build with Gradle
        run: ./gradlew build

      - name: Run tests with Gradle
        run: ./gradlew test

      - name: Upload Test Results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: Test Results
          path: |
            build/test-results/test/TEST-*.xml


```

## 업로드된 artifact 로 comment 게시

```yaml

name: PUBLISH_TEST

on:
  workflow_run:
    workflows: [ "test-main-and-upload" ]
    types:
      - completed

jobs:
  test-results:
    name: Test Results
    runs-on: ubuntu-latest
    if: github.event.workflow_run.conclusion == 'success'

    permissions:
      checks: write

      # needed unless run with comment_mode: off
      pull-requests: write

      # only needed for private repository
      contents: read

      # only needed for private repository
      issues: read

      # required by download step to access artifacts API
      actions: read

    steps:
      - name: Download and Extract Artifacts
        uses: dawidd6/action-download-artifact@e7466d1a7587ed14867642c2ca74b5bcc1e19a2d
        with:
          run_id: ${{ github.event.workflow_run.id }}
          path: artifacts

      - name: Publish Test Results
        uses: EnricoMi/publish-unit-test-result-action@v2
        with:
          commit: ${{ github.event.workflow_run.head_sha }}
          event_file: artifacts/Event File/event.json
          event_name: ${{ github.event.workflow_run.event }}
          files: "artifacts/**/*.xml"


```

