/** A catalog price: the amount is what the eye looks for, the token is its unit. */
export function UsdcPrice({ price, large = false, className = '' }: { price: string; large?: boolean; className?: string }) {
  return (
    <span className={`block ${className}`}>
      <span className={`font-semibold ${large ? 'text-3xl' : 'text-xl'}`}>{price}</span>{' '}
      <span className="text-xs text-zinc-600">USDC</span>
    </span>
  );
}
