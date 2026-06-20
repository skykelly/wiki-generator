import { notFound } from 'next/navigation'
import { auth } from '@/auth'
import { getWikiBySlug, getWikiPages, getTopicsConfig, getConceptItems } from '@/lib/data'
import WikiHeader from '@/components/WikiHeader'
import EmbeddedChrome from '@/components/EmbeddedChrome'
import ChatPopup from '@/components/ChatPopup'

export default async function WikiLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ wikiSlug: string }>
}) {
  const { wikiSlug } = await params
  const wikiId = `wiki_${wikiSlug}`

  const [session, wiki, wikiPages, wikiTopics, concepts] = await Promise.all([
    auth(),
    getWikiBySlug(wikiSlug),
    getWikiPages(wikiId),
    getTopicsConfig(wikiId),
    getConceptItems(wikiId),
  ])

  if (!wiki) notFound()

  return (
    <>
      <EmbeddedChrome />
      <WikiHeader
        session={session}
        wikiSlug={wikiSlug}
        wikiTitle={wiki.title}
        wikiPages={wikiPages}
        wikiTopics={wikiTopics}
        concepts={concepts}
      />
      <main>{children}</main>
      <ChatPopup session={session} wikiId={wikiId} />
    </>
  )
}
