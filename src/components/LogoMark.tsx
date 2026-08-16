// BetaHealth mark: the score ring, open toward the top-right, around a rising
// delta. The product in one glyph: your score, moving up.
export default function LogoMark({ className = 'w-8 h-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
      <path d="M27 16A11 11 0 1 1 16 5" stroke="#0D9488" strokeWidth="3.6" strokeLinecap="round" />
      <path d="M16 11.8L20 18.6H12Z" fill="#0D9488" stroke="#0D9488" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}
