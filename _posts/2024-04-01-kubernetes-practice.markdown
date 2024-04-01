---
layout: post
title: "쿠버네티스 독학 1"
date: 2024-04-01 22:36:01 +0900
categories: [ 쿠버네티스 ]
---

# Kubernetes

## k3

k3 설치

```shell

curl -sfl https://get.k3s.io | sh -s - --docker -disable=traefix --write-kubeconfig-mode=644

```

쿠버네티스는 컨테이너로 애플리케이션을 실행합니다. 모든 컨테이너는 파드에 속합니다.
쿠버네티스는 컨테이너를 또 다른 가상 환경인 파드로 감쌉니다. 파드는 컴퓨팅의 단위로, 클러스터를 이루는 노드 중 하나에서 실행됩니다.
<br>
파드는 쿠버네티스로 관리되는 자신만의 가상 IP 주소를 가집니다. 하나의 파드에 여러 컨테이너가 있다면, localhost 만을 이용해서 서로 통신할 수도 있습니다.
<br>
쿠버네티스가 직접 컨테이너를 실행하지는 않습니다. 컨테이너를 생성할 책임을 해당 노드에 설치된 컨테이너 런타임에 맡기는 형태입니다. 이 컨테이너 런타임은 도커가 될 수도 있습니다. 파드는 쿠버네티스가 관리하는 리소스고, 컨테이너는 쿠버네티스 외부에서 관리됩니다.

## kubectl

[참고 url](https://kubernetes.io/docs/tasks/tools/install-kubectl-linux/)
```shell

   curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"

```

파드의 컨테이너 개수가 0이 되자마자 쿠버네티스가 즉각적으로 대체 컨테이너를 생성하여 파드를 복원합니다.
쿠버네티스는 컨테이너를 파드로 추상화합니다. 이상을 일으킨 컨테이너는 일시적인 문제이며, 파드는 그대로 있으므로 새로운 컨테이너를 추가하여 파드 상태를 복원하면 됩니다.

```shell

docker container ls -q --fiter label=io.kubernetes.container.name=hello-kiamo1
// 컨테이너 식별

docker container rm ...
// 컨테이너 삭제

```

파드의 상세 정보에서 삭제한 컨테이너가 동작 중임을 확인할 수 있습니다. 식별자가 다른데, 이는 쿠버네티스가 새로운 컨테이너로 파드를 복원했기 때문입니다.
kubectl 에는 네트워크 트래픽을 노드에서 파드로 전달할 수 있는 기능이 있습니다. 이 기능을 사용하면 간편하게 클러스터 외부에서 파드와 통신할 수 있습니다.

```shell

kubectl port-forwad pod/hello-kiamol 8080:80

```
