import { createFileRoute } from '@tanstack/react-router'
import { ProMetaView } from '@/components/pro_meta/pro_meta_view'

export const Route = createFileRoute('/pro-meta')({
  component: ProMetaView,
})
