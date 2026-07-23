import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6">
      <h1 className="text-2xl font-bold">Page not found</h1>
      <p className="mt-2 text-sm text-gray-600">That page does not exist.</p>
      <Link to="/" className="mt-6 text-sm underline">
        Back to home
      </Link>
    </main>
  );
}
