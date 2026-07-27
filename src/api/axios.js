import axios from 'axios';

// Dynamically replace localhost with current window.location.hostname for mobile network access
const getBaseUrl = () => {
    const rawUrl = import.meta.env.VITE_API || 'http://localhost:5000';
    if (typeof window !== 'undefined' && window.location.hostname && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        return rawUrl.replace('localhost', window.location.hostname).replace('127.0.0.1', window.location.hostname);
    }
    return rawUrl;
};

const api = axios.create({
    baseURL: getBaseUrl(),
    withCredentials: true, // Important for cookies
    headers: {
        'Content-Type': 'application/json',
    },
});

export default api;
