---
layout: post
title: "MobX 정리"
date: 2024-02-16 21:03:01 +0900
categories: [ FrontEnd, MobX ]
---

# MobX

> https://ko.mobx.js.org/README.html

MobX 는 action 이 state 를 변경하는 단방향 데이터 흐름을 사용하며, 영향을 받는 모든 View 를 업데이트한다.

![Desktop View](/assets/img/2024-02-16/mobx.png){: width="972" height="589" }

**MobX Core**

- Observable : state 의 변화를 감시하여, state 를 저장 및 추적한다.
- Action : state 를 수정하는 메서드
- Computed : state 의 변화로 인해 계산된 값. 일종의 캐싱으로 생각하면 된다. 내부에서 사용하는 state 가 변경되었을때만 새로 계산해서 계산값을 저장해놓고 사용한다.
- Reaction : observable state 를 변경하면 그에 따른 파생값(computed)이 계산된다. 파생값을 사용하는 컴포넌트를 변경하는 Reaction 작업이 일어난다.

1. **상태(state)**
- 앱을 구동하는 데이터
- 변경하려는 속성을 추적하기 위해 observable 로 표시되어야 함
  - mobx 라이브러리의 useObserver 함수는 리액트의 useState 를 사용한다. forceUpdate 를 통해, 컴포넌트의 첫 마운트 시, observable 변경 발생 시 이 함수를 실행하여 리렌더링을 수행한다.
2. **동작(action)**
- 사용자 이벤트, BE 데이터 푸시 등과 같이 state 를 변경하는 로직
- observable 을 변경하는 코드는 action 으로 표시되어야 한다.
3. **파생(derivation)**
- state 에서 유도된 ‘객체’
  - 반응 함수를 의미한다.

**React Observer HOC**

- observer 함수를 이용하여 컴포넌트를 감싸서 반응형으로 만들 수 있음
- HOC 란 리액트 컴포넌트를 인자로 받아서 새로운 리액트 컴포넌트를 반환함

```javascript
import * as React from "react"
import { render } from "react-dom"
import { observer } from "mobx-react-lite"

const TodoListView = observer(({ todoList }) => (
    <div>
        <ul>
            {todoList.todos.map(todo => (
                <TodoView todo={todo} key={todo.id} />
            ))}
        </ul>
        Tasks left: {todoList.unfinishedTodoCount}
    </div>
))

const TodoView = observer(({ todo }) => (
    <li>
        <input type="checkbox" checked={todo.finished} onClick={() => todo.toggle()} />
        {todo.title}
    </li>
))

const store = new TodoList([new Todo("Get Coffee"), new Todo("Write simpler code")])
render(<TodoListView todoList={store} />, document.getElementById("root"))
```

observer 를 이용해서 derivation 을 적용한 예시 코드.
<br><span>
TodoListView 는 todoList 의 상태를 관찰하고, TodoView 는 todo 의 상태를 관찰한다. 이렇게 observable 한 state 는 Derivation 인 것이다. todoList.unfinishedTodoCount 는 todoList 의 상태를 기반으로 계산됐고, computed 로 취급된다.

**클래식 MVC 패턴을 적용해보자**

**스토어**

- 컴포넌트의 로직과 state 를 독립적으로 테스트할 수 있는 단위로 만드는 것
- 도메인 state 저장소와 ui state 저장소가 있어야 한다
  - 도메인 스토어 : 애플리케이션의 모든 데이터가 저장되는 곳
  - 도메인 객체 : 도메인 객체는 자체 클래스를 사용하여 표현해야 한다.

**도메인 스토어**
```javascript
import { makeAutoObservable, autorun, runInAction } from "mobx"
import uuid from "node-uuid"

export interface Todo {
    id : number;
    content : string;
    checked : boolean;
}

export class TodoStore {
    authorStore // 작성자 확인 스토어
    transportLayer // 서버 요청 레이어
    todos = Todo[]
    isLoading = true

    constructor(transportLayer, authorStore) {
        makeAutoObservable(this) // 객체를 observable 로 만든다.
        this.authorStore = authorStore
        this.transportLayer = transportLayer
        this.transportLayer.onReceiveTodoUpdate(updatedTodo =>
            this.updateTodoFromServer(updatedTodo)
        )
        this.loadTodos()
    }

    // 서버에서 모든 todo를 가져옵니다.
    loadTodos() {
        this.isLoading = true
        this.transportLayer.fetchTodos().then(fetchedTodos => {
            runInAction(() => {
                fetchedTodos.forEach(json => this.updateTodoFromServer(json))
                this.isLoading = false
            })
        })
    }

    // 서버의 정보로 Todo를 업데이트합니다. Todo가 한 번만 존재함을 보장합니다.
    // 새로운 Todo를 생성하거나 기존 Todo를 업데이트하거나
    // 서버에서 삭제된 Todo를 제거할 수 있습니다.
    updateTodoFromServer(json) {
        let todo = this.todos.find(todo => todo.id === json.id)
        if (!todo) {
            todo = new Todo(this, json.id)
            this.todos.push(todo)
        }
        if (json.isDeleted) {
            this.removeTodo(todo)
        } else {
            todo.updateFromJson(json)
        }
    }

    // 클라이언트와 서버에 새로운 Todo를 생성합니다.
    createTodo() {
        const todo = new Todo(this)
        this.todos.push(todo) // 상태를 조작할 때 객체 불변성을 지킬 필요 없다. mobx 에서 상태의 변화를 자동으로 감지한다.
        return todo
    }

    // Todo가 어떻게든 삭제되었을 때 클라이언트 메모리에서 삭제합니다.
    removeTodo(todo) {
        this.todos.splice(this.todos.indexOf(todo), 1)
        todo.dispose()
    }
}
// 객체를 생성하고, 생성된 객체를 export 한다
export const todoStore = new TodoStore();
```

**컴포넌트**

```javascript
import { observer } from 'mobx-react-lite';
import { todoStore } from './CreditManageStore';

export const TodoListPage = observer(() => {
    const { todos, loadTodos, createTodo, removeTodo } = todoStore;
  	...
})
```

