import { Link } from 'react-router-dom';

/**
 * Страница 404
 */
export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">404</h1>
        <p className="text-xl mb-4">Страница не найдена</p>
        <Link to="/" className="text-primary hover:underline">
          Вернуться на главную
        </Link>
      </div>
    </div>
  );
}

