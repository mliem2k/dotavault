import { createFileRoute, redirect } from '@tanstack/react-router'
import { BRACKET_SLUGS, MetaView } from '@/components/meta/meta_view'

export const Route = createFileRoute('/meta/$bracket')({
  beforeLoad: ({ params }) => {
    if (!(params.bracket in BRACKET_SLUGS)) throw redirect({ to: '/meta' })
  },
  component: BracketPage,
})

function BracketPage() {
  const { bracket } = Route.useParams()
  return <MetaView bracket={BRACKET_SLUGS[bracket]} />
}
