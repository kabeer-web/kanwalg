const VARIANTS = {
  primary: 'bg-accent hover:bg-accent-hover text-white',
  success: 'bg-success text-black hover:brightness-110',
  danger: 'bg-danger text-white hover:brightness-110',
  ghost: 'bg-white/5 hover:bg-white/10 text-text-primary border border-border',
  outline: 'bg-transparent border border-border-strong hover:bg-white/5 text-text-primary',
};
const SIZES = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2.5 text-sm',
  lg: 'px-6 py-3.5 text-base',
};

export default function Button({ variant = 'primary', size = 'md', className = '', children, ...props }) {
  return (
    <button
      className={`rounded-md font-semibold transition-fast active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
