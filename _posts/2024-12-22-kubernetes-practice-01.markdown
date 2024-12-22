---
layout: post
title: "24 단계 실습으로 정복하는 쿠버네티스 01"
date: 2024-12-22 13:23:01 +0900
categories: [ 쿠버네티스, 책 ]
---

---

# 24 단계 실습으로 정복하는 쿠버네티스 01

> 아티클의 넘버링은 실습 단계와는 무관합니다. 다음 이슈에 따라서 2편이 연재될 수도 있고 아닐 수도 있습니다.

## 환경 구축

저는 윈도우 환경에서 해당 실습을 진행할 예정입니다. 실습을 위해서는 3개의 가상 환경이 필요한데요, 이 3개의 가상 환경을 만들기 위해서 VirtualBox 를 사용했습니다.
<br> 그런데 찾다보니, virtualBox 에서 수동으로 환경 설정을 하기보다 vagrant 를 활용하여 명령형으로 가상 환경을 생성할 수 있는 방법이 있었습니다. 다음과 같은 커맨드였는데요.

```shell

# -*- mode: ruby -*-
# vi: set ft=ruby :

Vagrant.configure("2") do |config|
  # 공통 VM 설정
  config.vm.box = "ubuntu/jammy64"
  config.vm.box_check_update = false

  # 공통 프로비저닝: sshpass 설치
  config.vm.provision "shell", inline: "sudo apt-get update && sudo apt-get install -y sshpass"

  # k8s-master1 노드 설정
  config.vm.define "k8s-master1" do |master1|
    master1.vm.hostname = "k8s-master1"
    master1.vm.network "private_network", ip: "192.168.56.10"
    master1.vm.provider "virtualbox" do |vb|
      vb.memory = "4096"
      vb.cpus = 2
      vb.name = "k8s-master1"
    end
  end

  # k8s-master2 노드 설정
  config.vm.define "k8s-master2" do |master2|
    master2.vm.hostname = "k8s-master2"
    master2.vm.network "private_network", ip: "192.168.56.11"
    master2.vm.provider "virtualbox" do |vb|
      vb.memory = "4096"
      vb.cpus = 2
      vb.name = "k8s-master2"
    end
  end

  # k8s-master3 노드 설정
  config.vm.define "k8s-master3" do |master3|
    master3.vm.hostname = "k8s-master3"
    master3.vm.network "private_network", ip: "192.168.56.12"
    master3.vm.provider "virtualbox" do |vb|
      vb.memory = "4096"
      vb.cpus = 2
      vb.name = "k8s-master3"
    end
  end
end

```

이렇게 설정을 해주니 각 노드간에 ssh 접속이 안됐습니다. 이런 에러가 발생하더라고요.

```shell


vagrant@k8s-master:~/kubespray$ ssh vagrant@192.168.56.11

The authenticity of host 'localhost (127.0.0.1)' can't be established.
ED25519 key fingerprint is SHA256:c4OZWQX2/YoUU82y3YWMsfa0Dn/cQ1vG0f4lnOIxtQc.
This host key is known by the following other names/addresses:
    ~/.ssh/known_hosts:1: [hashed name]
Are you sure you want to continue connecting (yes/no/[fingerprint])? yes

vagrant@localhost: Permission denied (publickey).

```

설정을 위해서는 다음과 같이 vagrant script 를 변경해줬습니다 ~~여기까지 오는데 2시간 걸렸습니다..~~

