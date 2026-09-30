import axios from 'axios';

export const api = axios.create({
  baseURL: 'https://api.example.com',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Add interceptors here as needed
