import axios from "axios";
const api_url=import.meta.env.VITE_API;

console.log(api_url)
const api = axios.create({
  baseURL: api_url,   // your backend URL
  timeout: 10000,                     // optional
  headers: {
    "Content-Type": "application/json",
  },
});

export default api;
