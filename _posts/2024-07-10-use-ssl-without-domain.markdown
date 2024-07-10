---
layout: post
title: "domain 없이 EC2 에 SSL 을 적용하기"
date: 2024-07-10 20:48:01 +0900
categories: [ 인프라, AWS ]
---

# domain 없이 EC2 에 SSL 을 적용하기

> 환경 : amazon linux 2

## ec2 inbound group 설정

22번, 443번 port 를 열어줍니다.

![Desktop View](/assets/img/2024-07-10/2024-07-10-inbound.png){: width="972" height="589" }


## caddy 설치

```shell

yum -y install yum-plugin-copr
yum -y copr enable @caddy/caddy epel-7-$(arch)
yum -y install caddy

```

## Caddyfile 설정

Caddyfile 설정을 통해서 reverse_proxy 로 실행중인 was 매핑해줍니다.

```shell

sudo vi /etc/caddy/Caddyfile


```

```shell

<EC2 public IP>.nip.io {
    reverse_proxy localhost:8080
}


```

기존에 존재하던 내용은 삭제하고, 위의 설정을 추가하면 된다. nip.io 를 붙이는 이유는 IP 주소를 도메인 이름으로 자동 변환해주기 위함입니다.

## Caddy 실횅

```shell

caddy run

```

커맨드를 실행하면 인증서를 받아오는 것을 확인할 수 있습니다.

```shell

2024/07/10 12:41:59.795 WARN    Caddyfile input is not formatted; run 'caddy fmt --overwrite' to fix inconsistencies    {"adapter": "caddyfile", "file": "Caddyfile", "line": 15}
2024/07/10 12:41:59.796 INFO    admin   admin endpoint started  {"address": "localhost:2019", "enforce_origin": false, "origins": ["//127.0.0.1:2019", "//localhost:2019", "//[::1]:2019"]}
2024/07/10 12:41:59.796 INFO    http.auto_https server is listening only on the HTTPS port but has no TLS connection policies; adding one to enable TLS {"server_name": "srv0", "https_port": 443}
2024/07/10 12:41:59.796 INFO    http.auto_https enabling automatic HTTP->HTTPS redirects        {"server_name": "srv0"}
2024/07/10 12:41:59.796 INFO    http    enabling HTTP/3 listener        {"addr": ":443"}
2024/07/10 12:41:59.797 INFO    http.log        server running  {"name": "srv0", "protocols": ["h1", "h2", "h3"]}
2024/07/10 12:41:59.797 INFO    http.log        server running  {"name": "remaining_auto_https_redirects", "protocols": ["h1", "h2", "h3"]}
2024/07/10 12:41:59.797 INFO    http    enabling automatic TLS certificate management   {"domains": ["<EC2 public IP>.nip.io"]}
2024/07/10 12:41:59.798 INFO    autosaved config (load with --resume flag)      {"file": "/root/.config/caddy/autosave.json"}
2024/07/10 12:41:59.798 INFO    serving initial configuration
2024/07/10 12:41:59.798 INFO    tls.cache.maintenance   started background certificate maintenance      {"cache": "0xc00027bc00"}
2024/07/10 12:41:59.814 WARN    tls     storage cleaning happened too recently; skipping for now        {"storage": "FileStorage:/root/.local/share/caddy", "instance": "e412ed92-fb3e-4889-9d7a-906b7abcccc6", "try_again": "2024/07/11 12:41:59.814", "try_again_in": 86399.999999011}
2024/07/10 12:41:59.814 INFO    tls     finished cleaning storage units

```

이후에 caddy 를 종료하고, caddy start 커맨드를 사용해서 백그라운드 실행을 할 수 있습니다.

![Desktop View](/assets/img/2024-07-10/2024-07-10-ssl-adjust.png){: width="972" height="589" }
