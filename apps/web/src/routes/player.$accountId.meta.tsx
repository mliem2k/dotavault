import { createFileRoute } from '@tanstack/react-router'
import { PatchMetaView } from '@/components/player/patch_meta_view'

export const Route = createFileRoute('/player/$accountId/meta')({
  component: PatchMetaView,
})
