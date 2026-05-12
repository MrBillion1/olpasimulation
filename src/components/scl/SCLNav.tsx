import { Link, useLocation } from 'react-router-dom';

export default function SCLNav() {
  const loc = useLocation();
  const onSCL = loc.pathname.startsWith('/scl');
  return (
    <div className="flex items-center gap-1.5 text-[10px] font-semibold">
      <Link
        to="/"
        className={`px-3 py-1.5 rounded transition-all ${
          !onSCL ? 'bg-gold text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'
        }`}
      >
        Terminal
      </Link>
      <Link
        to="/scl"
        className={`px-3 py-1.5 rounded transition-all ${
          onSCL ? 'bg-gold text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'
        }`}
      >
        SCL <span className="opacity-60 ml-0.5">conviction</span>
      </Link>
    </div>
  );
}
