import React, { useState } from "react";

export default function Login({ onSignUp, onLogin }) {
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [stayLoggedIn, setStayLoggedIn] = useState(true);
  const [loading, setLoading] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    if (!name.trim() || !password.trim()) {
      alert("이름과 비밀번호를 입력하세요.");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/.netlify/functions/supabase_proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          table: "users",
          action: "login",
          name,
          password,
        }),
      });
      const result = await response.json();
      if (response.ok && result.status === "success") {
        storeUser(result.user.id, result.user.name, stayLoggedIn);
        onLogin(result.user);
      } else if (response.ok && result.status === "not_found") {
        alert("사용자를 찾을 수 없습니다. 회원가입을 해주세요.");
      } else if (response.ok && result.status === "wrong_password") {
        alert("비밀번호가 올바르지 않습니다.");
      } else {
        alert("로그인할 수 없습니다.");
      }
    } finally {
      setLoading(false);
    }
  }

  function storeUser(id, name, persist) {
    const storage = persist ? localStorage : sessionStorage;
    storage.setItem("user_id", id);
    storage.setItem("user_name", name);
  }

  return (
    <div className="box">
      <h2>로그인</h2>
      <form onSubmit={handleLogin}>
        <input
          type="text"
          placeholder="이름 입력"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          type="password"
          placeholder="비밀번호 입력"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <div className="checkbox-row">
          <input
            type="checkbox"
            id="stayLoggedIn"
            checked={stayLoggedIn}
            onChange={(e) => setStayLoggedIn(e.target.checked)}
          />
          <label htmlFor="stayLoggedIn">로그인 상태 유지</label>
        </div>
        <button type="submit" disabled={loading}>
          {loading ? "로그인 중..." : "로그인"}
        </button>
        <button
          type="button"
          onClick={onSignUp}
          style={{
            background: "none",
            border: "none",
            color: "#2e2a3c",
            marginTop: 0,
          }}
        >
          회원가입
        </button>
      </form>
    </div>
  );
}