```shell

# -*- mode: ruby -*-
# vi: set ft=ruby :

# SSH 설정 스크립트
$ssh_setup = <<-SCRIPT
#!/bin/bash

# SSH 키 생성
if [ ! -f /home/vagrant/.ssh/id_rsa ]; then
  ssh-keygen -t rsa -b 4096 -N "" -f /home/vagrant/.ssh/id_rsa
fi

# SSH 설정 디렉토리와 파일 생성
mkdir -p /home/vagrant/.ssh
touch /home/vagrant/.ssh/authorized_keys
chmod 700 /home/vagrant/.ssh
chmod 600 /home/vagrant/.ssh/authorized_keys

# sshd_config.d 디렉토리의 기존 설정 파일들 제거
sudo rm -f /etc/ssh/sshd_config.d/*

# 새로운 SSH 설정 추가
sudo tee /etc/ssh/sshd_config.d/custom.conf <<EOF
PasswordAuthentication yes
PubkeyAuthentication yes
UsePAM yes
EOF

# SSH 서비스 재시작
sudo systemctl restart sshd

# known_hosts 파일 설정
cat > /home/vagrant/.ssh/config <<EOF
Host *
    StrictHostKeyChecking no
    UserKnownHostsFile=/dev/null
EOF
chmod 600 /home/vagrant/.ssh/config
chown -R vagrant:vagrant /home/vagrant/.ssh

# hosts 파일 설정
cat >> /etc/hosts <<EOF
192.168.56.10 k8s-master1
192.168.56.11 k8s-master2
192.168.56.12 k8s-master3
EOF

# vagrant 사용자 패스워드 설정
echo "vagrant:vagrant" | sudo chpasswd
SCRIPT

# 공개키 복사 스크립트
$copy_ssh_keys = <<-SCRIPT
# 로깅 설정
exec 1> >(logger -s -t $(basename $0)) 2>&1

# SSH 서비스가 완전히 시작될 때까지 대기
sleep 30

# 현재 호스트의 공개키
PUB_KEY=$(cat /home/vagrant/.ssh/id_rsa.pub)

# 다른 노드의 공개키를 authorized_keys에 추가
for ip in 192.168.56.10 192.168.56.11 192.168.56.12; do
  if [ "$(hostname -I | grep -o "$ip")" = "" ]; then
    echo "Copying SSH key to $ip"
    sshpass -p "vagrant" ssh-copy-id -o StrictHostKeyChecking=no vagrant@$ip || echo "Failed to copy key to $ip"
  fi
done
SCRIPT

Vagrant.configure("2") do |config|
  # 공통 VM 설정
  config.vm.box = "ubuntu/jammy64"
  config.vm.box_check_update = false

  # 공통 프로비저닝: sshpass 설치
  config.vm.provision "shell", inline: "sudo apt-get update && sudo apt-get install -y sshpass"

  # k8s-master1 노드 설정
  config.vm.define "k8s-master1" do |master1|
    master1.vm.hostname = "k8s-master1"
    master1.vm.network "private_network", ip: "192.168.56.10"
    master1.vm.provider "virtualbox" do |vb|
      vb.memory = "4096"
      vb.cpus = 2
      vb.name = "k8s-master1"
    end
    master1.vm.provision "shell", inline: $ssh_setup
    master1.vm.provision "shell", inline: $copy_ssh_keys, run: "always"
  end

  # k8s-master2 노드 설정
  config.vm.define "k8s-master2" do |master2|
    master2.vm.hostname = "k8s-master2"
    master2.vm.network "private_network", ip: "192.168.56.11"
    master2.vm.provider "virtualbox" do |vb|
      vb.memory = "4096"
      vb.cpus = 2
      vb.name = "k8s-master2"
    end
    master2.vm.provision "shell", inline: $ssh_setup
    master2.vm.provision "shell", inline: $copy_ssh_keys, run: "always"
  end

  # k8s-master3 노드 설정
  config.vm.define "k8s-master3" do |master3|
    master3.vm.hostname = "k8s-master3"
    master3.vm.network "private_network", ip: "192.168.56.12"
    master3.vm.provider "virtualbox" do |vb|
      vb.memory = "4096"
      vb.cpus = 2
      vb.name = "k8s-master3"
    end
    master3.vm.provision "shell", inline: $ssh_setup
    master3.vm.provision "shell", inline: $copy_ssh_keys, run: "always"
  end
end

```

두 개의 스크립트를 넣고, public 접근을 허용해줬습니다. ssh_setup script 로 각 노드마다 ssh 키를 생성해줬고, copy_ssh_keys 스크립트로 자신의 public key 를 다른 모든 노드의 authorized_keys 파일에 복사했습니다.

<br/> 이후에, hosts.yml 설정을 다음과 같이 해줬습니다.

```yaml

all:
  hosts:
    k8s-master1:
      ansible_host: 192.168.56.10
      ip: 192.168.56.10
      access_ip: 192.168.56.10
      ansible_user: vagrant
      ansible_ssh_pass: vagrant
      ansible_become_pass: vagrant
      ansible_ssh_private_key_file: /home/vagrant/.ssh/id_rsa
    k8s-master2:
      ansible_host: 192.168.56.11
      ip: 192.168.56.11
      access_ip: 192.168.56.11
      ansible_user: vagrant
      ansible_ssh_pass: vagrant
      ansible_become_pass: vagrant
      ansible_ssh_private_key_file: /home/vagrant/.ssh/id_rsa
    k8s-master3:
      ansible_host: 192.168.56.12
      ip: 192.168.56.12
      access_ip: 192.168.56.12
      ansible_user: vagrant
      ansible_ssh_pass: vagrant
      ansible_become_pass: vagrant
      ansible_ssh_private_key_file: /home/vagrant/.ssh/id_rsa
  vars:
    ansible_ssh_common_args: '-o StrictHostKeyChecking=no'
  children:
    kube_control_plane:
      hosts:
        k8s-master1:
        k8s-master2:
        k8s-master3:
    kube_node:
      hosts:
        k8s-master1:
        k8s-master2:
        k8s-master3:
    etcd:
      hosts:
        k8s-master1:
        k8s-master2:
        k8s-master3:
    k8s_cluster:
      children:
        kube_control_plane:
        kube_node:
    calico_rr:
      hosts: {}

```

ansible 로 ping 을 날려본 결과 노드간 접속이 허용됨을 확인할 수 있습니다.


```shell

ansible all -i inventory/mycluster/hosts.yml -m ping

```

![Desktop View](/assets/img/2024-12-22/24-12-22-01.png){: width="972" height="589" }

