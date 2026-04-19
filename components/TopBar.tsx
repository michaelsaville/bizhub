import Link from 'next/link'

// Module switcher over to the sister apps. URLs are prod hostnames; in dev
// they obviously won't resolve from inside the container, but the links
// work fine from a browser on the same network.
const MODULES = [
  { name: 'DocHub', href: 'https://dochub.pcc2k.com' },
  { name: 'TicketHub', href: 'https://tickethub.pcc2k.com' },
]

const NAV = [
  { href: '/', label: 'Dashboard' },
  { href: '/opportunities', label: 'Opportunities' },
]

export default function TopBar() {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto max-w-6xl px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/" className="font-bold text-lg text-brand-700">
            BizHub
          </Link>
          <nav className="flex items-center gap-1">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          {MODULES.map((m) => (
            <a
              key={m.name}
              href={m.href}
              className="text-xs font-medium text-slate-500 hover:text-brand-600"
            >
              {m.name} →
            </a>
          ))}
        </div>
      </div>
    </header>
  )
}
