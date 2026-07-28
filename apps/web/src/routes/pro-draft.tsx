import { createFileRoute } from '@tanstack/react-router'
import { ProDraftView } from '@/components/pro_draft/pro_draft_view'

export const Route = createFileRoute('/pro-draft')({
  component: ProDraftView,
})
