import React, { useState } from "react";
import Login from "./components/login";
import SignUp from "./components/SignUp";

export default function App() {
  const [page, setPage] = useState("login");
  const [user, setUser] = useState(null);

  if (!user) {
    return page === "login" ? (
      <Login onSignUp={() => setPage("signup")} onLogin={setUser} />
    ) : (
      <SignUp onLogin={setUser} onBack={() => setPage("login")} />
    );
  }

  return (
    <div className="box">
      <h2>환영합니다, {user.name}님!</h2>
      <button onClick={() => setUser(null)}>로그아웃</button>
    </div>
  );
}