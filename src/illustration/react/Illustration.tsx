import { useMemo, type CSSProperties } from 'react'
import { renderIllustration, type IllustrationOptions } from '../render'

export type IllustrationProps = IllustrationOptions & {
  className?: string
  style?: CSSProperties
}

/**
 * React wrapper. The SVG is injected as markup because it is exactly the
 * same string that gets downloaded: there are no two renderers to drift apart.
 *
 * The memoization key includes all the options. They used to be listed by hand
 * and `format` and `registration` were left out: the studio always showed the
 * plate and the registration control did nothing.
 */
export function Illustration({ className, style, ...options }: IllustrationProps) {
  const key = [
    options.seed,
    options.subject,
    typeof options.palette === 'string' ? options.palette : JSON.stringify(options.palette),
    options.format ?? '',
    options.registration ?? '',
    options.animate === false ? '0' : '1',
    options.grain === false ? '0' : '1',
    options.paper === false ? '0' : '1',
    options.colors ?? '',
    options.displayWidth ?? '',
    options.growth ?? '',
  ].join('|')

  const svg = useMemo(() => renderIllustration(options), [key])

  return (
    <div
      className={['bi-fit', className].filter(Boolean).join(' ')}
      style={style}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}

/** Historical alias: the engine is no longer just botanical. */
export const Botanical = Illustration
