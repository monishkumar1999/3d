import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axios";

export const Logins = () => {
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleLogin = async () => {
    try {
      const response = await api.post("/admin/login", {
        name,
        password,
      });

      console.log("Login Success:", response.data);
      if (response.data.success) {
        navigate("/categories");
      }
    } catch (error) {
      console.error("Login Error:", error);
      setError(error.response?.data?.message || "Login failed");
    }
  };

  return (
    <div className="text-center justify-center">

      <div className="mt-4 flex flex-col gap-3 w-70">
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <input
          type="text"
          placeholder="Username"
          className="border border-blue-400 shadow shadow-gray-500 p-2 rounded"
          onChange={(e) => setName(e.target.value)}
        />

        <input
          type="password"
          placeholder="Password"
          className="border border-blue-400 shadow shadow-gray-500 p-2 rounded"
          onChange={(e) => setPassword(e.target.value)}
        />

        <button
          className="border border-pink-400 bg-gray-100 rounded-2xl w-40 hover:bg-white hover:cursor-pointer p-2 mx-auto"
          onClick={handleLogin}
        >
          Login
        </button>
      </div>

    </div>
  );
};
