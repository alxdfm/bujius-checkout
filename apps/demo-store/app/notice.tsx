import Link from 'next/link';

/** A state with one sentence and one way out. */
export function Notice({
  title,
  text,
  href = '/',
  action = 'Back to the store',
}: {
  title: string;
  text: string;
  href?: string;
  action?: string;
}) {
  return (
    <>
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="mt-2 text-zinc-600">{text}</p>
      <Link
        href={href}
        className="mt-6 inline-block rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700"
      >
        {action}
      </Link>
    </>
  );
}
