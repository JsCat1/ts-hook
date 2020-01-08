import React, { useState } from 'react';
import { Switch, Link, BrowserRouter as Router, Route, Redirect } from "react-router-dom";
import App from './App';
import { Button, Input } from "antd";

function RouterPage() {
  return (
    <Router>
      <div>
        <ul>
          <li>
            <Link to="/test">主页</Link>
          </li>
          <li>
            <Link to={{pathname: '/app', state: {a: 123}}}>app</Link>
          </li>
          <li>
            <Link to="/home">上传请求</Link>
          </li>
        </ul>
        <Switch>
          <Route path="/app" component={App} />
          <Route path="/home" component={Home} />
          <Route path="/test" component={Test} />
          <Route path="/">
            <Redirect to="/home" />
          </Route>
        </Switch>
      </div>
    </Router>
  )
}

function Test(props) {
  console.log(props);
  return (
    <div>
      我是test页面
    </div>
  )
}

function Home(props) {
  const [user, setUser] = useState();
  const [password, setPassword] = useState();
  const onSubmit = () => {
    fetch('nginx/hscm/login/userLogin', {
      method: 'post',
      credentials: 'include',
      mode: 'cors',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'userNo=' + user + '&pwd=' + password + '&token=vania'
    })
    .then(res => res.json())
    .then(data => {
      console.log(data);
    })
  }
  return (
    <div>
      我是home页面
      <Input onChange={(e) => setUser(e.target.value)} />
      <Input onChange={(e) => setPassword(e.target.value)} />
      <Button 
        onClick={onSubmit} 
        type="primary"
      >跳转到app页面</Button>
    </div>
  )
}

export default RouterPage;