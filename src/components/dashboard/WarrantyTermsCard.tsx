import { WARRANTY_TERMS } from '@/data/warrantyTerms'
import { SHOP_PROFILE } from '@/data/shopProfile'

export function WarrantyTermsCard({ collapsible, defaultOpen }: { collapsible?: boolean; defaultOpen?: boolean }) {
  const content = (
    <div className={collapsible ? 'mt-4' : ''}>
      {WARRANTY_TERMS.map((section, idx) => (
        <div key={idx} className="mb-4 last:mb-0">
          <h4 className="font-semibold text-foreground">{section.title}</h4>
          {section.text && <p className="mt-1 text-muted-foreground">{section.text}</p>}
          {section.bullets && (
            <ul className="mt-1 list-disc pl-5 text-muted-foreground">
              {section.bullets.map((bullet, i) => (
                <li key={i}>{bullet}</li>
              ))}
            </ul>
          )}
        </div>
      ))}
      <div className="mt-4 border-t pt-3 text-xs text-muted-foreground">
        Questions? {SHOP_PROFILE.name}, {SHOP_PROFILE.phones.join(' / ')}
      </div>
    </div>
  )

  if (collapsible) {
    return (
      <details className="rounded-xl border bg-card p-4 text-sm" open={defaultOpen}>
        <summary className="cursor-pointer font-semibold text-foreground">Warranty terms</summary>
        {content}
      </details>
    )
  }

  return (
    <div className="rounded-xl border bg-card p-4 text-sm">
      <h3 className="mb-4 font-semibold text-foreground">Warranty terms</h3>
      {content}
    </div>
  )
}
