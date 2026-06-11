import { Helmet } from 'react-helmet-async'

const BASE_URL = 'https://meltedegypt.vip'
const DEFAULT_IMAGE = `${BASE_URL}/og-image.jpg`

export default function SEO({
  title,
  description = 'Premium handcrafted cookies, brownies, cheesecake & tiramisu. Fresh baked to order and delivered in Cairo & Giza.',
  image = DEFAULT_IMAGE,
  path = '',
  type = 'website',
  jsonLd = null,
}) {
  const fullTitle = title ? `${title} — Melted Egypt` : 'Melted Egypt — Made to Melt Hearts'
  const url = `${BASE_URL}${path}`

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />

      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content={type} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={image} />

      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />

      {jsonLd && (
        <script type="application/ld+json">
          {JSON.stringify(jsonLd)}
        </script>
      )}
    </Helmet>
  )
}
