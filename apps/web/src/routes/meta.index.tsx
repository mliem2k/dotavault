import { createFileRoute } from '@tanstack/react-router'
import { MetaView } from '@/components/meta/meta_view'

export const Route = createFileRoute('/meta/')({
  component: () => <MetaView bracket="pub" />,
})
