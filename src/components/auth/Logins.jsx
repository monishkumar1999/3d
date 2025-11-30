import { useState } from "react";
import api from "../../api/axios";

export const Logins = () => {
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async () => {
    try {
      console.log("login clicked");

      const response = await api.get("/admin/login", {
        name,
        password,
      });

      console.log("API Response:", response.data);

    } catch (error) {
      console.log("Login Error:", error);
    }
  };

  return (
    <div className="text-center justify-center">

      <div className="mt-4 flex flex-col gap-3 w-70">
        <input
          type="text"
          className="border border-blue-400 shadow shadow-gray-500 p-2"
          onChange={(e) => setName(e.target.value)}
        />

        <input
          type="password"
          className="border border-blue-400 shadow shadow-gray-500 p-2"
          onChange={(e) => setPassword(e.target.value)}
        />

        <button
          className="border border-pink-400 bg-gray-100 rounded-2xl w-40 hover:bg-white hover:cursor-pointer p-2"
          onClick={handleLogin}
        >
          Login
        </button>
      </div>

    </div>
  );
};
