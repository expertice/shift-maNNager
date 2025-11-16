import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import Cookies from 'js-cookie';
import { parseLocalDate } from '@/utils/dateUtils';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

/**
 * Создание axios instance с базовой конфигурацией
 */
const apiClient: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

/**
 * Интерцептор запросов - добавляет токен авторизации
 */
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = Cookies.get('auth_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

/**
 * Функция для рекурсивного преобразования дат в объекте
 */
function transformDates(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(transformDates);
  }
  
  if (typeof obj === 'object') {
    const transformed: any = {};
    for (const key in obj) {
      if (key === 'startDate' || key === 'endDate' || key === 'createdAt' || key === 'updatedAt' || key === 'birthDate') {
        // Преобразуем строки дат в Date объекты в локальном времени
        if (typeof obj[key] === 'string') {
          transformed[key] = parseLocalDate(obj[key]);
        } else {
          transformed[key] = obj[key];
        }
      } else {
        transformed[key] = transformDates(obj[key]);
      }
    }
    return transformed;
  }
  
  return obj;
}

/**
 * Интерцептор ответов - обрабатывает ошибки и преобразует даты
 */
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    // Преобразуем даты в ответе в локальное время
    if (response.data && response.data.data) {
      response.data.data = transformDates(response.data.data);
    }
    return response;
  },
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      // Токен истек или невалидный - удаляем токен
      Cookies.remove('auth_token');
      window.location.href = '/login';
    }

    // Извлекаем сообщение об ошибке с сервера
    // Приоритет: message > error (код) > стандартное сообщение axios
    const responseData = error.response?.data as any;
    let serverMessage = responseData?.message;
    
    // Если нет message, но есть error (код), проверяем специальные случаи
    if (!serverMessage && responseData?.error) {
      const errorCode = responseData.error;
      
      // Обрабатываем специальные коды ошибок
      if (errorCode === 'INTERNAL_SERVER_ERROR') {
        serverMessage = 'Произошла внутренняя ошибка сервера. Пожалуйста, попробуйте позже или обратитесь к администратору.';
      } else if (typeof errorCode === 'string' && errorCode.includes('Превышен лимит одновременных отпусков')) {
        // Если в коде есть текст об ошибке (старый формат)
        serverMessage = errorCode;
      }
    }
    
    // Если все еще нет сообщения, используем message из responseData или стандартное
    if (!serverMessage) {
      serverMessage = responseData?.message || error.message;
    }
    
    // Обрабатываем специальные случаи по тексту сообщения
    if (serverMessage && typeof serverMessage === 'string') {
      if (serverMessage.includes('Превышен лимит одновременных отпусков')) {
        const detailsMatch = serverMessage.match(/На ([\d.]+) уже (\d+) сотрудников.+максимум (\d+)/);
        if (detailsMatch) {
          const [, date, count, max] = detailsMatch;
          return Promise.reject(
            new Error(
              `Превышен лимит одновременных отпусков на ${date}. В отпуске ${count} человек из максимально допустимых ${max}. Попробуйте выбрать другие даты.`
            )
          );
        }
      }
      
      // Возвращаем понятное сообщение
      return Promise.reject(new Error(serverMessage));
    }

    // Для ошибок без сообщения создаем понятное сообщение
    if (error.response?.status === 500) {
      return Promise.reject(
        new Error('Произошла внутренняя ошибка сервера. Пожалуйста, попробуйте позже или обратитесь к администратору.')
      );
    }

    return Promise.reject(error);
  }
);

export default apiClient;

