import React, { useState } from "react";

export default function SignUp({ onLogin, onBack }) {
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [stayLoggedIn, setStayLoggedIn] = useState(true);
  const [loading, setLoading] = useState(false);

  async function handleSignUp(e) {
    e.preventDefault();
    if (!name.trim() || !password.trim()) {
      alert("이름과 비밀번호를 입력하세요.");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/.netlify/functions/auth_user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, password }),
      });
      const result = await response.json();
      if (response.ok && result.status === "created") {
        storeUser(result.user.id, result.user.name, stayLoggedIn);
        onLogin(result.user);
      } else if (response.ok && result.status === "name_taken") {
        alert("이 이름은 이미 사용 중입니다. 다른 이름을 입력해 주세요.");
      } else {
        alert("계정을 생성할 수 없습니다.");
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
      <h2>회원가입</h2>
      <form onSubmit={handleSignUp}>
        <input
          type="text"
          placeholder="이름 입력"
          value={name}
          onChange={e => setName(e.target.value)}
        />
        <input
          type="password"
          placeholder="비밀번호 입력"
          value={password}
          onChange={e => setPassword(e.target.value)}
        />
        <div className="checkbox-row">
          <input
            type="checkbox"
            id="stayLoggedIn"
            checked={stayLoggedIn}
            onChange={e => setStayLoggedIn(e.target.checked)}
          />
          <label htmlFor="stayLoggedIn">로그인 상태 유지</label>
        </div>
        <button type="submit" disabled={loading}>
          {loading ? "가입 중..." : "회원가입"}
        </button>
        <button type="button" onClick={onBack} style={{ background: "none", border: "none", color: "#2e2a3c", marginTop: 0 }}>
          돌아가기
        </button>
      </form>
    </div>
  );
}